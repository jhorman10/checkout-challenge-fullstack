import { convert } from 'swagger2-to-postman';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generatePostmanCollection() {
  const openApiPath = resolve(__dirname, '../openapi.json');
  const outputPath = resolve(__dirname, '../../docs/postman_collection.json');

  const openApiSpec = JSON.parse(readFileSync(openApiPath, 'utf-8'));

  convert({ type: 'json', data: openApiSpec }, {}, (err, result) => {
    if (err) {
      console.error('Failed to convert OpenAPI to Postman:', err);
      process.exit(1);
    }

    if (!result || result.length === 0) {
      console.error('No Postman collection generated');
      process.exit(1);
    }

    const collection = result[0].collection;
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(collection, null, 2));
    console.log(`Postman collection written to ${outputPath}`);
  });
}

generatePostmanCollection().catch((error) => {
  console.error('Failed to generate Postman collection:', error);
  process.exit(1);
});