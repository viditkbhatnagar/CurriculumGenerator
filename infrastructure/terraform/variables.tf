variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
}

variable "ssl_certificate_arn" {
  description = "ARN of SSL certificate for HTTPS"
  type        = string
}

variable "min_capacity" {
  description = "Minimum number of tasks"
  type        = number
  default     = 2
}

variable "max_capacity" {
  description = "Maximum number of tasks"
  type        = number
  default     = 10
}

variable "frontend_cpu" {
  description = "CPU units for frontend task"
  type        = number
  default     = 512
}

variable "frontend_memory" {
  description = "Memory for frontend task"
  type        = number
  default     = 1024
}

variable "api_cpu" {
  description = "CPU units for API task"
  type        = number
  default     = 1024
}

variable "api_memory" {
  description = "Memory for API task"
  type        = number
  default     = 2048
}

variable "worker_cpu" {
  description = "CPU units for worker task"
  type        = number
  default     = 1024
}

variable "worker_memory" {
  description = "Memory for worker task"
  type        = number
  default     = 2048
}

variable "ai_service_cpu" {
  description = "CPU units for AI service task"
  type        = number
  default     = 2048
}

variable "ai_service_memory" {
  description = "Memory for AI service task"
  type        = number
  default     = 4096
}

variable "backup_notification_email" {
  description = "Email address for backup notifications"
  type        = string
}

variable "secrets_manager_arn" {
  description = "ARN of AWS Secrets Manager secret containing application secrets"
  type        = string
}
