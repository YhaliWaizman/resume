const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const read = (filename) => readFileSync(join(__dirname, "..", filename), "utf8");

test("ships the published migration post in the blog index", () => {
  const resume = read("site/index.html");
  const blog = read("site/blog.html");

  assert.match(resume, /href="\/blog\.html"/);
  assert.match(blog, /<title>Blog - Yhali Weizman<\/title>/);
  assert.match(blog, /href="\/blog\/2026-08-21-my-resume-site-outgrew-my-homelab\.md"/);
  assert.match(blog, /My Resume Site Outgrew My Homelab/);
  assert.match(blog, /aria-current="page"/);
});
