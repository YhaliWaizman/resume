const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const read = (filename) => readFileSync(join(__dirname, "..", filename), "utf8");

test("ships a linked blog placeholder", () => {
  const resume = read("site/index.html");
  const blog = read("site/blog.html");

  assert.match(resume, /href="\/blog\.html"/);
  assert.match(blog, /<title>Blog - Yhali Weizman<\/title>/);
  assert.match(blog, /First post coming soon\./);
  assert.match(blog, /aria-current="page"/);
});
