resource "cloudflare_record" "apex" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  type    = "CNAME"
  content = aws_cloudfront_distribution.site.domain_name
  proxied = false # DNS-only: avoid double-proxying through Cloudflare on top of CloudFront
  ttl     = 300
}

resource "cloudflare_record" "www" {
  zone_id = var.cloudflare_zone_id
  name    = "www"
  type    = "CNAME"
  content = var.domain_name
  proxied = true
}

resource "cloudflare_ruleset" "redirect_www_to_apex" {
  zone_id = var.cloudflare_zone_id
  name    = "redirect-www-to-apex"
  kind    = "zone"
  phase   = "http_request_dynamic_redirect"

  rules {
    action      = "redirect"
    expression  = "(http.host eq \"www.${var.domain_name}\")"
    description = "Redirect www to apex"
    enabled     = true

    action_parameters {
      from_value {
        status_code           = 301
        preserve_query_string = true
        target_url {
          expression = "concat(\"https://${var.domain_name}\", http.request.uri.path)"
        }
      }
    }
  }
}
