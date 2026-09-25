# Secrets Manager - Wompi API Key
resource "aws_secretsmanager_secret" "wompi_api_key" {
  name        = "${var.environment}/wompi/api-key"
  description = "Wompi sandbox/production API key"

  tags = {
    Name = "${var.environment}-wompi-api-key"
  }
}

resource "aws_secretsmanager_secret_version" "wompi_api_key" {
  secret_id     = aws_secretsmanager_secret.wompi_api_key.id
  secret_string = var.wompi_api_key
}

# Secrets Manager - Database Password
resource "aws_secretsmanager_secret" "database_password" {
  name        = "${var.environment}/wompi/database-password"
  description = "RDS PostgreSQL master password"

  tags = {
    Name = "${var.environment}-wompi-db-password"
  }
}

resource "aws_secretsmanager_secret_version" "database_password" {
  secret_id     = aws_secretsmanager_secret.database_password.id
  secret_string = var.database_password != "" ? var.database_password : random_password.db_password.result
}

# Secrets Manager - JWT Secret (for future auth)
resource "aws_secretsmanager_secret" "jwt_secret" {
  name        = "${var.environment}/wompi/jwt-secret"
  description = "JWT signing secret for authentication"

  tags = {
    Name = "${var.environment}-wompi-jwt-secret"
  }
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = random_password.jwt_secret.result
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}