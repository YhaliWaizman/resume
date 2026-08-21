const { mkdirSync, readdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const usage = 'Usage: npm run blog -- "Title" "Body"';

const slugify = (input) =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

const unquote = (value) => value.replace(/^"(.*)"$/, "$1");

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const buildPostMarkdown = ({ title, date, slug, body }) =>
  `---\ntitle: "${title.replaceAll('"', '\\"')}"\ndate: ${date}\nslug: ${slug}\n---\n\n${body}\n`;

const extractFrontmatter = (markdown) => {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const lines = match[1].split("\n");
  const map = {};
  for (const line of lines) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    map[key] = value;
  }

  if (!map.title || !map.date || !map.slug) return null;
  return {
    title: unquote(map.title),
    date: map.date,
    slug: map.slug,
  };
};

const renderBlogHtml = (posts) => {
  const postsMarkup = posts.length
    ? `<ul class="posts">\n${posts
        .map(
          (post) =>
            `          <li><a href="/blog/${post.fileName}">${escapeHtml(post.title)}</a> <time datetime="${post.date}">${post.date}</time></li>`,
        )
        .join("\n")}\n        </ul>`
    : `        <article aria-labelledby="first-post">\n          <span class="status">draft buffer</span>\n          <h2 id="first-post">First post coming soon.</h2>\n          <p>This space is reserved for the first entry.</p>\n        </article>`;

  return `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog - Yhali Weizman</title>
  <meta name="description" content="Notes from Yhali Weizman on DevOps, data platforms, and AI infrastructure.">
  <style>
    :root { --base:#0f1216; --surface:#171b21; --border:#2a323d; --text:#d6dde5; --muted:#8c98a6; --accent:#ffb454; --radius:10px; --nav-w:232px; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--base); color:var(--text); font-family:system-ui,sans-serif; line-height:1.65; }
    a { color:var(--accent); text-decoration:none; }
    a:hover { text-decoration:underline; text-underline-offset:3px; }
    .shell { display:flex; align-items:flex-start; min-height:100vh; }
    nav { position:sticky; top:0; width:var(--nav-w); height:100vh; flex-shrink:0; padding:2.4rem 1.4rem; border-right:1px solid var(--border); background:linear-gradient(180deg,var(--surface) 0%,var(--base) 100%); }
    nav ul { margin:0; padding:0; list-style:none; }
    nav a { display:block; padding:.5rem .7rem; border-left:2px solid transparent; border-radius:6px; color:var(--muted); font-size:.82rem; }
    nav a[aria-current="page"] { background:var(--surface); border-left-color:var(--accent); color:var(--accent); }
    main { width:min(100%,820px); margin:0 auto; padding:3.2rem clamp(1.2rem,5vw,3.5rem); }
    h1 { margin:0 0 1rem; font-size:clamp(2rem,7vw,3.6rem); line-height:1.1; }
    .posts { margin:0; padding-left:1.1rem; }
    .posts li { margin:.6rem 0; }
    time { color:var(--muted); margin-left:.5rem; font-size:.9rem; }
    article { padding:1.6rem; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface); }
    .status { color:var(--accent); font-size:.75rem; text-transform:uppercase; letter-spacing:.08em; }
    @media (max-width:760px) { .shell { flex-direction:column; } nav { width:100%; height:auto; padding:.9rem 1rem; border-right:0; border-bottom:1px solid var(--border); } }
  </style>
</head>

<body>
  <div class="shell">
    <nav aria-label="Site navigation">
      <ul>
        <li><a href="/">resume</a></li>
        <li><a href="/blog.html" aria-current="page">blog</a></li>
      </ul>
    </nav>

    <main id="main">
      <h1>Blog</h1>
${postsMarkup}
    </main>
  </div>
</body>

</html>
`;
};

const rebuildBlogHtml = (cwd) => {
  const blogDir = join(cwd, "site", "blog");
  const files = readdirSync(blogDir).filter((fileName) => fileName.endsWith(".md"));
  const posts = files
    .map((fileName) => {
      const markdown = readFileSync(join(blogDir, fileName), "utf8");
      const metadata = extractFrontmatter(markdown);
      if (!metadata) {
        console.warn(`Skipping ${fileName}: invalid frontmatter`);
        return null;
      }
      return {
        title: metadata.title,
        date: metadata.date,
        fileName,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date));

  writeFileSync(join(cwd, "site", "blog.html"), renderBlogHtml(posts), "utf8");
};

const main = () => {
  const title = process.argv[2];
  const body = process.argv[3];

  if (!title || !body) {
    console.error(usage);
    process.exit(1);
  }

  const slug = slugify(title);
  if (!slug) {
    console.error("Title must include at least one letter or number.");
    process.exit(1);
  }

  const date = new Date().toISOString().slice(0, 10);
  const cwd = process.cwd();
  const blogDir = join(cwd, "site", "blog");
  const fileName = `${date}-${slug}.md`;
  const postPath = join(blogDir, fileName);
  const markdown = buildPostMarkdown({ title, date, slug, body });

  mkdirSync(blogDir, { recursive: true });

  try {
    writeFileSync(postPath, markdown, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (error && error.code === "EEXIST") {
      console.error(`Post already exists: ${postPath}`);
      process.exit(1);
    }
    throw error;
  }

  rebuildBlogHtml(cwd);
};

main();
