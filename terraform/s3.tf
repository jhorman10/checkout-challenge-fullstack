# This file contains additional S3 resources for static site hosting
# The main frontend bucket is defined in cloudfront.tf

# S3 Bucket for Terraform State (referenced in main.tf backend config)
# This should be created manually or via a separate bootstrap stack
# resource "aws_s3_bucket" "terraform_state" {
#   bucket = "wompi-checkout-terraform-state"
#
#   server_side_encryption_configuration {
#     rule {
#       apply_server_side_encryption_by_default {
#         sse_algorithm = "AES256"
#       }
#     }
#   }
#
#   versioning {
#     enabled = true
#   }
#
#   lifecycle {
#     prevent_destroy = true
#   }
# }
#
# resource "aws_s3_bucket_public_access_block" "terraform_state" {
#   bucket = aws_s3_bucket.terraform_state.id
#
#   block_public_acls       = true
#   block_public_policy     = true
#   ignore_public_acls      = true
#   restrict_public_buckets = true
# }
#
# resource "aws_dynamodb_table" "terraform_locks" {
#   name           = "terraform-locks"
#   billing_mode   = "PAY_PER_REQUEST"
#   hash_key       = "LockID"
#   attribute {
#     name = "LockID"
#     type = "S"
#   }
#   ttl {
#     attribute_name = "LockTime"
#     enabled        = true
#   }
# }

# Additional S3 bucket for application uploads (if needed in future)
resource "aws_s3_bucket" "uploads" {
  bucket = "${var.environment}-wompi-uploads-${data.aws_caller_identity.current.account_id}"

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }

  versioning {
    enabled = true
  }

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = var.cors_origins != "" ? split(",", var.cors_origins) : ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 Bucket Policy for uploads (restrict to authenticated users via CloudFront signed URLs)
resource "aws_s3_bucket_policy" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AllowCloudFrontSignedUrls"
      Effect = "Allow"
      Principal = {
        CanonicalUser = aws_cloudfront_origin_access_identity.frontend.s3_canonical_user_id
      }
      Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
      Resource = "${aws_s3_bucket.uploads.arn}/*"
    }]
  })
}