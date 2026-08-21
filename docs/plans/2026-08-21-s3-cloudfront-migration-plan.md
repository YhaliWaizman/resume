# S3 + CloudFront Migration Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Execute tasks in order; each task ends in a `terraform validate`/`plan` or workflow-lint checkpoint since this is infra-as-code, not application code with unit tests.

**Goal:** Replace the local Docker/nginx deploy target with S3 + CloudFront, issue a TLS cert, and stand up two GitHub Actions workflows (auto content deploy, manual infra apply).

**Architecture:** Terraform manages all AWS resources (S3 site bucket, CloudFront + OAC, ACM cert in us-east-1, IAM OIDC provider + two roles, budget alarm, Terraform state backend) plus the Cloudflare DNS records (apex CNAME, ACM validation CNAME) via the `cloudflare` provider. Two workflows: `deploy.yml` (auto, content-only, scoped OIDC role) and `terraform.yml` (manual `workflow_dispatch`, infra OIDC role).

**Tech Stack:** Terraform (AWS + Cloudflare providers), GitHub Actions, existing Node.js test runner for `npm run review`.

## Global Constraints

- No dev/staging environment — one production environment only.
- DNS stays on Cloudflare, proxy status DNS-only (grey cloud) for anything pointing at CloudFront.
- ACM certificate must be requested in `us-east-1`.
- No long-lived AWS access keys anywhere — OIDC only.
- Budget alarm threshold: $1/month.
- S3 versioning enabled with 30-day noncurrent-version expiry.
- `Dockerfile` and `default.conf` are deleted once the new pipeline is verified.
- Bootstrap (OIDC provider, IAM roles, Terraform state backend) is applied once locally with the operator's own AWS credentials — not via CI — because CI's Terraform role doesn't exist until bootstrap creates it.

---

### Task 1: Terraform project scaffold + state backend (manual bootstrap)

**Files:**

- Create: `infra/versions.tf`
- Create: `infra/backend.tf`
- Create: `infra/providers.tf`
- Create: `infra/bootstrap/main.tf` (one-time: state bucket + DynamoDB lock table, applied before `infra/backend.tf` can use them)
- Create: `infra/variables.tf`
- Create: `infra/terraform.tfvars.example`

**Interfaces:**

- Produces: an S3 bucket (versioned) + DynamoDB table used as the `infra/` remote state backend; `aws` and `cloudflare` provider blocks other tasks' resources attach to.

- [ ] **Step 1: Write `infra/bootstrap/main.tf`**

```hcl
terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" {
  region = "us-east-1"
}

resource "aws_s3_bucket" "tf_state" {
  bucket = "yhali-resume-tf-state"
}

resource "aws_s3_bucket_versioning" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_public_access_block" "tf_state" {
  bucket                  = aws_s3_bucket.tf_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "tf_lock" {
  name         = "yhali-resume-tf-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"
  attribute {
    name = "LockID"
    type = "S"
  }
}
```

- [ ] **Step 2: Apply the bootstrap locally**

Run (with your own AWS credentials, one time only):
```bash
cd infra/bootstrap
terraform init
terraform apply
```
Expected: `aws_s3_bucket.tf_state` and `aws_dynamodb_table.tf_lock` created. Note the bucket/table names for Step 3.

- [ ] **Step 3: Write `infra/backend.tf`, `infra/providers.tf`, `infra/versions.tf`**

```hcl
# infra/versions.tf
terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws        = { source = "hashicorp/aws", version = "~> 5.0" }
    cloudflare = { source = "cloudflare/cloudflare", version = "~> 4.0" }
  }
}
```

```hcl
# infra/backend.tf
terraform {
  backend "s3" {
    bucket         = "yhali-resume-tf-state"
    key            = "resume-site/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "yhali-resume-tf-lock"
    encrypt        = true
  }
}
```

```hcl
# infra/providers.tf
provider "aws" {
  region = "us-east-1" # CloudFront + ACM cert both require us-east-1
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
```

