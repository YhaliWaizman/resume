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
      values = [
        "repo:${var.github_repo}:ref:refs/heads/main",
        "repo:${var.github_repo_immutable}:ref:refs/heads/main",
      ]
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

data "aws_caller_identity" "current" {}

locals {
  # Same derivation as the site stack's aws_s3_bucket.site; the site bucket is
  # created by that stack, so reference it by ARN rather than by resource.
  site_bucket_arn = "arn:aws:s3:::${replace(var.domain_name, ".", "-")}"
}

data "aws_iam_policy_document" "deploy_permissions" {
  statement {
    actions   = ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
    resources = [local.site_bucket_arn, "${local.site_bucket_arn}/*"]
  }
  statement {
    actions = ["cloudfront:CreateInvalidation"]
    # ponytail: wildcard because the distribution is created by the site stack
    # after this one. Narrow to a distribution ID var if a second one appears.
    resources = ["arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/*"]
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "deploy-permissions"
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
      values = [
        "repo:${var.github_repo}:environment:terraform-manual",
        "repo:${var.github_repo_immutable}:environment:terraform-manual",
      ]
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
