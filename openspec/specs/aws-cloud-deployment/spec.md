# AWS Cloud Deployment Specification

## Purpose

Provide Infrastructure-as-Code (Terraform or CDK) to deploy the full stack on AWS:
frontend on S3 + CloudFront (HTTPS), backend on ECS Fargate behind an ALB with ACM TLS,
RDS PostgreSQL, and Secrets Manager for Wompi credentials.

## Functional Requirements

### Requirement: Deploy frontend to S3 + CloudFront

The system MUST configure a private S3 bucket serving static assets behind a CloudFront
distribution with an ACM certificate, using an OAI.

#### Scenario: Frontend is served over HTTPS

- GIVEN a CloudFront distribution with an ACM certificate
- WHEN a browser requests `https://checkout.example.com`
- THEN the React SPA is served; origin never serves HTTP

### Requirement: Deploy backend to ECS Fargate

The system MUST define an ECS Fargate service running the backend container behind an
ALB with HTTPS (ACM) and a health check on `/health`.

#### Scenario: Backend health check succeeds

- GIVEN an ECS Fargate service behind an ALB
- WHEN the ALB sends a health check to `/health`
- THEN HTTP 200 is returned and the service is marked healthy

### Requirement: Provision RDS PostgreSQL

The system MUST create an RDS PostgreSQL instance with the Wompi database name,
configured for the backend `DATABASE_URL`.

#### Scenario: RDS instance is reachable from ECS

- GIVEN an RDS PostgreSQL instance in the same VPC
- WHEN the backend container starts
- THEN `DATABASE_URL` resolves and a connection succeeds

### Requirement: Store Wompi secrets in Secrets Manager

The system MUST store `WOMPI_API_KEY` and credentials in Secrets Manager, injecting
them into the ECS task as env vars at runtime.

#### Scenario: Wompi key is not in plaintext IaC

- GIVEN the Terraform/CDK code is reviewed
- WHEN Secrets Manager resources are inspected
- THEN no plaintext Wompi API key is committed; only a secret ARN reference exists

### Requirement: Configure ALB + ACM for HTTPS

The system MUST create an ACM certificate for the backend domain (DNS-validated),
attach it to the ALB on port 443, and redirect port 80 to 443.

#### Scenario: HTTP is redirected to HTTPS

- GIVEN an ALB listener on port 80
- WHEN an HTTP request arrives
- THEN a 301 redirect to HTTPS is returned

### Requirement: Use Docker multi-stage builds

The system MUST use the existing `apps/backend/Dockerfile` and `apps/frontend/Dockerfile`
for container images; IaC references these images via ECR.

#### Scenario: Backend container builds and deploys

- GIVEN the backend Dockerfile exists
- WHEN the CI/CD build completes
- THEN the image is pushed to ECR and the ECS service deploys it

## Non-Functional Requirements

### Requirement: Isolate resources in a VPC

The system SHOULD deploy RDS and ECS tasks in a private VPC, restricting RDS to
private subnets.

#### Scenario: RDS is not publicly accessible

- GIVEN the RDS resource is created
- WHEN its configuration is inspected
- THEN `publicly_accessible` is `false`

## Acceptance Criteria

- [ ] Terraform or CDK IaC under `terraform/` or `cdk/`
- [ ] S3 + CloudFront + ACM for frontend
- [ ] ECS Fargate + ALB + ACM for backend
- [ ] RDS PostgreSQL in private subnets
- [ ] Wompi credentials in Secrets Manager (no plaintext)
- [ ] Port 80 → 443 redirect; `/health` health check
- [ ] Existing Dockerfiles used for images

## Constraints

- MUST NOT store Wompi credentials in plaintext env vars — always via Secrets Manager
- RDS MUST be in private subnets; backend reaches it via VPC security groups
- Frontend S3 bucket MUST be private (CloudFront OAI only)
- IaC tooling (Terraform vs CDK) decided in design phase

## Dependencies

- `apps/backend/Dockerfile` + `apps/frontend/Dockerfile` (container images)
- `apps/backend/.env.example` (env var contract)
- `docker-compose.yml` (env var wiring reference)
- AWS account with ECS, RDS, S3, CloudFront, ACM, Secrets Manager, ALB
- Domain name for ACM certificate

## References

- `docker-compose.yml`
- `apps/backend/Dockerfile`, `apps/frontend/Dockerfile`
- `apps/backend/.env.example`
- `apps/backend/src/app.controller.ts`
- `terraform/` or `cdk/` (to be created)
