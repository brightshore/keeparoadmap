import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../build.mjs";
import { readExternalLinks } from "../scripts/external-links.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = build();
const html = readFileSync(join(dist, "index.html"), "utf8");
const example = readFileSync(join(root, "examples", "ROADMAP.md"), "utf8");

const attrValues = (name) =>
  [...html.matchAll(new RegExp(`\\s${name}="([^"]*)"`, "g"))].map((m) => m[1]);
const ids = new Set(attrValues("id"));
const links = [...attrValues("href"), ...attrValues("src")];

test("the build writes the page and the files it links to", () => {
  for (const file of ["index.html", "style.css", "favicon.svg", "CREDITS.md", "examples/ROADMAP.md"]) {
    assert.ok(existsSync(join(dist, file)), `dist/${file} is missing`);
  }
});

test("every in-page anchor points at an id on the page", () => {
  const anchors = links.filter((href) => href.startsWith("#"));
  assert.ok(anchors.length > 0);
  for (const href of anchors) {
    assert.ok(ids.has(href.slice(1)), `${href} has no matching id`);
  }
});

test("ids are unique", () => {
  const all = attrValues("id");
  assert.equal(all.length, ids.size, "duplicate id on the page");
});

test("every relative link resolves to a file in dist/", () => {
  const relative = links.filter((href) => !href.startsWith("#") && !/^[a-z]+:/i.test(href));
  assert.ok(relative.length > 0);
  for (const href of relative) {
    const [path, fragment] = href.split("#");
    assert.ok(existsSync(join(dist, path)), `${href} does not resolve in dist/`);
    if (fragment) assert.ok(ids.has(fragment), `${href} fragment not found`);
  }
});

test("every external link is on the checked list, and the list has no stale entries", () => {
  const external = new Set(links.filter((href) => /^https?:/i.test(href)));
  const listed = new Set(readExternalLinks().map((entry) => entry.url));
  const unlisted = [...external].filter((url) => !listed.has(url));
  const stale = [...listed].filter((url) => !external.has(url));
  assert.deepEqual(unlisted, [], "add these to scripts/external-links.txt and check them");
  assert.deepEqual(stale, [], "these are listed but no longer on the page");
});

test("the page embeds examples/ROADMAP.md exactly", () => {
  const embedded = html.match(/<pre class="example"[^>]*><code>([\s\S]*?)<\/code><\/pre>/);
  assert.ok(embedded, "example block not found");
  const decoded = embedded[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  assert.equal(decoded, example.trimEnd());
});

test("the page is readable without JavaScript and has basic accessible structure", () => {
  assert.doesNotMatch(html, /<script/i, "the page should not need scripts");
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /<meta name="viewport"/);
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, "exactly one h1");
  assert.match(html, /<main[\s>]/);
  const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
  levels.reduce((prev, level) => {
    assert.ok(level <= prev + 1, `heading jumps from h${prev} to h${level}`);
    return level;
  });
  for (const img of html.match(/<img\b[^>]*>/g) ?? []) {
    assert.match(img, /\salt="/, `image without alt: ${img}`);
  }
});

test("the stylesheet has a dark color scheme", () => {
  const css = readFileSync(join(dist, "style.css"), "utf8");
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
});

test("the example follows the format it demonstrates", () => {
  const lines = example.split("\n");
  assert.equal(lines[0], "# Roadmap");
  assert.match(example, /^Last reviewed: \d{4}-\d{2}-\d{2}$/m);
  const sections = lines.filter((line) => line.startsWith("## "));
  assert.deepEqual(sections, ["## Now", "## Next", "## Later", "## Not planned"]);

  const items = example.match(/^- \*\*[^*]+\*\*[\s\S]*?(?=^- |^## |^\[|(?![\s\S]))/gm);
  assert.ok(items.length > 0);
  for (const item of items) {
    assert.match(item, /\[#\d+\]\s*$/, `item has no tracker link: ${item.slice(0, 40)}`);
  }
  for (const [, ref] of example.matchAll(/\[(#\d+)\](?!:)/g)) {
    assert.match(example, new RegExp(`^\\[${ref}\\]: https://`, "m"), `${ref} has no link definition`);
  }
});
