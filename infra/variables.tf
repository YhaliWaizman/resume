# ponytail: cloudflare_api_token needs Zone.DNS:Edit AND Zone.Single Redirect:Edit
# (or Zone.Page Rules:Edit) on this zone — DNS-only scope causes "Authentication
# error (10000)" when applying cloudflare_ruleset.redirect_www_to_apex.
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

variable "budget_alert_email" {
  type = string
}
