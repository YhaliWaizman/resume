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
    body: markdown.slice(match[0].length).replace(/^\n+/, ""),
  };
};

// ponytail: hand-rolled subset (headings, paragraphs, fenced code, bold/inline
// code) covers this blog's actual posts; swap for a real markdown lib (marked,
// remark) if posts start using tables/lists/nested structures.
const renderInline = (text) =>
  escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

const renderMarkdown = (markdown) => {
  // Split on fences first (atomic, may contain blank lines), then split the
  // remaining prose between fences into paragraphs/headings.
  const parts = markdown.trim().split(/(```\w*\n[\s\S]*?\n?```)/);
  return parts
    .flatMap((part) => {
      const fence = part.match(/^```(\w*)\n([\s\S]*?)\n?```$/);
      if (fence) {
        const [, lang, code] = fence;
        return lang === "mermaid"
          ? `<pre class="mermaid">${code}</pre>`
          : `<pre class="language-${lang || "text"}"><code>${escapeHtml(code)}</code></pre>`;
      }
      return part
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block) => {
          const heading = block.match(/^(#{1,3})\s+(.*)$/);
          if (heading) {
            const level = heading[1].length + 1; // offset: page h1 is the title
            return `<h${level}>${renderInline(heading[2])}</h${level}>`;
          }
          return `<p>${renderInline(block).replace(/\n/g, "<br>")}</p>`;
        });
    })
    .join("\n");
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

// Shared token system with blog.html/index.html: dark base, amber accent,
// JetBrains Mono for display type. Post pages reuse the same shell/nav.
const renderPostHtml = ({ title, date, slug, body }) => `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Yhali Weizman</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link
    href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap"
    rel="stylesheet">
  <style>
    :root { --base:#0f1216; --surface:#171b21; --surface-2:#1e242c; --border:#2a323d; --text:#d6dde5; --muted:#8c98a6; --accent:#ffb454; --radius:10px; --nav-w:232px; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--base); color:var(--text); font-family:"IBM Plex Sans",system-ui,sans-serif; font-size:16px; line-height:1.7; -webkit-font-smoothing:antialiased; }
    a, nav { font-family:"JetBrains Mono",ui-monospace,"SF Mono",Menlo,monospace; }
    a { color:var(--accent); text-decoration:none; }
    a:hover { text-decoration:underline; text-underline-offset:3px; }
    a:focus-visible { outline:2px solid var(--accent); outline-offset:3px; border-radius:3px; }
    .skip-link { position:absolute; left:-999px; top:0; background:var(--accent); color:#1a1205; padding:.6rem 1rem; font-weight:600; z-index:100; border-radius:0 0 var(--radius) 0; }
    .skip-link:focus { left:0; }
    .shell { display:flex; align-items:flex-start; min-height:100vh; }
    nav { position:sticky; top:0; width:var(--nav-w); height:100vh; flex-shrink:0; padding:2.4rem 1.4rem; border-right:1px solid var(--border); background:linear-gradient(180deg,var(--surface) 0%,var(--base) 100%); }
    nav ul { margin:0; padding:0; list-style:none; }
    nav a { display:block; padding:.5rem .7rem; border-left:2px solid transparent; border-radius:6px; color:var(--muted); font-size:.82rem; }
    nav a::before { content:"→ "; color:var(--border); }
    nav a:hover { background:var(--surface-2); color:var(--text); text-decoration:none; }
    nav a[aria-current="page"] { background:var(--surface-2); border-left-color:var(--accent); color:var(--accent); text-decoration:none; }
    main { width:min(100%,760px); margin:0 auto; padding:3.2rem clamp(1.2rem,5vw,3.5rem); }
    .back { display:inline-block; margin-bottom:1.6rem; color:var(--muted); font-size:.82rem; }
    .back:hover { color:var(--accent); }
    time.pubdate { display:block; color:var(--muted); font-size:.85rem; margin-bottom:.6rem; }
    h1 { font-family:"JetBrains Mono",monospace; letter-spacing:-1px; margin:0 0 1.6rem; font-size:clamp(1.8rem,6vw,2.8rem); line-height:1.15; }
    article h2, article h3 { font-family:"JetBrains Mono",monospace; color:var(--text); margin:2rem 0 .8rem; }
    article h2 { font-size:1.3rem; }
    article h3 { font-size:1.05rem; }
    article p { margin:0 0 1.2rem; color:var(--text); max-width:68ch; }
    article strong { color:var(--accent); font-weight:600; }
    article code { font-family:"JetBrains Mono",monospace; background:var(--surface-2); padding:.15em .4em; border-radius:4px; font-size:.9em; }
    article pre { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:1.2rem; overflow-x:auto; margin:0 0 1.4rem; }
    article pre code { background:none; padding:0; }
    article pre.mermaid { background:var(--surface); text-align:center; }
    @media (max-width:760px) {
      .shell { flex-direction:column; }
      nav { width:100%; height:auto; padding:.9rem 1rem; border-right:0; border-bottom:1px solid var(--border); background:rgba(15,18,22,.92); }
      nav ul { display:flex; gap:.3rem; }
      nav a { padding:.35rem .6rem; border-left:0; font-size:.76rem; }
      nav a::before { content:""; }
      main { padding:2.4rem 1.2rem; }
    }
  </style>
</head>

<body>
  <a href="#main" class="skip-link">Skip to content</a>

  <div class="shell">
    <nav aria-label="Site navigation">
      <ul>
        <li><a href="/">resume</a></li>
        <li><a href="/blog.html" aria-current="page">blog</a></li>
      </ul>
    </nav>

    <main id="main">
      <a class="back" href="/blog.html">&larr; all posts</a>
      <time class="pubdate" datetime="${date}">${date}</time>
      <h1>${escapeHtml(title)}</h1>
      <article>
${renderMarkdown(body)}
      </article>
    </main>
  </div>

  <script type="module">
    import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
    mermaid.initialize({
      startOnLoad: true,
      theme: "base",
      themeVariables: {
        background: "#0f1216",
        primaryColor: "#171b21",
        primaryTextColor: "#d6dde5",
        primaryBorderColor: "#ffb454",
        lineColor: "#ffb454",
        secondaryColor: "#1e242c",
        tertiaryColor: "#0f1216",
        fontFamily: "JetBrains Mono, monospace",
      },
    });
  </script>
</body>

</html>
`;

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
      const htmlFileName = fileName.replace(/\.md$/, ".html");
      writeFileSync(join(blogDir, htmlFileName), renderPostHtml(metadata), "utf8");
      return {
        title: metadata.title,
        date: metadata.date,
        fileName: htmlFileName,
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

if (require.main === module) main();

module.exports = { rebuildBlogHtml };
