# Blog Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate blog page with a first-entry placeholder and a button-like navigation link from the resume.

**Architecture:** Preserve the static nginx site. `blog.html` is a standalone page, `resume.html` links to it, and the Docker image copies both files; Node's built-in test runner verifies the wiring without dependencies.

**Tech Stack:** HTML, CSS, nginx, Node.js built-in test runner

## Global Constraints

- Keep the current static nginx architecture.
- Add no runtime framework, site generator, JavaScript router, or dependency.
- Reuse the resume's typography, colors, responsive layout, and accessibility conventions.
- Serve the new page at `/blog.html`.

---

### Task 1: Add and ship the blog page

**Files:**

- Create: `package.json`
- Create: `test/blog.test.js`
- Create: `blog.html`
- Modify: `resume.html:529-535`
- Modify: `Dockerfile:3-7`

**Interfaces:**

- Consumes: nginx's existing `/usr/share/nginx/html` static document root.
- Produces: `/blog.html`, linked from the resume and included in the Docker image.

- [ ] **Step 1: Write the failing site-wiring test**

Create `package.json` with a dependency-free review command:

```json
{
  "private": true,
  "scripts": {
    "review": "node --test"
  }
}
```

Create `test/blog.test.js` using `node:test`, `node:assert/strict`, and
`node:fs` to assert:

```js
test("ships a linked blog placeholder", () => {
  assert.match(resume, /href="\/blog\.html"/);
  assert.match(blog, /<title>Blog - Yhali Weizman<\/title>/);
  assert.match(blog, /First post coming soon\./);
  assert.match(blog, /aria-current="page"/);
  assert.match(dockerfile, /COPY blog\.html \/usr\/share\/nginx\/html\/blog\.html/);
});
```

- [ ] **Step 2: Run the review to verify it fails**

Run: `npm run review`

Expected: FAIL because `blog.html` does not exist.

- [ ] **Step 3: Add the minimal static implementation**

Add `<li><a href="/blog.html">blog</a></li>` to the resume navigation.

Create `blog.html` with:

- the resume page's font imports and CSS variables;
- the same sidebar brand and responsive breakpoint;
- a `resume` link to `/` and a `blog` link with `aria-current="page"`;
- a main heading, short introduction, and semantic `<article>`;
- the exact placeholder sentence `First post coming soon.`;
- the existing skip-link, focus, reduced-motion, and mobile conventions.

Add this Dockerfile line after the resume copy:

```dockerfile
COPY blog.html /usr/share/nginx/html/blog.html
```

- [ ] **Step 4: Run the review to verify it passes**

Run: `npm run review`

Expected: one passing test and exit code 0.

- [ ] **Step 5: Commit**

```bash
git add package.json test/blog.test.js blog.html resume.html Dockerfile
git commit -m "feat: add blog page"
```