```hcl
# infra/variables.tf
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
  default = "<owner>/resume"
}
```

```hcl
# infra/terraform.tfvars.example
cloudflare_api_token = "REPLACE_ME"
cloudflare_zone_id   = "REPLACE_ME"
domain_name          = "yhali-waizman.com"
github_repo          = "<owner>/resume"
```

- [ ] **Step 4: Verify**

Run: `cd infra && terraform init && terraform validate`
Expected: `Success! The configuration is valid.`

- [ ] **Step 5: Commit**

```bash
git add infra/
git commit -m "infra: scaffold terraform project and state backend"
```

---

### Task 2: S3 site bucket

**Files:**

- Create: `infra/site_bucket.tf`

**Interfaces:**

- Consumes: `var.domain_name` from Task 1.
- Produces: `aws_s3_bucket.site.id` / `.arn`, consumed by Task 4 (CloudFront origin) and the `deploy.yml` workflow (Task 6).

- [ ] **Step 1: Write `infra/site_bucket.tf`**

```hcl
resource "aws_s3_bucket" "site" {
  bucket = replace(var.domain_name, ".", "-")
}

resource "aws_s3_bucket_versioning" "site" {
  bucket = aws_s3_bucket.site.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_lifecycle_configuration" "site" {
  bucket = aws_s3_bucket.site.id
  rule {
    id     = "expire-noncurrent-versions"
    status = "Enabled"
    noncurrent_version_expiration { noncurrent_days = 30 }
  }
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

- [ ] **Step 2: Verify**

Run: `terraform validate` (from `infra/`)
Expected: valid.

- [ ] **Step 3: Commit**

```bash
git add infra/site_bucket.tf
git commit -m "infra: add private versioned site bucket"
```

---

### Task 3: ACM certificate + Cloudflare DNS validation

**Files:**

- Create: `infra/certificate.tf`

**Interfaces:**

- Consumes: `var.domain_name`, `var.cloudflare_zone_id`.
- Produces: `aws_acm_certificate_validation.site.certificate_arn`, consumed by Task 4.

- [ ] **Step 1: Write `infra/certificate.tf`**

```hcl
resource "aws_acm_certificate" "site" {
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "cloudflare_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.site.domain_validation_options : dvo.domain_name => dvo
  }

  zone_id = var.cloudflare_zone_id
  name    = each.value.resource_record_name
  type    = each.value.resource_record_type
  content = each.value.resource_record_value
  ttl     = 60
  proxied = false
}

