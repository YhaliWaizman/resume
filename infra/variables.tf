variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "cloudflare_zone_id" {
  type = string
}

variable "domain_name" {
  type    = string
  default = "yhali-waizman.com"
}

variable "github_repo" {
  type    = string
  default = "YhaliWaizman/resume"
}

variable "budget_alert_email" {
  type = string
}
