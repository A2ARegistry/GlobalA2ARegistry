'use strict';

// Unsigned synthetic cards only. Run: node test/security.test.js
// Contract: a2aproject/A2A specification/a2a.proto at
// fe182ee3c053d2e6a3ad2576c959fa5f7d8b5d07, plus specification sections 4.5.1/4.5.7.
const assert = require('node:assert/strict');
const { validateJson } = require('../src/validator');

const BASE_CARD = {
  name: 'Security schema example',
  description: 'An unsigned synthetic Agent Card for offline validation.',
  version: '1.0.0',
  supportedInterfaces: [{
    url: 'https://agent.example.com/a2a',
    protocolBinding: 'JSONRPC',
    protocolVersion: '1.0',
  }],
  capabilities: {},
  defaultInputModes: ['text/plain'],
  defaultOutputModes: ['text/plain'],
  skills: [{ id: 'example', name: 'Example', description: 'An example skill.', tags: ['example'] }],
};
const BEARER = { httpAuthSecurityScheme: { scheme: 'Bearer', bearerFormat: 'opaque' } };
const URL = 'https://auth.example.com';
let assertions = 0;

function cardWith(scheme = BEARER) {
  return {
    ...BASE_CARD,
    securitySchemes: { Auth: scheme },
    securityRequirements: [{ schemes: { Auth: {} } }],
  };
}

async function expectCard(label, card, valid, expectedWarnings = []) {
  // Exercise the actual JSON input boundary, without signing or requesting URLs.
  const result = await validateJson(JSON.stringify(card));
  assert.equal(result.isValid, valid, `${label}: ${JSON.stringify(result.findings.filter(f => f.severity === 'error'))}`);
  assert.equal(result.isOffline, true, label);
  const warnings = result.findings.filter(f => f.code.endsWith('SECURITY_SCHEME_UNDECLARED'));
  assert.deepEqual(warnings.map(f => [f.code, f.field, f.severity]), expectedWarnings, label);
  if (!valid) assert.ok(result.findings.some(f => f.code.startsWith('SCHEMA_') && f.severity === 'error'), label);
  assertions++;
  return result;
}

