# S3 Bucket for backups
resource "aws_s3_bucket" "backups" {
  bucket = "${var.environment}-curriculum-app-backups"
  
  tags = {
    Name        = "${var.environment}-backups"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  
  rule {
    id     = "delete-old-backups"
    status = "Enabled"
    
    expiration {
      days = 30
    }
    
    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }
  
  rule {
    id     = "transition-to-glacier"
    status = "Enabled"
    
    transition {
      days          = 7
      storage_class = "GLACIER"
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# SNS Topic for backup notifications
resource "aws_sns_topic" "backup_notifications" {
  name = "${var.environment}-backup-notifications"
  
  tags = {
    Name        = "${var.environment}-backup-notifications"
    Environment = var.environment
  }
}

resource "aws_sns_topic_subscription" "backup_email" {
  topic_arn = aws_sns_topic.backup_notifications.arn
  protocol  = "email"
  endpoint  = var.backup_notification_email
}

# IAM Role for ECS Task to run backups
resource "aws_iam_role" "backup_task" {
  name = "${var.environment}-backup-task-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "backup_task" {
  name = "${var.environment}-backup-task-policy"
  role = aws_iam_role.backup_task.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:DeleteObject"
        ]
        Resource = [
          aws_s3_bucket.backups.arn,
          "${aws_s3_bucket.backups.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.backup_notifications.arn
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = "*"
      }
    ]
  })
}

# ECS Task Definition for backup
resource "aws_ecs_task_definition" "backup" {
  family                   = "${var.environment}-backup-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.backup_task.arn
  
  container_definitions = jsonencode([
    {
      name  = "backup"
      image = "amazon/aws-cli:latest"
      command = [
        "/bin/bash",
        "-c",
        "curl -o /tmp/backup.sh https://raw.githubusercontent.com/your-org/curriculum-app/main/scripts/backup.sh && chmod +x /tmp/backup.sh && /tmp/backup.sh"
      ]
      environment = [
        {
          name  = "ENVIRONMENT"
          value = var.environment
        },
        {
          name  = "BACKUP_S3_BUCKET"
          value = aws_s3_bucket.backups.id
        },
        {
          name  = "SNS_TOPIC_ARN"
          value = aws_sns_topic.backup_notifications.arn
        }
      ]
      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "${var.secrets_manager_arn}:DATABASE_URL::"
        },
        {
          name      = "REDIS_URL"
          valueFrom = "${var.secrets_manager_arn}:REDIS_URL::"
        },
        {
          name      = "PINECONE_API_KEY"
          valueFrom = "${var.secrets_manager_arn}:PINECONE_API_KEY::"
        },
        {
          name      = "PINECONE_ENVIRONMENT"
          valueFrom = "${var.secrets_manager_arn}:PINECONE_ENVIRONMENT::"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${var.environment}/backup"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])
}

# CloudWatch Log Group for backup task
resource "aws_cloudwatch_log_group" "backup" {
  name              = "/ecs/${var.environment}/backup"
  retention_in_days = 30
  
  tags = {
    Name        = "${var.environment}-backup-logs"
    Environment = var.environment
  }
}

# IAM Role for EventBridge to run ECS tasks
resource "aws_iam_role" "eventbridge_ecs" {
  name = "${var.environment}-eventbridge-ecs-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "eventbridge_ecs" {
  name = "${var.environment}-eventbridge-ecs-policy"
  role = aws_iam_role.eventbridge_ecs.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:RunTask"
        ]
        Resource = aws_ecs_task_definition.backup.arn
      },
      {
        Effect = "Allow"
        Action = [
          "iam:PassRole"
        ]
        Resource = [
          aws_iam_role.ecs_task_execution.arn,
          aws_iam_role.backup_task.arn
        ]
      }
    ]
  })
}

# EventBridge Rule for daily backups at 2:00 AM UTC
resource "aws_cloudwatch_event_rule" "daily_backup" {
  name                = "${var.environment}-daily-backup"
  description         = "Trigger daily backup at 2:00 AM UTC"
  schedule_expression = "cron(0 2 * * ? *)"
  
  tags = {
    Name        = "${var.environment}-daily-backup"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "backup_task" {
  rule      = aws_cloudwatch_event_rule.daily_backup.name
  target_id = "backup-task"
  arn       = aws_ecs_cluster.main.arn
  role_arn  = aws_iam_role.eventbridge_ecs.arn
  
  ecs_target {
    task_count          = 1
    task_definition_arn = aws_ecs_task_definition.backup.arn
    launch_type         = "FARGATE"
    
    network_configuration {
      subnets          = aws_subnet.private[*].id
      security_groups  = [aws_security_group.ecs_tasks.id]
      assign_public_ip = false
    }
  }
}
