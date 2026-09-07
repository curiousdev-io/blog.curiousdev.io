#!/usr/bin/env node
// Verify that every blog post touched by this change actually produced a page.
//
// `docusaurus build` exits 0 even when a post is silently dropped. The usual
// cause is a date in the future -- Docusaurus excludes those by default -- and
// on a blog whose filenames carry the date, a typo in the date is easy to make
// and invisible until someone notices the post never appeared.
//
// Env: BASE_SHA / HEAD_SHA to check only what changed. Without them, every post
// is checked.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const BUILD_DIR = "build";
const BLOG_DIR = "blog";
const POST_RE = /^blog\/[^/]+\.mdx?$/;

function changedPosts() {
  const { BASE_SHA, HEAD_SHA } = process.env;
  if (!BASE_SHA || !HEAD_SHA) return null;
  try {
    const out = execFileSync(
      "git",
      ["diff", "--name-only", "--diff-filter=AM", BASE_SHA, HEAD_SHA],
      { encoding: "utf8" },
    );
    return out.split("\n").filter((f) => POST_RE.test(f));
  } catch {
    // Shallow clone, force-push, or a missing base: fall back to checking all.
    return null;
  }
}

function allPosts() {
  return readdirSync(BLOG_DIR)
    .filter((f) => /\.mdx?$/.test(f))
    .map((f) => path.join(BLOG_DIR, f));
}

function frontmatter(file) {
  const text = readFileSync(file, "utf8");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return fields;
}

// routeBasePath is '/', so /<slug> is emitted as build/<slug>.html
function expectedSlug(file, fm) {
  if (fm.slug) return fm.slug.replace(/^\/+/, "");
  return path.basename(file).replace(/\.mdx?$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");
}

function postDate(file, fm) {
  if (fm.date) return new Date(fm.date);
  const m = path.basename(file).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? new Date(`${m[1]}T00:00:00Z`) : null;
}

if (!existsSync(BUILD_DIR)) {
  console.error(`No ${BUILD_DIR}/ directory. Run the build before this check.`);
  process.exit(1);
}

const scoped = changedPosts();
const posts = scoped ?? allPosts();
console.log(
  scoped
    ? `Checking ${posts.length} changed post(s).`
    : `No diff range available; checking all ${posts.length} posts.`,
);

const failures = [];
let checked = 0;

for (const file of posts) {
  if (!existsSync(file)) continue; // renamed away within the range
  const fm = frontmatter(file);

  if (fm.draft === "true" || fm.unlisted === "true") {
    console.log(`- ${file}: skipped (${fm.draft === "true" ? "draft" : "unlisted"})`);
    continue;
  }

  const slug = expectedSlug(file, fm);
  const page = path.join(BUILD_DIR, `${slug}.html`);
  checked++;

  if (!existsSync(page)) {
    const date = postDate(file, fm);
    const future = date && date.getTime() > Date.now();
    failures.push(
      `${file}\n    expected ${page} -- not generated` +
        (future
          ? `\n    its date (${date.toISOString().slice(0, 10)}) is in the future, ` +
            `which Docusaurus excludes by default`
          : `\n    check the 'slug' in the front matter`),
    );
    continue;
  }

  // A page that exists but is nearly empty means the post body did not render.
  const bytes = statSync(page).size;
  if (bytes < 2048) {
    failures.push(`${file}\n    ${page} is only ${bytes} bytes -- the body may not have rendered`);
    continue;
  }

  console.log(`- ${file} -> /${slug} (${(bytes / 1024).toFixed(0)} KB)`);
}

if (failures.length) {
  console.error(`\nPage generation failed for ${failures.length} post(s):\n`);
  for (const f of failures) console.error(`  ${f}\n`);
  process.exit(1);
}

console.log(`\nAll ${checked} post(s) generated a page.`);
