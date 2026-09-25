# API Documentation Specification

## Purpose

Generate Swagger/OpenAPI documentation for the backend REST API using `@nestjs/swagger`,
make it browsable at `/api/docs`, produce a downloadable Postman collection, and embed
both into `README.md`.

## Functional Requirements

### Requirement: Decorate DTOs and controllers with Swagger metadata

The system MUST annotate every controller and request/response DTO with `@nestjs/swagger`
decorators (`@ApiTags`, `@ApiOperation`, `@ApiProperty`) so the generated OpenAPI document
covers all endpoints.

#### Scenario: All public endpoints are documented in OpenAPI

- GIVEN `@nestjs/swagger` decorators are applied to all controllers in `apps/backend/src/`
- WHEN the OpenAPI JSON is generated
- THEN it includes every route listed in the API contract (products, transactions, health)

### Requirement: Expose Swagger UI at /api/docs

The system MUST mount Swagger UI at `GET /api/docs` and serve the raw OpenAPI JSON at
`/api/docs-json`.

#### Scenario: Swagger UI is browsable

- GIVEN the NestJS app has Swagger registered via `DocumentBuilder` + `SwaggerModule`
- WHEN a browser navigates to `/api/docs`
- THEN an interactive API explorer is rendered

### Requirement: Generate OpenAPI JSON artifact

The system MUST make the OpenAPI JSON available at a stable path (`/api/docs-json`) and
optionally write it to `apps/backend/openapi.json` on build.

#### Scenario: OpenAPI JSON is valid and machine-readable

- GIVEN Swagger module is set up in `apps/backend/src/main.ts`
- WHEN a `GET /api/docs-json` request is sent
- THEN a valid OpenAPI 3.x JSON document is returned

### Requirement: Produce Postman collection

The system MUST generate a Postman collection (v2.1) from the OpenAPI spec and embed a
download link in `README.md`.

#### Scenario: Postman collection is generated from OpenAPI

- GIVEN `apps/backend/openapi.json` exists
- WHEN `swagger2postman` or equivalent runs
- THEN a `postman_collection.json` is produced and referenced in README

### Requirement: Embed API documentation in README

The system MUST embed or link the API documentation, Postman collection, and Swagger UI
in `README.md`.

#### Scenario: README contains documentation links

- GIVEN the API documentation is generated
- WHEN `README.md` is viewed
- THEN links to Swagger UI and Postman collection are present

## Non-Functional Requirements

### Requirement: Keep docs in sync with code

The system SHOULD generate the OpenAPI document from live decorators so docs never drift
from the actual route implementation.

#### Scenario: API doc reflects current routes

- GIVEN a new endpoint is added with Swagger decorators
- WHEN the OpenAPI JSON is regenerated
- THEN the new endpoint appears in the document

## Acceptance Criteria

- [ ] `@nestjs/swagger` installed and registered in `main.ts`
- [ ] All controllers and DTOs decorated with Swagger metadata
- [ ] Swagger UI browsable at `/api/docs`; OpenAPI JSON at `/api/docs-json`
- [ ] Postman collection (`.json`) generated and committed
- [ ] README links to Swagger UI + Postman collection

## Constraints

- MUST NOT hardcode endpoint descriptions; they MUST come from decorator metadata
- Postman collection generation is a build-time artifact, not a runtime dependency
- Documentation MUST cover all currently public endpoints (no gaps)

## Dependencies

- `@nestjs/swagger` (new dependency in `apps/backend`)
- `swagger-ui-express` or NestJS built-in Swagger module serving
- `swagger2postman` or equivalent CLI tool for Postman export
- `apps/backend/src/main.ts` (register Swagger module)
- `apps/backend/src/app.module.ts` (import Swagger module if needed)
- `apps/backend/src/transactions/transactions.controller.ts`
- `apps/backend/src/products/products.controller.ts`
- `apps/backend/src/app.controller.ts`
- `README.md` (embed links)

## References

- `apps/backend/src/main.ts`
- `apps/backend/src/app.module.ts`
- `apps/backend/src/products/products.controller.ts`
- `apps/backend/src/transactions/transactions.controller.ts`
- `apps/backend/src/app.controller.ts`
- `apps/backend/src/transactions/transaction.service.ts`
- `README.md`
