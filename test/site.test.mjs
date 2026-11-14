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
  for (const file of ["index.html", "style.css", "favicon.svg", "CREDITS.md", "LICENSE", "examples/ROADMAP.md"]) {
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

// The layout rules from the page, as a checker. Returns a list of problems.
function checkRoadmap(text) {
  const problems = [];
  const lines = text.split("\n");
  if (lines[0] !== "# Roadmap") problems.push("first line is not '# Roadmap'");
  if (!/^Last reviewed: \d{4}-\d{2}-\d{2}$/m.test(text)) problems.push("no 'Last reviewed: YYYY-MM-DD' line");
  if (!/^This roadmap follows \[Keep a Roadmap \d+\.\d+\.\d+\]\(https:\/\/keeparoadmap\.com\/\)\.$/m.test(text)) {
    problems.push("no version line");
  }

  // The optional Tracker line: at most one, a single link, in its own paragraph straight after Last reviewed.
  const trackerLines = lines.filter((line) => /^Tracker:/.test(line));
  if (trackerLines.length > 1) problems.push("more than one Tracker line");
  for (const line of trackerLines) {
    if (!/^Tracker: \[[^\]]+\]\(https:\/\/[^\s)]+\)$/.test(line)) problems.push(`Tracker line is not one link: ${line}`);
  }
  if (trackerLines.length > 0) {
    const reviewed = lines.findIndex((line) => line.startsWith("Last reviewed:"));
    const tracker = lines.indexOf(trackerLines[0]);
    if (reviewed < 0 || lines[reviewed + 1] !== "" || tracker !== reviewed + 2) {
      problems.push("Tracker line is not its own paragraph straight after Last reviewed");
    }
  }

  const sections = lines.filter((line) => /^## /.test(line));
  const required = ["## Now", "## Next", "## Later"];
  const allowed = [required, [...required, "## Not planned"]];
  if (!allowed.some((list) => JSON.stringify(list) === JSON.stringify(sections))) {
    problems.push(`sections are ${JSON.stringify(sections)}`);
  }
  const firstSection = lines.findIndex((line) => line.startsWith("## "));
  lines.forEach((line, i) => {
    if (/^#{3,} /.test(line) && !/^### \S/.test(line)) problems.push(`subheading deeper than ###: ${line}`);
    if (/^### /.test(line) && (firstSection < 0 || i < firstSection)) problems.push(`subheading outside a section: ${line}`);
  });

  const items = text.match(/^- \*\*[^*]+\*\*[\s\S]*?(?=^- |^#{2,} |^\[|(?![\s\S]))/gm) ?? [];
  if (items.length === 0) problems.push("no items");
  for (const item of items) {
    if (!/\[#\d+\]\s*$/.test(item)) problems.push(`item has no tracker link: ${item.slice(0, 40)}`);
  }
  for (const [, ref] of text.matchAll(/\[(#\d+)\](?!:)/g)) {
    if (!new RegExp(`^\\[${ref}\\]: https://`, "m").test(text)) problems.push(`${ref} has no link definition`);
  }
  return problems;
}

const minimal = [
  "# Roadmap",
  "",
  "Last reviewed: 2026-11-14",
  "",
  "This roadmap follows [Keep a Roadmap 1.0.0](https://keeparoadmap.com/).",
  "",
  "## Now",
  "",
  "- **A thing.** It matters. [#1]",
  "",
  "## Next",
  "",
  "Nothing right now.",
  "",
  "## Later",
  "",
  "### Docs",
  "",
  "- **A guide.** For new users. [#2]",
  "",
  "[#1]: https://example.com/1",
  "[#2]: https://example.com/2",
].join("\n");

const reviewedLine = "Last reviewed: 2026-11-14";
const trackerLine = "Tracker: [Project board](https://example.com/board)";

test("a roadmap with a Tracker line conforms", () => {
  assert.deepEqual(checkRoadmap(minimal.replace(reviewedLine, `${reviewedLine}\n\n${trackerLine}`)), []);
});

test("the example follows the format it demonstrates", () => {
  assert.deepEqual(checkRoadmap(example), []);
});

test("the example shows the optional parts: Not planned and a subheading", () => {
  assert.match(example, /^## Not planned$/m);
  assert.match(example, /^### \S/m);
});

test("the example's Tracker line is one valid link, straight after Last reviewed", () => {
  const lines = example.split("\n");
  const reviewed = lines.findIndex((line) => line.startsWith("Last reviewed:"));
  const tracker = lines.findIndex((line) => line.startsWith("Tracker:"));
  assert.ok(tracker > 0, "the example should show the optional Tracker line");
  assert.equal(tracker, reviewed + 2, "Tracker should be the paragraph right after Last reviewed");
  const [, url] = lines[tracker].match(/^Tracker: \[[^\]]+\]\(([^)]+)\)$/) ?? [];
  assert.ok(url, `not a single Markdown link: ${lines[tracker]}`);
  assert.equal(new URL(url).protocol, "https:");
  const firstSection = lines.findIndex((line) => line.startsWith("## "));
  assert.ok(tracker < firstSection, "Tracker belongs in the header");
});

test("a roadmap without Not planned conforms", () => {
  assert.deepEqual(checkRoadmap(minimal), []);
});

test("the checker rejects what the layout forbids", () => {
  const cases = {
    "missing version line": minimal.replace(/^This roadmap follows.*$/m, ""),
    "missing Later": minimal.replace("## Later", "### Later"),
    "renamed section": minimal.replace("## Next", "## Soon"),
    "extra section": `${minimal}\n\n## Ideas\n`,
    "Not planned before Later": minimal.replace("## Later", "## Not planned\n\n## Later"),
    "subheading too deep": minimal.replace("### Docs", "#### Docs"),
    "item without link": minimal.replace("It matters. [#1]", "It matters."),
    "Tracker line without a link": minimal.replace(reviewedLine, `${reviewedLine}\n\nTracker: our board`),
    "Tracker line with two links": minimal.replace(reviewedLine, `${reviewedLine}\n\n${trackerLine} and [Jira](https://example.com/jira)`),
    "Tracker line in the wrong place": minimal.replace("## Now", `${trackerLine}\n\n## Now`),
    "Tracker line run into Last reviewed": minimal.replace(reviewedLine, `${reviewedLine}\n${trackerLine}`),
    "two Tracker lines": minimal.replace(reviewedLine, `${reviewedLine}\n\n${trackerLine}\n\n${trackerLine}`),
  };
  for (const [name, text] of Object.entries(cases)) {
    assert.notDeepEqual(checkRoadmap(text), [], `${name} should not conform`);
  }
});
