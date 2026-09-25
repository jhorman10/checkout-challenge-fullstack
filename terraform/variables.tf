variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

variable "database_name" {
  description = "RDS database name"
  type        = string
  default     = "checkout_db"
}

variable "database_username" {
  description = "RDS master username"
  type        = string
  default     = "admin"
}

variable "database_password" {
  description = "RDS master password (use Secrets Manager in production)"
  type        = string
  sensitive   = true
}

variable "database_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "database_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

variable "ecs_task_cpu" {
  description = "ECS task CPU units (1024 = 1 vCPU)"
  type        = number
  default     = 512
}

variable "ecs_task_memory" {
  description = "ECS task memory in MiB"
  type        = number
  default     = 1024
}

variable "ecs_desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 2
}

variable "ecs_min_capacity" {
  description = "Minimum ECS service capacity"
  type        = number
  default     = 1
}

variable "ecs_max_capacity" {
  description = "Maximum ECS service capacity"
  type        = number
  default     = 10
}

variable "backend_image_uri" {
  description = "ECR image URI for backend container"
  type        = string
  default     = ""
}

variable "frontend_image_uri" {
  description = "ECR image URI for frontend container"
  type        = string
  default     = ""
}

variable "domain_name" {
  description = "Custom domain name for the application (e.g., checkout.example.com)"
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for custom domain (if domain_name is set)"
  type        = string
  default     = ""
}

variable "wompi_api_key" {
  description = "Wompi API key (stored in Secrets Manager)"
  type        = string
  sensitive   = true
}

variable "wompi_env" {
  description = "Wompi environment (sandbox or production)"
  type        = string
  default     = "sandbox"
}

variable "wompi_base_url" {
  description = "Wompi API base URL"
  type        = string
  default     = "https://sandbox.wompi.co/v1"
}

variable "cors_origins" {
  description = "Comma-separated list of allowed CORS origins"
  type        = string
  default     = "https://checkout.example.com"
}

variable "rate_limit_global_max" {
  description = "Global rate limit max requests per window"
  type        = number
  default     = 100
}

variable "rate_limit_global_window_min" {
  description = "Global rate limit window in minutes"
  type        = number
  default     = 15
}

variable "rate_limit_payment_max" {
  description = "Payment endpoint rate limit max requests per window"
  type        = number
  default     = 5
}

variable "rate_limit_payment_window_min" {
  description = "Payment endpoint rate limit window in minutes"
  type        = number
  default     = 15
}