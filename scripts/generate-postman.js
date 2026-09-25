#!/usr/bin/env node
/**
 * Generate Postman Collection from OpenAPI spec
 * Usage: node scripts/generate-postman.js
 */

const fs = require('fs');
const path = require('path');

const OPENAPI_PATH = path.join(__dirname, '../apps/backend/openapi.json');
const OUTPUT_PATH = path.join(__dirname, '../postman_collection.json');

function loadOpenApiSpec() {
  const content = fs.readFileSync(OPENAPI_PATH, 'utf-8');
  return JSON.parse(content);
}

function openApiToPostman(spec) {
  const collection = {
    info: {
      name: spec.info?.title || 'Wompi Checkout API',
      description: spec.info?.description || '',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      version: spec.info?.version || '1.0.0',
    },
    variable: [
      {
        key: 'baseUrl',
        value: 'http://localhost:3000',
        type: 'string',
        description: 'Base URL for the API',
      },
    ],
    item: [],
    auth: {
      type: 'bearer',
      bearer: [
        {
          key: 'token',
          value: '{{authToken}}',
          type: 'string',
        },
      ],
    },
  };

  // Group endpoints by tags
  const tagsMap = new Map();
  (spec.tags || []).forEach((tag) => {
    tagsMap.set(tag.name, {
      name: tag.name,
      description: tag.description,
      item: [],
    });
  });

  // Process each path
  Object.entries(spec.paths || {}).forEach(([path, methods]) => {
    Object.entries(methods).forEach(([method, operation]) => {
      if (method === 'parameters') return; // Skip path-level parameters

      const tags = operation.tags || ['Default'];
      const tagName = tags[0];
      const group = tagsMap.get(tagName) || { name: tagName, item: [] };

      const item = createPostmanItem(path, method.toUpperCase(), operation, spec);
      group.item.push(item);

      if (!tagsMap.has(tagName)) {
        tagsMap.set(tagName, group);
      }
    });
  });

  // Add grouped items to collection
  tagsMap.forEach((group) => {
    if (group.item.length > 0) {
      collection.item.push({
        name: group.name,
        description: group.description,
        item: group.item,
      });
    }
  });

  return collection;
}

function createPostmanItem(path, method, operation, spec) {
  const url = `{{baseUrl}}${path}`;

  // Build request
  const request = {
    method,
    header: [
      {
        key: 'Content-Type',
        value: 'application/json',
      },
      {
        key: 'Accept',
        value: 'application/json',
      },
    ],
    url: {
      raw: url,
      host: ['{{baseUrl}}'],
      path: path.split('/').filter(Boolean),
      variable: extractPathVariables(path),
    },
    description: operation.summary || operation.description || '',
  };

  // Add path parameters
  const parameters = operation.parameters || [];
  if (parameters.length > 0) {
    request.url.variable = request.url.variable || [];
    parameters.forEach((param) => {
      if (param.in === 'path') {
        request.url.variable.push({
          key: param.name,
          value: param.schema?.example || '',
          description: param.description || '',
        });
      }
    });
  }

  // Add request body for POST/PUT/PATCH
  if (['POST', 'PUT', 'PATCH'].includes(method) && operation.requestBody) {
    const content = operation.requestBody.content?.['application/json'];
    if (content) {
      request.body = {
        mode: 'raw',
        raw: JSON.stringify(generateExampleBody(content.schema, spec), null, 2),
        options: {
          raw: {
            language: 'json',
          },
        },
      };
    }
  }

  // Add responses as examples
  const responses = operation.responses || {};
  const responseExamples = [];
  Object.entries(responses).forEach(([statusCode, response]) => {
    if (response.content?.['application/json']?.schema) {
      responseExamples.push({
        name: `${statusCode} - ${response.description}`,
        originalRequest: request,
        status: `HTTP/${statusCode}`,
        code: parseInt(statusCode, 10),
        header: [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
        ],
        body: JSON.stringify(generateExampleBody(response.content['application/json'].schema, spec), null, 2),
      });
    } else if (statusCode !== 'default') {
      responseExamples.push({
        name: `${statusCode} - ${response.description}`,
        originalRequest: request,
        status: `HTTP/${statusCode}`,
        code: parseInt(statusCode, 10),
        header: [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
        ],
        body: '',
      });
    }
  });

  return {
    name: operation.summary || `${method} ${path}`,
    request,
    response: responseExamples,
  };
}

function extractPathVariables(path) {
  const variables = [];
  const matches = path.match(/\{([^}]+)\}/g);
  if (matches) {
    matches.forEach((match) => {
      const key = match.slice(1, -1);
      variables.push({ key, value: '' });
    });
  }
  return variables;
}

function generateExampleBody(schema, spec) {
  if (!schema) return {};

  // Handle $ref
  if (schema.$ref) {
    const refPath = schema.$ref.replace('#/components/schemas/', '');
    const schemaDef = spec.components?.schemas?.[refPath];
    if (schemaDef) {
      return generateExampleBody(schemaDef, spec);
    }
    return {};
  }

  // Handle allOf
  if (schema.allOf) {
    const merged = {};
    schema.allOf.forEach((s) => {
      const example = generateExampleBody(s, spec);
      Object.assign(merged, example);
    });
    return merged;
  }

  // Handle array
  if (schema.type === 'array') {
    const itemExample = generateExampleBody(schema.items, spec);
    return [itemExample];
  }

  // Handle object
  if (schema.type === 'object' && schema.properties) {
    const example = {};
    Object.entries(schema.properties).forEach(([key, propSchema]) => {
      if (propSchema.example !== undefined) {
        example[key] = propSchema.example;
      } else {
        example[key] = generateExampleBody(propSchema, spec);
      }
    });
    return example;
  }

  // Handle primitives with example
  if (schema.example !== undefined) {
    return schema.example;
  }

  // Default values for primitives
  switch (schema.type) {
    case 'string':
      return schema.format === 'date-time' ? new Date().toISOString() : 'string';
    case 'number':
    case 'integer':
      return schema.example || 0;
    case 'boolean':
      return schema.example || false;
    default:
      return null;
  }
}

// Main execution
function main() {
  try {
    console.log('Loading OpenAPI spec...');
    const spec = loadOpenApiSpec();

    console.log('Converting to Postman collection...');
    const collection = openApiToPostman(spec);

    console.log('Writing Postman collection...');
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(collection, null, 2));

    console.log(`Postman collection generated at: ${OUTPUT_PATH}`);
    console.log(`Collection name: ${collection.info.name}`);
    console.log(`Endpoints: ${collection.item.reduce((acc, group) => acc + group.item.length, 0)}`);
  } catch (error) {
    console.error('Error generating Postman collection:', error);
    process.exit(1);
  }
}

main();