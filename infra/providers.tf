provider "aws" {
  region = "us-east-1" # CloudFront + ACM cert both require us-east-1
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