(async () => {
  await expectCard('no security requirements', BASE_CARD, true);
  await expectCard('HTTP bearer with omitted empty list', cardWith(), true);
  await expectCard('HTTP basic with optional description', cardWith({
    httpAuthSecurityScheme: { scheme: 'Basic', description: 'Example HTTP auth' },
  }), true);
  for (const location of ['query', 'header', 'cookie']) {
    await expectCard(`API key in ${location}`, cardWith({
      apiKeySecurityScheme: { location, name: 'example-key', description: 'Example key' },
    }), true);
  }
  await expectCard('OpenID Connect', cardWith({
    openIdConnectSecurityScheme: { openIdConnectUrl: `${URL}/.well-known/openid-configuration` },
  }), true);
  await expectCard('mTLS with no optional fields', cardWith({ mtlsSecurityScheme: {} }), true);
  await expectCard('mTLS with description', cardWith({ mtlsSecurityScheme: { description: 'Example mTLS' } }), true);

  const flows = {
    authorizationCode: { authorizationUrl: `${URL}/authorize`, tokenUrl: `${URL}/token`, scopes: { read: 'Read' }, pkceRequired: true },
    clientCredentials: { tokenUrl: `${URL}/token`, scopes: {} },
    deviceCode: { deviceAuthorizationUrl: `${URL}/device`, tokenUrl: `${URL}/token`, scopes: {} },
    implicit: { authorizationUrl: `${URL}/authorize`, scopes: {} },
    password: { tokenUrl: `${URL}/token`, scopes: {} },
  };
  for (const [name, flow] of Object.entries(flows)) {
    await expectCard(`OAuth ${name}`, cardWith({ oauth2SecurityScheme: {
      description: 'Example OAuth flow', oauth2MetadataUrl: `${URL}/.well-known/oauth-authorization-server`,
      flows: { [name]: { ...flow, refreshUrl: `${URL}/refresh` } },
    } }), true);
  }
  for (const name of ['implicit', 'password']) {
    await expectCard(`deprecated ${name} optional fields omitted`, cardWith({
      oauth2SecurityScheme: { flows: { [name]: {} } },
    }), true);
  }

  const emptyRequirements = [[], [{}], [{ schemes: {} }], [{ schemes: { Auth: {} } }], [{ schemes: { Auth: { list: [] } } }]];
  for (const [index, securityRequirements] of emptyRequirements.entries()) {
    await expectCard(`empty scopes representation ${index}`, { ...cardWith(), securityRequirements }, true);
    await expectCard(`skill empty scopes representation ${index}`, {
      ...cardWith(), skills: [{ ...BASE_CARD.skills[0], securityRequirements }],
    }, true);
  }
  await expectCard('named scopes and multiple schemes', {
    ...cardWith(),
    securitySchemes: { Auth: BEARER, Key: { apiKeySecurityScheme: { name: 'key', location: 'header' } } },
    securityRequirements: [{ schemes: { Auth: { list: ['read', 'write'] }, Key: {} } }, { schemes: {} }],
    skills: [{ ...BASE_CARD.skills[0], securityRequirements: [{ schemes: { Auth: { list: ['read'] } } }] }],
  }, true);

  const unknown = await expectCard('card undeclared scheme', {
    ...BASE_CARD, securityRequirements: [{ schemes: { Missing: {} } }],
  }, true, [['SECURITY_SCHEME_UNDECLARED', 'securityRequirements', 'warning']]);
  assert.ok(unknown.findings.some(f => f.code === 'SECURITY_SCHEME_UNDECLARED' && f.message.includes("'Missing'")));
  const skillUnknown = await expectCard('skill undeclared scheme', {
    ...cardWith(), skills: [{ ...BASE_CARD.skills[0], securityRequirements: [{ schemes: { Missing: { list: ['read'] } } }] }],
  }, true, [['SKILL_SECURITY_SCHEME_UNDECLARED', 'skills[0].securityRequirements', 'warning']]);
  assert.ok(skillUnknown.findings.some(f => f.code === 'SKILL_SECURITY_SCHEME_UNDECLARED' && f.message.includes("'Missing'")));

  for (const [label, scheme] of Object.entries({
    'legacy flat HTTP scheme': { type: 'http', scheme: 'Bearer' },
    'legacy flat API key': { type: 'apiKey', in: 'header', name: 'key' },
    'empty union': {},
    'multiple union members': { ...BEARER, mtlsSecurityScheme: {} },
    'unknown union member': { httpSecurityScheme: { scheme: 'Bearer' } },
    'unknown nested member': { httpAuthSecurityScheme: { scheme: 'Bearer', extra: true } },
    'missing HTTP scheme': { httpAuthSecurityScheme: {} },
    'invalid HTTP scheme type': { httpAuthSecurityScheme: { scheme: 5 } },
    'missing API key name': { apiKeySecurityScheme: { location: 'header' } },
    'missing API key location': { apiKeySecurityScheme: { name: 'key' } },
    'invalid API key location': { apiKeySecurityScheme: { name: 'key', location: 'body' } },
    'missing OIDC URL': { openIdConnectSecurityScheme: {} },
    'invalid OIDC URL type': { openIdConnectSecurityScheme: { openIdConnectUrl: 7 } },
    'invalid mTLS description': { mtlsSecurityScheme: { description: false } },
    'null union': null,
    'array union': [],
    'null variant': { httpAuthSecurityScheme: null },
    'array variant': { httpAuthSecurityScheme: [] },
    'missing OAuth flows': { oauth2SecurityScheme: {} },
    'empty OAuth flows': { oauth2SecurityScheme: { flows: {} } },
    'multiple OAuth flows': { oauth2SecurityScheme: { flows: { implicit: {}, password: {} } } },
    'unknown OAuth flow': { oauth2SecurityScheme: { flows: { unknown: {} } } },
    'null OAuth flow': { oauth2SecurityScheme: { flows: { implicit: null } } },
    'invalid OAuth metadata type': { oauth2SecurityScheme: { flows: { implicit: {} }, oauth2MetadataUrl: 7 } },
  })) await expectCard(label, cardWith(scheme), false);

  const required = {
    authorizationCode: ['authorizationUrl', 'tokenUrl', 'scopes'],
    clientCredentials: ['tokenUrl', 'scopes'],
    deviceCode: ['deviceAuthorizationUrl', 'tokenUrl', 'scopes'],
  };
  for (const [name, fields] of Object.entries(required)) {
    for (const field of fields) {
      const flow = { ...flows[name] };
      delete flow[field];
      await expectCard(`${name} missing ${field}`, cardWith({ oauth2SecurityScheme: { flows: { [name]: flow } } }), false);
    }
  }
  for (const [name, flow] of Object.entries(flows)) {
    await expectCard(`${name} non-string scope description`, cardWith({
      oauth2SecurityScheme: { flows: { [name]: { ...flow, scopes: { read: 1 } } } },
    }), false);
  }
  await expectCard('PKCE boolean required', cardWith({ oauth2SecurityScheme: {
    flows: { authorizationCode: { ...flows.authorizationCode, pkceRequired: 'yes' } },
  } }), false);

  const badRequirements = [
    null, {}, 'invalid', [null], [false], [1], ['invalid'], [[]],
    [{ Auth: [] }], [{ schemes: null }], [{ schemes: [] }], [{ schemes: 'Auth' }],
    [{ schemes: { Auth: [] } }], [{ schemes: { Auth: null } }],
    [{ schemes: { Auth: { list: null } } }], [{ schemes: { Auth: { list: 'read' } } }],
    [{ schemes: { Auth: { list: [1] } } }], [{ schemes: { Auth: { extra: [] } } }],
    [{ schemes: {}, extra: {} }],
  ];
  for (const [index, securityRequirements] of badRequirements.entries()) {
    await expectCard(`malformed card requirements ${index}`, { ...cardWith(), securityRequirements }, false);
    await expectCard(`malformed skill requirements ${index}`, {
      ...cardWith(), skills: [{ ...BASE_CARD.skills[0], securityRequirements }],
    }, false);
  }
  console.log(`Security schema: ${assertions} unsigned offline cases passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
