'use strict';

/**
 * A2A Agent Card v1.0 JSON Schema (Draft 2020-12)
 *
 * Implements the AgentCard structure defined in:
 *   specification/a2a.proto @ a2aproject/A2A (fe182ee3c053d2e6a3ad2576c959fa5f7d8b5d07)
 *   Specification sections 4.4 (Agent Discovery Objects) and 4.5 (Security Objects).
 *
 * This schema covers only fields defined in the A2A 1.0 protocol spec.
 * Registry-specific extensions (package_name, category, target_audience, etc.)
 * are intentionally excluded to keep this a pure protocol validator.
 */
const A2A_V1_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://a2a-registry.org/schemas/a2a/v1.0/agent-card.json',
  title: 'A2A Agent Card v1.0',
  $defs: {
    StringList: {
      type: 'object',
      properties: { list: { type: 'array', items: { type: 'string' } } },
      additionalProperties: false,
    },
    SecurityRequirement: {
      type: 'object',
      properties: {
        schemes: {
          type: 'object',
          additionalProperties: { $ref: '#/$defs/StringList' },
        },
      },
      additionalProperties: false,
    },
    SecurityScheme: {
      type: 'object',
      // The specification requires exactly one of these named union members.
      minProperties: 1,
      maxProperties: 1,
      properties: {
        apiKeySecurityScheme: {
          type: 'object',
          required: ['location', 'name'],
          properties: {
            description: { type: 'string' },
            location: { type: 'string', enum: ['query', 'header', 'cookie'] },
            name: { type: 'string' },
          },
          additionalProperties: false,
        },
        httpAuthSecurityScheme: {
          type: 'object',
          required: ['scheme'],
          properties: {
            description: { type: 'string' },
            scheme: { type: 'string' },
            bearerFormat: { type: 'string' },
          },
          additionalProperties: false,
        },
        oauth2SecurityScheme: {
          type: 'object',
          required: ['flows'],
          properties: {
            description: { type: 'string' },
            flows: { $ref: '#/$defs/OAuthFlows' },
            oauth2MetadataUrl: { type: 'string' },
          },
          additionalProperties: false,
        },
        openIdConnectSecurityScheme: {
          type: 'object',
          required: ['openIdConnectUrl'],
          properties: {
            description: { type: 'string' },
            openIdConnectUrl: { type: 'string', format: 'uri' },
          },
          additionalProperties: false,
        },
        mtlsSecurityScheme: {
          type: 'object',
          properties: { description: { type: 'string' } },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    OAuthScopes: { type: 'object', additionalProperties: { type: 'string' } },
    OAuthFlows: {
      type: 'object',
      minProperties: 1,
      maxProperties: 1,
      properties: {
        authorizationCode: {
          type: 'object',
          required: ['authorizationUrl', 'tokenUrl', 'scopes'],
          properties: {
            authorizationUrl: { type: 'string' },
            tokenUrl: { type: 'string' },
            refreshUrl: { type: 'string' },
            scopes: { $ref: '#/$defs/OAuthScopes' },
            pkceRequired: { type: 'boolean' },
          },
          additionalProperties: false,
        },
        clientCredentials: {
          type: 'object',
          required: ['tokenUrl', 'scopes'],
          properties: {
            tokenUrl: { type: 'string' },
            refreshUrl: { type: 'string' },
            scopes: { $ref: '#/$defs/OAuthScopes' },
          },
          additionalProperties: false,
        },
        // Deprecated flows remain representable; their proto fields are optional.
        implicit: {
          type: 'object',
          properties: {
            authorizationUrl: { type: 'string' },
            refreshUrl: { type: 'string' },
            scopes: { $ref: '#/$defs/OAuthScopes' },
          },
          additionalProperties: false,
        },
        password: {
          type: 'object',
          properties: {
            tokenUrl: { type: 'string' },
            refreshUrl: { type: 'string' },
            scopes: { $ref: '#/$defs/OAuthScopes' },
          },
          additionalProperties: false,
        },
        deviceCode: {
          type: 'object',
          required: ['deviceAuthorizationUrl', 'tokenUrl', 'scopes'],
          properties: {
            deviceAuthorizationUrl: { type: 'string' },
            tokenUrl: { type: 'string' },
            refreshUrl: { type: 'string' },
            scopes: { $ref: '#/$defs/OAuthScopes' },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
  },
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
            items: { $ref: '#/$defs/SecurityRequirement' },
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
      additionalProperties: { $ref: '#/$defs/SecurityScheme' },
    },
    securityRequirements: {
      type: 'array',
      items: { $ref: '#/$defs/SecurityRequirement' },
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
  },
  additionalProperties: false,
};

module.exports = { A2A_V1_SCHEMA };
