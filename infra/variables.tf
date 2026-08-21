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

# GitHub now issues OIDC subjects containing immutable owner/repo IDs.
variable "github_repo_immutable" {
  type    = string
  default = "YhaliWaizman@89968289/resume@1341847267"
}

variable "budget_alert_email" {
  type = string
}
