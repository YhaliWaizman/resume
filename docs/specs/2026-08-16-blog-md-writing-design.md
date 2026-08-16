# Blog Markdown Writing + Listing Design

## Goal
Add blog-authoring functionality so writing a post creates a new markdown file in `blog/`, and `blog.html` is regenerated from those markdown posts.

## Scope
- In scope:
  - New post command via npm script.
  - Create `blog/YYYY-MM-DD-slug.md`.
  - Regenerate `blog.html` from `blog/*.md` as title/date link list.
  - Keep placeholder when no posts exist.
  - Automated tests for write + regenerate behavior.
- Out of scope:
  - Full markdown-to-HTML rendering.
  - Runtime server logic or new dependencies.

## Architecture
Use a single Node script (`scripts/new-blog-post.js`) as the source of truth for both actions:
1. Create one markdown post file.
2. Rebuild `blog.html` from existing markdown posts.

This keeps behavior centralized and avoids adding frameworks or extra tooling.

## Components
1. **CLI entrypoint (`scripts/new-blog-post.js`)**
   - Inputs: title, body.
   - Validates required args.
   - Builds date + slug.
   - Writes markdown file and fails on duplicate path.
   - Calls blog index regeneration.

2. **Markdown post format**
   - File path: `blog/YYYY-MM-DD-slug.md`.
   - Frontmatter:
     - `title`
     - `date` (YYYY-MM-DD)
     - `slug`
   - Body follows frontmatter.

3. **Blog index regeneration**
   - Scans `blog/*.md`.
   - Reads frontmatter fields.
   - Sorts posts by date descending.
   - Rewrites `blog.html` with existing page shell and a posts list section:
     - link target: `/blog/<filename>.md`
     - visible metadata: title + date
   - If no posts found, render existing placeholder text.

## Data Flow
1. User runs:
   - `npm run blog -- "Post Title" "Post body"`
2. Script validates input.
3. Script creates the markdown file in `blog/`.
4. Script scans all markdown posts and regenerates `blog.html`.
5. Test suite verifies output files/content.

## Error Handling
- Missing title/body: exit non-zero with clear usage message.
- Duplicate output file: exit non-zero; do not overwrite.
- Invalid/partial frontmatter in scanned files: skip file with warning to stderr (keeps generation resilient).

## Testing
- Add `node:test` test file that:
  - Runs script in a temp repo copy/workspace.
  - Asserts markdown file creation path and frontmatter/body.
  - Asserts `blog.html` is regenerated with a link containing created filename and post title/date.
  - Asserts empty-state placeholder behavior when no posts exist.

## Constraints
- No new dependencies.
- Preserve static nginx site model.
- Keep changes focused to this feature.
