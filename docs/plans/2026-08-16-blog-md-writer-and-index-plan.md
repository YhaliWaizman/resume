# Blog Markdown Writer + HTML Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an npm blog command that creates `blog/YYYY-MM-DD-slug.md` posts and regenerates `blog.html` from `blog/*.md`.

**Architecture:** Keep a dependency-free Node flow. A single script writes one markdown post and rebuilds `blog.html` from frontmatter metadata in all markdown files. The static nginx serving model stays unchanged: generated files are served directly.

**Tech Stack:** Node.js (built-in `fs`, `path`), `node:test`, HTML/CSS

## Global Constraints

- No new dependencies.
- Preserve static nginx site model.
- Keep changes focused to this feature.
- Markdown posts must be written under `blog/`.
- Generated markdown file name format must be `YYYY-MM-DD-slug.md`.
- Frontmatter fields must include `title`, `date`, and `slug`.
- `blog.html` must be regenerated from `blog/*.md` and show a title/date post list with links.
- If no posts exist, `blog.html` must keep the placeholder state.

---

### Task 1: Add failing tests for post creation and blog index regeneration

**Files:**

- Create: `test/blog-writer.test.js`
- Modify: `package.json`

**Interfaces:**

- Consumes: Node runtime and repository root files.
- Produces: Test contract for `scripts/new-blog-post.js` CLI behavior:
  - CLI call: `node scripts/new-blog-post.js "<title>" "<body>"`
  - Expected file output: `blog/YYYY-MM-DD-slug.md`
  - Expected index side-effect: regenerated `blog.html` with link list.

- [ ] **Step 1: Write the failing test**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, readFileSync, cpSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { execFileSync } = require("node:child_process");

test("creates markdown post and regenerates blog index", () => {
  const workdir = mkdtempSync(join(tmpdir(), "resume-blog-"));
  cpSync(join(__dirname, ".."), workdir, { recursive: true });

  execFileSync("node", ["scripts/new-blog-post.js", "Hello World", "Body line"], {
    cwd: workdir,
    stdio: "pipe",
  });

  const today = new Date().toISOString().slice(0, 10);
  const mdPath = join(workdir, "blog", `${today}-hello-world.md`);
  const md = readFileSync(mdPath, "utf8");
  const blogHtml = readFileSync(join(workdir, "blog.html"), "utf8");

  assert.match(md, /^---\n/);
  assert.match(md, /title: "Hello World"/);
  assert.match(md, new RegExp(`date: ${today}`));
  assert.match(md, /slug: hello-world/);
  assert.match(md, /Body line/);
  assert.match(blogHtml, new RegExp(`/blog/${today}-hello-world\\.md`));
  assert.match(blogHtml, /Hello World/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run review`
Expected: FAIL with missing `scripts/new-blog-post.js`.

- [ ] **Step 3: Add npm command wiring**

Update `package.json`:

```json
{
  "private": true,
  "scripts": {
    "review": "node --test",
    "blog": "node scripts/new-blog-post.js"
  }
}
```

- [ ] **Step 4: Run test to verify it still fails for implementation absence**

Run: `npm run review`
Expected: FAIL until CLI script exists and regenerates `blog.html`.

- [ ] **Step 5: Commit**

```bash
git add test/blog-writer.test.js package.json
git commit -m "test: define blog writer behavior"
```

### Task 2: Implement markdown writer and blog index generator

**Files:**

- Create: `scripts/new-blog-post.js`
- Modify: `blog.html`

**Interfaces:**

- Consumes:
  - CLI args: `process.argv[2]` title, `process.argv[3]` body.
  - Existing `blog.html` visual shell expectations.
- Produces:
  - Function `slugify(title: string): string`
  - Function `buildPostMarkdown({title,date,slug,body}): string`
  - Function `extractFrontmatter(md: string): { title: string, date: string, slug: string } | null`
  - Function `renderBlogHtml(posts: Array<{title:string,date:string,fileName:string}>): string`
  - CLI side effects: write markdown post and overwrite `blog.html`.

- [ ] **Step 1: Implement the minimal CLI with validation and write flow**

```js
const title = process.argv[2];
const body = process.argv[3];
if (!title || !body) {
  console.error('Usage: npm run blog -- "Title" "Body"');
  process.exit(1);
}
```

- [ ] **Step 2: Implement slug/date/path generation and markdown write**

```js
const date = new Date().toISOString().slice(0, 10);
const slug = slugify(title);
const fileName = `${date}-${slug}.md`;
const outDir = join(process.cwd(), "blog");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, fileName);
writeFileSync(outPath, markdown, { flag: "wx" });
```

- [ ] **Step 3: Implement blog index regeneration from `blog/*.md`**

```js
const files = readdirSync(outDir).filter((f) => f.endsWith(".md"));
const posts = files
  .map((fileName) => ({ fileName, fm: extractFrontmatter(readFileSync(join(outDir, fileName), "utf8")) }))
  .filter((x) => x.fm)
  .map((x) => ({ title: x.fm.title, date: x.fm.date, fileName: x.fileName }))
  .sort((a, b) => b.date.localeCompare(a.date));
writeFileSync(join(process.cwd(), "blog.html"), renderBlogHtml(posts));
```

- [ ] **Step 4: Render list with fallback placeholder**

```js
const listMarkup = posts.length
  ? posts.map((p) => `<li><a href="/blog/${p.fileName}">${escapeHtml(p.title)}</a> <span>${p.date}</span></li>`).join("\n")
  : `<article aria-labelledby="first-post"><span class="status">draft buffer</span><h2 id="first-post">First post coming soon.</h2><p>This space is reserved for the first entry.</p></article>`;
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npm run review`
Expected: PASS, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/new-blog-post.js blog.html
git commit -m "feat: generate blog markdown posts and html index"
```

### Task 3: Add targeted edge-case tests for CLI safety

**Files:**

- Modify: `test/blog-writer.test.js`

**Interfaces:**

- Consumes: Implemented CLI behavior from Task 2.
- Produces: Regression checks for:
  - missing args exits non-zero;
  - duplicate file write fails and does not overwrite.

- [ ] **Step 1: Add failing tests for missing args and duplicate path**

```js
test("fails with missing args", () => {
  assert.throws(() => execFileSync("node", ["scripts/new-blog-post.js"], { cwd: workdir, stdio: "pipe" }));
});

test("fails on duplicate post filename", () => {
  execFileSync("node", ["scripts/new-blog-post.js", "Hello World", "Body A"], { cwd: workdir, stdio: "pipe" });
  assert.throws(() => execFileSync("node", ["scripts/new-blog-post.js", "Hello World", "Body B"], { cwd: workdir, stdio: "pipe" }));
});
```

- [ ] **Step 2: Run test to verify failures are expected before code adjustments**

Run: `npm run review`
Expected: At least one FAIL (if duplicate/missing-arg behavior not yet strict).

- [ ] **Step 3: Implement minimal fixes in `scripts/new-blog-post.js`**

```js
if (!title || !body) process.exit(1);
writeFileSync(outPath, markdown, { flag: "wx" });
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run review`
Expected: PASS, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add test/blog-writer.test.js scripts/new-blog-post.js
git commit -m "test: cover blog writer cli edge cases"
```
