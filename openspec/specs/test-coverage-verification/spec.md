# Test Coverage Verification Specification

## Purpose

Establish and enforce test coverage measurement across both frontend and backend,
enforcing an 80% threshold on statements, branches, functions, and lines, surfaced via
README badges and gated in CI.

## Functional Requirements

### Requirement: Configure backend coverage thresholds

The system MUST configure Vitest coverage reporting with a minimum threshold of 80%
across statements, branches, functions, and lines in `apps/backend/vitest.config.ts`.

#### Scenario: Coverage config enforces 80% threshold on backend

- GIVEN the backend `vitest.config.ts` defines coverage thresholds
- WHEN `npm run test:cov` runs in `apps/backend`
- THEN Vitest fails if any metric drops below 80% and emits a coverage report

#### Scenario: Coverage report is emitted to standard output path

- GIVEN coverage collection is enabled with `@vitest/coverage-v8`
- WHEN tests complete
- THEN a `coverage/` directory with HTML and lcov reports is written to `apps/backend/coverage/`

### Requirement: Configure frontend coverage thresholds

The system MUST configure Vitest coverage reporting with a minimum threshold of 80%
across statements, branches, functions, and lines in `apps/frontend` (via `vite.config.ts`
or a dedicated `vitest.config.ts`).

#### Scenario: Coverage config enforces 80% threshold on frontend

- GIVEN the frontend coverage config defines 80% thresholds
- WHEN `npm run test:cov` runs in `apps/frontend`
- THEN Vitest fails if any metric drops below 80% and emits a coverage report

### Requirement: Expose test:cov script for frontend

The system MUST add a `test:cov` script to `apps/frontend/package.json` so coverage
can be generated with `npm run test:cov`.

#### Scenario: Frontend test:cov script is available

- GIVEN `apps/frontend/package.json` scripts section
- WHEN `npm run test:cov` is executed from `apps/frontend`
- THEN coverage collection runs and respects threshold configuration

### Requirement: Surface coverage badges in README

The system MUST display coverage percentage badges for both backend and frontend in
`README.md`, linking to coverage report artifacts.

#### Scenario: README renders coverage badges

- GIVEN coverage reports exist for backend and frontend
- WHEN `README.md` is viewed on GitHub
- THEN two shields.io-style badges show current coverage percentages

### Requirement: Gate CI on coverage threshold

The system MUST configure CI to run `test:cov` on both apps and fail the build if
coverage falls below 80%.

#### Scenario: CI fails when coverage is below threshold

- GIVEN a CI workflow file in `.github/workflows/`
- WHEN tests run with coverage and a metric is below 80%
- THEN the workflow exits with a non-zero status and blocks merge

## Non-Functional Requirements

### Requirement: Coverage tool must be v8-based

The system SHOULD use `@vitest/coverage-v8` as the coverage provider for both apps.

#### Scenario: v8 provider is configured

- GIVEN both apps have `@vitest/coverage-v8` installed
- WHEN coverage is generated
- THEN reports include statement, branch, function, and line metrics

## Acceptance Criteria

- [ ] `apps/backend/vitest.config.ts` enforces 80% thresholds; `npm run test:cov` exits non-zero below threshold
- [ ] `apps/frontend/vite.config.ts` (or `vitest.config.ts`) enforces 80% thresholds
- [ ] `apps/frontend/package.json` has a `test:cov` script
- [ ] `README.md` has backend + frontend coverage badges
- [ ] CI workflow runs `test:cov` on both apps and fails below 80%

## Constraints

- MUST NOT reduce existing test count; coverage config is additive
- Frontend currently has no coverage config — adding it is a net-new change, not a delta
- Coverage must instrument all application source code under `src/` (excludes `node_modules`)

## Dependencies

- `@vitest/coverage-v8` (already a backend devDependency; must be added to frontend)
- Shields.io badge URLs requiring published report artifacts
- CI provider (GitHub Actions) workflow file creation in `.github/workflows/`

## References

- `apps/backend/vitest.config.ts`
- `apps/frontend/vite.config.ts`
- `apps/backend/package.json` (scripts section)
- `apps/frontend/package.json` (scripts section)
- `apps/backend/src/transactions/transaction.service.spec.ts`
- `apps/frontend/src/store/checkoutSlice.test.ts`
- `apps/frontend/src/App.test.tsx`
