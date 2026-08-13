# Blog Section Design

## Goal

Add a separate blog page to the existing static resume site, reachable from
the resume navigation, with one clearly marked placeholder for the author's
first post.

## Approach

Keep the current static nginx architecture. Add `blog.html` as a standalone
page using the resume's typography, colors, navigation, responsive layout,
and accessibility conventions. Add a `blog` link to the existing navigation
and copy the new page into the nginx image.

This avoids a site generator, JavaScript routing, dependencies, and a
shared-style refactor. Those become worthwhile only if the site grows beyond
two independently maintained pages.

## Page Content

- The page title and metadata identify it as Yhali Weizman's blog.
- The sidebar retains the existing brand and links back to the resume.
- The blog link is marked as the current page.
- The main content introduces the blog and contains one placeholder article
  stating that the first entry is coming soon.
- The page remains usable on mobile and with keyboard navigation.

## Delivery

The existing Dockerfile copies `blog.html` to
`/usr/share/nginx/html/blog.html`. nginx serves it at `/blog.html` without
additional routing or runtime error handling.

## Validation

The repository review command checks that both pages exist, the resume links
to `/blog.html`, the blog contains its placeholder, and the Dockerfile ships
the new page.
