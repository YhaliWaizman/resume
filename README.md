# yhali-waizman.com

My resume site.

Runs on AWS now — migrated off my local computer because my house has electrical outages, lmao.
Simple static site: an S3 bucket served through CloudFront. Infra is all Terraform (`infra/`), deploys via GitHub Actions.

Static assets served to visitors live under `site/` (`site/index.html`, `site/blog.html`, `site/blog/`) — that's the directory synced to S3 on deploy.