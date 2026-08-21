const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { existsSync, mkdtempSync, readFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");

const repoRoot = join(__dirname, "..");
const scriptPath = join(repoRoot, "scripts", "new-blog-post.js");

const runBlogScript = (cwd, ...args) =>
  execFileSync("node", [scriptPath, ...args], {
    cwd,
    stdio: "pipe",
  });

test("creates markdown post and regenerates blog index", () => {
  const workdir = mkdtempSync(join(tmpdir(), "resume-blog-"));

  runBlogScript(workdir, "Hello World", "Body line");

  const today = new Date().toISOString().slice(0, 10);
  const fileName = `${today}-hello-world.md`;
  const postPath = join(workdir, "blog", fileName);

  assert.equal(existsSync(postPath), true);

  const post = readFileSync(postPath, "utf8");
  assert.match(post, /^---\n/);
  assert.match(post, /title: "Hello World"/);
  assert.match(post, new RegExp(`date: ${today}`));
  assert.match(post, /slug: hello-world/);
  assert.match(post, /Body line/);

  const blogHtml = readFileSync(join(workdir, "blog.html"), "utf8");
  assert.match(blogHtml, /<h1>Blog<\/h1>/);
  assert.match(blogHtml, new RegExp(`/blog/${fileName}`));
  assert.match(blogHtml, /Hello World/);
  assert.match(blogHtml, new RegExp(`<time datetime="${today}">${today}<\\/time>`));
});

test("fails with missing arguments", () => {
  const workdir = mkdtempSync(join(tmpdir(), "resume-blog-"));
  assert.throws(() => runBlogScript(workdir), /Usage:/);
});

test("fails on duplicate post filename", () => {
  const workdir = mkdtempSync(join(tmpdir(), "resume-blog-"));
  runBlogScript(workdir, "Hello World", "Body A");
  assert.throws(() => runBlogScript(workdir, "Hello World", "Body B"), /already exists|EEXIST/);
});
