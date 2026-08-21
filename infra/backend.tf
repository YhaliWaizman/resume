terraform {
  backend "s3" {
    bucket         = "yhali-resume-tf-state"
    key            = "resume-site/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "yhali-resume-tf-lock"
    encrypt        = true
  }
}
