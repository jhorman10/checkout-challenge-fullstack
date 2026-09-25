# README Data Model Specification

## Purpose

Move the entity/relationship data model from `TECHNICAL_SPEC.md` §5 into `README.md`
as the single source of truth, including a Mermaid ER diagram, entity attributes,
transaction state machine, and business rules.

## Functional Requirements

### Requirement: Document entity set in README

The system MUST copy the Product, Customer, Delivery, Transaction, and
InventoryMovement entity definitions from `TECHNICAL_SPEC.md` §5.1 into `README.md`.

#### Scenario: Product entity fields are documented in README

- GIVEN `README.md` contains a Data Model section
- WHEN a developer reads the Product entity
- THEN all fields (id, name, description, price, stock, currency, imageUrl, isActive,
  createdAt, updatedAt) are listed

### Requirement: Embed Mermaid ER diagram

The system MUST render an entity-relationship diagram as a Mermaid `erDiagram` block in
`README.md` showing relationships between Product, Customer, Delivery, Transaction, and
InventoryMovement.

#### Scenario: Mermaid diagram renders on GitHub

- GIVEN `README.md` contains a ` ```mermaid ` block with an `erDiagram`
- WHEN the README is viewed on GitHub
- THEN the entity relationships are rendered as a diagram

### Requirement: Document transaction states

The system MUST list the full transaction state set (`pending`, `processing`, `approved`,
`rejected`, `failed`, `cancelled`) and their permitted transitions in `README.md`.

#### Scenario: State transitions are documented

- GIVEN the Data Model section in README
- WHEN the transaction states are read
- THEN the transition from `pending → processing → approved|rejected|failed` is shown

### Requirement: Document business rules

The system MUST copy the stock, payment, and data-handling business rules from
`TECHNICAL_SPEC.md` §5.3 into `README.md`.

#### Scenario: Payment-once rule is in README

- GIVEN `README.md` lists business rules
- WHEN a developer searches for "Payment must be processed only once"
- THEN the rule is found in the Data Model section

### Requirement: README is single source of truth

The system MUST ensure `README.md` data model matches `TECHNICAL_SPEC.md` §5 with no
divergence; `README.md` is the authoritative reference going forward.

#### Scenario: README and TECHNICAL_SPEC are consistent

- GIVEN both files define the Transaction entity
- WHEN their field lists are compared
- THEN all attributes match

## Non-Functional Requirements

### Requirement: Diagram is maintainable

The system SHOULD keep the Mermaid diagram as plain text so it can be updated in code
review alongside schema changes.

#### Scenario: Mermaid block is valid syntax

- GIVEN the `erDiagram` block in README
- WHEN a Mermaid renderer parses it
- THEN no syntax errors are reported

## Acceptance Criteria

- [ ] README contains a "Data Model" section
- [ ] All 5 entities documented with attributes
- [ ] Mermaid `erDiagram` block renders on GitHub
- [ ] Transaction states and transitions listed
- [ ] Business rules copied from `TECHNICAL_SPEC.md` §5.3
- [ ] README is single source of truth (TECHNICAL_SPEC §5 removed or marked deprecated)

## Constraints

- Mermaid diagram MUST use `erDiagram` syntax (not `classDiagram` or `graph`)
- Entity field lists MUST match the TypeScript interfaces in
  `apps/backend/src/transactions/transaction.service.ts` and
  `apps/backend/src/products/products.service.ts`
- Diagram text MUST fit on a single Mermaid block (no external file imports)

## Dependencies

- `TECHNICAL_SPEC.md` §5 (source for entity/field content)
- `README.md` (target — add Data Model section)
- `apps/backend/src/transactions/transaction.service.ts` (TransactionRecord interface)
- `apps/backend/src/products/products.service.ts` (Product interface)
- `openspec/specs/payment-checkout/spec.md` §4 (transaction states)

## References

- `TECHNICAL_SPEC.md`
- `README.md`
- `apps/backend/src/transactions/transaction.service.ts`
- `apps/backend/src/products/products.service.ts`
