resource "cloudflare_record" "apex" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  type    = "CNAME"
  content = aws_cloudfront_distribution.site.domain_name
  proxied = false # DNS-only: avoid double-proxying through Cloudflare on top of CloudFront
  ttl     = 300
}
