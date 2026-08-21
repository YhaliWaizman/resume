# Repository Copilot Instructions Design

**Goal:** Give future Copilot sessions a compact, evidence-based guide to the
resume site's commands, architecture, and repository-specific conventions.

**Approach:** Add one root-level `.github/copilot-instructions.md` that
consolidates facts from `README.md`, `package.json`, the tests, the blog
generator, Terraform configuration, and the deployment workflow. Keep it
actionable and omit generic engineering advice, exhaustive listings, and
unsupported commands.

**Contents:**

- Exact Node commands for dependency installation, the full review suite, and
  each targeted test file.
- The static `site/` → private S3 → CloudFront delivery path and the
  GitHub Actions deployment trigger.
- Terraform's AWS/Cloudflare split, `us-east-1` requirements, S3 state
  backend, and GitHub OIDC role boundaries.
- Blog post frontmatter, generated-index workflow, and source-of-truth rules.

**Scope:** Only the instruction file and this design record are added. Existing
repository files and unrelated worktree changes are not modified.
