# S3 + CloudFront Migration Design

## Goal

Move the static resume/blog site off the local Docker/nginx setup onto AWS
S3 + CloudFront with a real TLS certificate on the custom domain, and add a
GitHub Actions pipeline that deploys content on every push to `main`. Single
environment only — no dev/staging.

## Current state

- `Dockerfile` builds an `nginx:alpine` image that copies `resume.html` (as
  `index.html`), `blog.html`, and the `blog/` directory into
  `/usr/share/nginx/html`, with `default.conf` serving `yhali-waizman.com`.
- All URLs are flat files — no nested directories, no pretty-URL routing.
  `blog.html` links to individual post files under `/blog/`.
- DNS is hosted on Cloudflare.
- Tests run via `npm run review` (`node --test`).

## Target architecture

```
Cloudflare DNS (grey-cloud / DNS-only)
        │  apex CNAME → CloudFront distribution domain
        ▼
CloudFront distribution (TLS via ACM cert, us-east-1)
        │  Origin Access Control (OAC)
        ▼
S3 bucket (private, versioned, static site content)
```

- **DNS**: stays on Cloudflare. No Route53 hosted zone. Apex record points
  at the CloudFront distribution domain, proxy status set to DNS-only (grey
  cloud) so CloudFront alone terminates TLS and caches — avoids double
  proxying.
- **Certificate**: ACM certificate requested in `us-east-1` (CloudFront
  requirement), DNS-validated via a CNAME record created in Cloudflare.
  Auto-renews as long as that CNAME remains.
- **S3 bucket**: private (no public access), versioning enabled, lifecycle
  rule expires noncurrent versions after 30 days. Content only — no static
  website hosting endpoint (CloudFront + OAC reads the bucket directly).
- **CloudFront**: default root object `index.html`; no Lambda@Edge/Functions
  needed since there is no directory-style routing to rewrite. One
  distribution, one origin.
- **Docker/nginx**: `Dockerfile` and `default.conf` are deleted; no longer
  the deploy target.

## CI/CD

Two independent GitHub Actions workflows, each authenticating via its own
OIDC role (no long-lived AWS keys stored anywhere):

### 1. `deploy.yml` — automatic, content only

- Trigger: push to `main`.
- Steps: checkout → `npm ci` → `npm run review` (must pass) → `aws s3 sync`
  the site files to the bucket → `aws cloudfront create-invalidation
  --paths "/*"`.
- IAM role trust policy scoped to
  `repo:<owner>/resume:ref:refs/heads/main`.
- Permissions: `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket` on the
  site bucket only; `cloudfront:CreateInvalidation` on the one
  distribution only. No IAM, no Terraform state bucket access.

### 2. `terraform.yml` — manual only

- Trigger: `workflow_dispatch` (no automatic trigger).
- Steps: checkout → `terraform init` (S3+DynamoDB backend) → `terraform
  plan` → `terraform apply` (manual approval via GitHub environment
  protection rule, or plan output reviewed before dispatching apply).
- IAM role trust policy scoped to the same repo but not restricted to a
  push event — invoked explicitly by a human via the Actions UI.
- Permissions: broader — manages the S3 bucket, CloudFront distribution,
  ACM certificate, budget alarm, and the Terraform state
  bucket/DynamoDB table themselves.

### Bootstrapping (one-time, manual, outside Terraform-in-CI)

The GitHub OIDC identity provider and the two IAM roles above must exist
before either workflow can run. Since Terraform needs an IAM role to run
in CI, and that role doesn't exist yet, the first `terraform apply` — which
creates the OIDC provider, both IAM roles, the state backend bucket, and
the DynamoDB lock table — is run **locally**, once, using the operator's
own AWS credentials. After that, `terraform.yml` takes over for all future
infra changes.

## Terraform state

- Backend: a dedicated S3 bucket (versioned) + DynamoDB table for locking,
  created during the manual bootstrap step above.
- All infrastructure (S3 site bucket, CloudFront distribution, ACM
  certificate, IAM OIDC provider + roles, budget alarm) defined as
  Terraform resources in this repo.

## Cost controls

- AWS Budgets alarm at $1/month threshold, notifying via email/SNS.
- S3 versioning + 30-day noncurrent-version expiry keeps storage cost
  negligible.
- CloudFront full-path invalidations stay within the 1,000 free
  paths/month tier for this traffic volume.
- No Route53 hosted zone (saves $0.50/month; DNS stays on Cloudflare).

## Rollback

- Bad content push: `git revert` on `main` re-triggers `deploy.yml`, or
  restore a previous S3 object version directly via `aws s3api
  copy-object` while the revert lands.
- Bad infra change: `terraform apply` is manual and plan-reviewed, so a
  bad change requires deliberately dispatching it; recovery is a
  corrective Terraform change via the same manual workflow.

## Out of scope

- Fixing the existing `blog.html` → raw `.md` file link (pre-existing gap,
  unrelated to this migration).
- Moving DNS to Route53.
- Multi-environment (dev/staging) setups.