resource "aws_acm_certificate_validation" "site" {
  certificate_arn         = aws_acm_certificate.site.arn
  validation_record_fqdns = [for r in cloudflare_record.cert_validation : r.hostname]
}
```

- [ ] **Step 2: Verify**

Run: `terraform validate`
Expected: valid. (`terraform plan` at this point requires real `cloudflare_api_token`/`cloudflare_zone_id` values — confirm those are set in `terraform.tfvars` locally before the real apply in Task 8.)

- [ ] **Step 3: Commit**

```bash
git add infra/certificate.tf
git commit -m "infra: request ACM cert with Cloudflare DNS validation"
```

---

### Task 4: CloudFront distribution with OAC

**Files:**

- Create: `infra/cloudfront.tf`

**Interfaces:**

- Consumes: `aws_s3_bucket.site` (Task 2), `aws_acm_certificate_validation.site.certificate_arn` (Task 3), `var.domain_name`.
- Produces: `aws_cloudfront_distribution.site.id` / `.domain_name`, consumed by Task 5 (Cloudflare CNAME) and `deploy.yml` (invalidation).

- [ ] **Step 1: Write `infra/cloudfront.tf`**

```hcl
resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "resume-site-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  default_root_object = "index.html"
  aliases             = [var.domain_name]

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "s3-site"
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-site"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.site.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontOAC"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.site.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.site.arn
        }
      }
    }]
  })
}
```

- [ ] **Step 2: Verify**

Run: `terraform validate`
Expected: valid.

- [ ] **Step 3: Commit**

```bash
git add infra/cloudfront.tf
git commit -m "infra: add CloudFront distribution with OAC-secured S3 origin"
```

---

### Task 5: Cloudflare apex DNS record + budget alarm

**Files:**

- Create: `infra/dns.tf`
- Create: `infra/budget.tf`

**Interfaces:**

- Consumes: `aws_cloudfront_distribution.site.domain_name` (Task 4), `var.cloudflare_zone_id`, `var.domain_name`.

- [ ] **Step 1: Write `infra/dns.tf`**

```hcl
resource "cloudflare_record" "apex" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  type    = "CNAME"
  content = aws_cloudfront_distribution.site.domain_name
  proxied = false # DNS-only: avoid double-proxying through Cloudflare on top of CloudFront
  ttl     = 300
}
```

- [ ] **Step 2: Write `infra/budget.tf`**

```hcl
resource "aws_budgets_budget" "monthly_cap" {
  name         = "resume-site-monthly-cap"
  budget_type  = "COST"
  limit_amount = "1"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type              = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }
}
```

Add to `infra/variables.tf`:
```hcl
variable "budget_alert_email" {
  type = string
}
```

- [ ] **Step 3: Verify**

Run: `terraform validate`
Expected: valid.

- [ ] **Step 4: Commit**

```bash
git add infra/dns.tf infra/budget.tf infra/variables.tf
git commit -m "infra: add apex DNS record and $1 budget alarm"
```

---

### Task 6: GitHub OIDC provider + two IAM roles

**Files:**

- Create: `infra/oidc.tf`

**Interfaces:**

- Consumes: `var.github_repo`, `aws_s3_bucket.site.arn` (Task 2), `aws_cloudfront_distribution.site.arn` (Task 4).
- Produces: `aws_iam_role.deploy.arn` (used by `deploy.yml`), `aws_iam_role.terraform.arn` (used by `terraform.yml`).

- [ ] **Step 1: Write `infra/oidc.tf`**

```hcl
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "deploy_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:ref:refs/heads/main"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "resume-site-deploy"
  assume_role_policy = data.aws_iam_policy_document.deploy_trust.json
}

data "aws_iam_policy_document" "deploy_permissions" {
  statement {
    actions   = ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
    resources = [aws_s3_bucket.site.arn, "${aws_s3_bucket.site.arn}/*"]
  }
  statement {
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [aws_cloudfront_distribution.site.arn]
  }
}

resource "aws_iam_role_policy" "deploy" {
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy_permissions.json
}

data "aws_iam_policy_document" "terraform_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:environment:terraform-manual"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "terraform" {
  name               = "resume-site-terraform"
  assume_role_policy = data.aws_iam_policy_document.terraform_trust.json
}

# Broad-but-scoped: infra role manages exactly the resource types this stack uses.
resource "aws_iam_role_policy_attachment" "terraform_admin" {
  role       = aws_iam_role.terraform.id
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
}
```

**Note:** `PowerUserAccess` is broad by design here — the alternative is hand-maintaining a policy covering S3/CloudFront/ACM/Budgets/DynamoDB/IAM-role-self-management, which risks silently breaking `terraform apply` on future resource additions. Since this role can only be assumed via a manually-dispatched workflow gated by a GitHub Environment (Task 7), the tradeoff favors low-maintenance over minimal privilege. Revisit if this stack grows beyond a personal site.

- [ ] **Step 2: Verify**

Run: `terraform validate`
Expected: valid.

- [ ] **Step 3: Commit**

```bash
git add infra/oidc.tf
git commit -m "infra: add GitHub OIDC provider and deploy/terraform IAM roles"
```

---

### Task 7: GitHub Actions workflows

**Files:**

- Create: `.github/workflows/deploy.yml`
- Create: `.github/workflows/terraform.yml`

**Interfaces:**

- Consumes: `aws_iam_role.deploy.arn`, `aws_iam_role.terraform.arn` (Task 6, filled in as `AWS_DEPLOY_ROLE_ARN`/`AWS_TERRAFORM_ROLE_ARN` repo variables after first apply).

- [ ] **Step 1: Write `.github/workflows/deploy.yml`**

```yaml
name: Deploy site
on:
  push:
    branches: [main]

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run review
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}
          aws-region: us-east-1
      - run: |
          aws s3 sync . s3://${{ vars.SITE_BUCKET_NAME }} \
            --exclude ".git/*" --exclude "infra/*" --exclude "node_modules/*" \
            --exclude ".github/*" --exclude "docs/*" --exclude "scripts/*" \
            --exclude "test/*" --delete
      - run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ vars.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

