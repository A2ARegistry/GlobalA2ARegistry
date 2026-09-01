'use strict';

/**
 * A2A Agent Card v1.0 JSON Schema (Draft 2020-12)
 * Canonical source: https://a2a-protocol.org/schemas/v1.0/agent-card.json
 * Kept in sync with backend/src/schemas/generated/v1_0/schema.json
 */
const A2A_V1_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://a2a-protocol.org/schemas/v1.0/agent-card.json',
  title: 'A2A Agent Card v1.0',
  type: 'object',
  required: [
    'name',
    'description',
    'version',
    'supportedInterfaces',
    'capabilities',
    'defaultInputModes',
    'defaultOutputModes',
    'skills',
  ],
  properties: {
    name: { type: 'string', minLength: 1 },
    description: { type: 'string', minLength: 1 },
    version: {
      type: 'string',
      pattern:
        '^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)' +
        '(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)' +
        '(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$',
    },
    supportedInterfaces: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['url', 'protocolBinding', 'protocolVersion'],
        properties: {
          url: { type: 'string', minLength: 1 },
          protocolBinding: { type: 'string', minLength: 1 },
          protocolVersion: { type: 'string', minLength: 1 },
          tenant: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
    capabilities: {
      type: 'object',
      properties: {
        streaming: { type: 'boolean' },
        pushNotifications: { type: 'boolean' },
        extendedAgentCard: { type: 'boolean' },
        extensions: {
          type: 'array',
          items: {
            type: 'object',
            required: ['uri'],
            properties: {
              uri: { type: 'string' },
              description: { type: 'string' },
              required: { type: 'boolean' },
              params: { type: 'object', additionalProperties: true },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
    defaultInputModes: {
      type: 'array',
      minItems: 1,
      items: { type: 'string' },
    },
    defaultOutputModes: {
      type: 'array',
      minItems: 1,
      items: { type: 'string' },
    },
    skills: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'name', 'description', 'tags'],
        properties: {
          id: { type: 'string', minLength: 1 },
          name: { type: 'string', minLength: 1 },
          description: { type: 'string', minLength: 1 },
          tags: { type: 'array', minItems: 1, items: { type: 'string' } },
          examples: { type: 'array', items: { type: 'string' } },
          inputModes: { type: 'array', items: { type: 'string' } },
          outputModes: { type: 'array', items: { type: 'string' } },
          securityRequirements: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        additionalProperties: false,
      },
    },
    provider: {
      type: 'object',
      required: ['organization', 'url'],
      properties: {
        organization: { type: 'string', minLength: 1 },
        url: { type: 'string', format: 'uri' },
      },
      additionalProperties: false,
    },
    securitySchemes: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            type: 'string',
            enum: ['apiKey', 'http', 'oauth2', 'openIdConnect', 'mutualTls'],
          },
          description: { type: 'string' },
          name: { type: 'string' },
          in: { type: 'string', enum: ['header', 'query', 'cookie'] },
          scheme: { type: 'string' },
          bearerFormat: { type: 'string' },
          flows: { type: 'object' },
          openIdConnectUrl: { type: 'string', format: 'uri' },
        },
      },
    },
    securityRequirements: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: { type: 'array', items: { type: 'string' } },
      },
    },
    signatures: {
      type: 'array',
      items: {
        type: 'object',
        required: ['protected', 'signature'],
        properties: {
          protected: { type: 'string' },
          signature: { type: 'string' },
          header: { type: 'object' },
        },
        additionalProperties: false,
      },
    },
    iconUrl: { type: 'string' },
    documentationUrl: { type: 'string' },
    package_name: {
      type: 'string',
      pattern: '^[a-zA-Z0-9_-]+(\\.[a-zA-Z0-9_-]+)+$',
    },
    category: { type: 'string' },
    target_audience: { type: 'string' },
  },
  additionalProperties: false,
};

module.exports = { A2A_V1_SCHEMA };
