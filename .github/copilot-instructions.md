# Repository Instructions

## Commands

Run these from the repository root:

```sh
npm ci
npm run review
node --test test/blog.test.js
node --test test/blog-writer.test.js
npm run blog -- "Post title" "Post body"
```

`npm run review` is the complete automated check (`node --test`). There is no
separate build or lint script. For infrastructure-only changes, run Terraform
from `infra/`:

```sh
terraform fmt -check
terraform init
terraform validate
terraform plan
```

Do not run `terraform apply` unless the change is explicitly intended to
modify the AWS or Cloudflare account.

## Architecture

This is a static resume/blog site. Visitor-facing files are source-controlled
under `site/` and are synchronized to a private S3 bucket by
`.github/workflows/deploy.yml` after pushes to `main`. CloudFront serves the
bucket through an Origin Access Control; visitors use the configured domain
over HTTPS.

`infra/` provisions the AWS hosting stack and Cloudflare DNS records:

- S3 stores versioned site objects and blocks public access.
- CloudFront provides the public distribution and cache invalidation.
- ACM issues the certificate; certificate validation and the apex DNS record
  are managed in Cloudflare.
- GitHub Actions assumes an AWS deploy role through GitHub OIDC.
- A separate Terraform role and S3 backend are used for infrastructure state.

The bootstrap stack in `infra/bootstrap/` creates the Terraform state bucket
and all IAM resources (the GitHub OIDC provider, the deploy role, and the
Terraform role). IAM lives there so the CI Terraform role needs no IAM
permissions of its own. Run bootstrap manually with admin credentials.
CloudFront and ACM must remain in `us-east-1`.

## Repository Conventions

- Edit published HTML/assets in `site/`; deployment syncs that directory with
  `--delete`, so files outside it are not published.
- Create blog posts with `npm run blog -- "Title" "Body"`. The script writes
  `site/blog/YYYY-MM-DD-slug.md` and regenerates `site/blog.html`; do not
  hand-edit the generated index.
- Blog markdown uses frontmatter containing `title`, `date`, and `slug`.
  Invalid-frontmatter files are skipped when rebuilding the index.
- The workflow deploys only from `main`, uses Node.js 24, and invalidates all
  CloudFront paths after syncing.
- Keep the S3 bucket private. CloudFront is the allowed read path; do not add
  public bucket access.
- Terraform provider credentials and `infra/terraform.tfvars` are local or
  CI-managed secrets. Use `infra/terraform.tfvars.example` as the variable
  shape, not as a credentials file.
- OIDC trust conditions retain both the repository-name subject and the
  immutable owner/repository-ID subject. Preserve both when changing
  `infra/bootstrap/iam.tf`.
- Cloudflare records used by this stack are DNS-only (`proxied = false`) so
  Cloudflare does not proxy traffic on top of CloudFront.