- [ ] **Step 2: Write `.github/workflows/terraform.yml`**

```yaml
name: Terraform apply
on:
  workflow_dispatch: {}

permissions:
  id-token: write
  contents: read

jobs:
  terraform:
    runs-on: ubuntu-latest
    environment: terraform-manual
    defaults:
      run:
        working-directory: infra
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_TERRAFORM_ROLE_ARN }}
          aws-region: us-east-1
      - run: terraform init
      - run: terraform plan -out=tfplan
        env:
          TF_VAR_cloudflare_api_token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          TF_VAR_cloudflare_zone_id: ${{ vars.CLOUDFLARE_ZONE_ID }}
          TF_VAR_budget_alert_email: ${{ vars.BUDGET_ALERT_EMAIL }}
      - run: terraform apply tfplan
```

Note: the `environment: terraform-manual` name must match the `sub` condition in `infra/oidc.tf`'s `terraform_trust` policy. Configure this GitHub Environment with a required reviewer so `apply` needs manual approval even after dispatch.

- [ ] **Step 3: Verify**

Run a YAML lint (e.g. `npx yaml-lint .github/workflows/deploy.yml .github/workflows/terraform.yml` or push to a branch and check the Actions tab for parse errors).
Expected: no syntax errors reported.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml .github/workflows/terraform.yml
git commit -m "ci: add auto content-deploy and manual terraform-apply workflows"
```

---

### Task 8: First real apply + repo configuration + cutover

**Files:**

- Modify: `infra/terraform.tfvars` (untracked — local only, contains `cloudflare_api_token`)

- [ ] **Step 1: Fill in real `infra/terraform.tfvars`** (copy from `.example`, add real Cloudflare token/zone ID/email), confirm it's gitignored.

- [ ] **Step 2: Apply locally**

```bash
cd infra
terraform apply
```
Expected: S3 bucket, ACM cert (validated), CloudFront distribution, Cloudflare DNS record, IAM roles, budget alarm all created. Note `aws_iam_role.deploy.arn`, `aws_iam_role.terraform.arn`, `aws_s3_bucket.site.id`, `aws_cloudfront_distribution.site.id` from `terraform output`.

- [ ] **Step 3: Configure GitHub repo settings**

Set repo variables: `AWS_DEPLOY_ROLE_ARN`, `AWS_TERRAFORM_ROLE_ARN`, `SITE_BUCKET_NAME`, `CLOUDFRONT_DISTRIBUTION_ID`, `CLOUDFLARE_ZONE_ID`, `BUDGET_ALERT_EMAIL`. Set repo secret: `CLOUDFLARE_API_TOKEN`. Create the `terraform-manual` GitHub Environment with a required reviewer.

- [ ] **Step 4: Verify end-to-end**

Push a trivial change to `main`, confirm `deploy.yml` runs, confirm the site is reachable at `https://<domain_name>` with a valid cert.

- [ ] **Step 5: Delete the old deploy target**

```bash
git rm Dockerfile default.conf
git commit -m "chore: remove nginx/docker deploy target, superseded by S3+CloudFront"
```

- [ ] **Step 6: Verify**

Run: `npm run review`
Expected: all tests still pass (they assert HTML content, not the Dockerfile).
