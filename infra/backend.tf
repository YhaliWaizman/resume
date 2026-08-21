terraform {
  backend "s3" {
    bucket       = "yhali-resume-tf-state"
    key          = "resume-site/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true # native S3 conditional-write locking, no DynamoDB table needed
    encrypt      = true
  }
}
