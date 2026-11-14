// Builds the site into dist/: copies src/, inlines examples/ROADMAP.md into the
// page, and publishes the example, CREDITS.md and LICENSE beside it so the page can link
// to them. It also writes the files for agents: index.md (the page as Markdown),
// llms.txt and sitemap.md, all generated from the page so they can't drift from it.
// No dependencies beyond Node itself.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { find, htmlToMarkdown, parseHtml, textOf } from "./scripts/html-to-markdown.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");

// Where the site will live. llms.txt and sitemap.md use absolute URLs, as the
// llms.txt proposal's examples do, because agents often read them on their own.
export const siteUrl = "https://keeparoadmap.com/";

// Every file the build publishes, and what it's for. sitemap.md lists them all;
// `llms` puts a file in that section of llms.txt. The build fails if dist/ holds
// a file that isn't listed here.
export const publicFiles = [
  { path: "index.html", url: "", title: "Keep a Roadmap", about: "the page that explains the convention" },
  { path: "index.md", title: "Keep a Roadmap as Markdown", llms: "Docs", about: "the whole page as Markdown, generated from the same source, for agents and for quoting" },
  { path: "ROADMAP.md", title: "Example roadmap", llms: "Docs", about: "the worked example as a plain file to copy; CC0, so no attribution is needed" },
  { path: "examples/ROADMAP.md", title: "Example roadmap (repository path)", about: "the same example at the path it has in this convention's repository" },
  { path: "CREDITS.md", title: "Credits", llms: "Optional", about: "every source the convention borrows from, how each was checked, and its license" },
  { path: "LICENSE", title: "License", llms: "Optional", about: "which license covers which part: CC BY 4.0, CC0 1.0 or MIT" },
  { path: "llms.txt", title: "llms.txt", about: "a short guide to this site for language models, following the llms.txt proposal" },
  { path: "sitemap.md", title: "Sitemap", llms: "Optional", about: "every public file on the site, and what it's for" },
  { path: "style.css", title: "Stylesheet", about: "the page's styles" },
  { path: "favicon.svg", title: "Icon", about: "the page's icon" },
];

const escapeHtml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const urlOf = (file) => siteUrl + (file.url ?? file.path);

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath ?? entry.path, entry.name)).split("\\").join("/"));
}

// llms.txt, in the order the proposal gives: an H1, a blockquote summary, plain
// paragraphs, then H2 sections of links. Title, summary and version come from the page.
function llmsTxt(page) {
  const tree = parseHtml(page);
  const title = textOf(find(tree, (node) => node.tag === "h1")).trim();
  const summary = find(tree, (node) => node.tag === "meta" && node.attrs.name === "description").attrs.content;
  const version = textOf(find(tree, (node) => node.attrs?.class === "version")).replace(/\s+/g, " ").trim();
  const sections = ["Docs", "Optional"].map((name) => [
    `## ${name}`,
    "",
    ...publicFiles.filter((file) => file.llms === name).map((file) => `- [${file.title}](${urlOf(file)}): ${file.about}`),
  ].join("\n"));
  return [
    `# ${title}`,
    `> ${summary}`,
    `${version}. The convention is one page, written for people; index.md is that page as Markdown. ` +
      "The example roadmap is CC0, so it can be copied into a project without attribution. " +
      "The rest of the text is CC BY 4.0.",
    ...sections,
  ].join("\n\n") + "\n";
}

function sitemapMd() {
  return [
    "# Sitemap",
    `Every public file on ${siteUrl}, and what it's for.`,
    publicFiles.map((file) => `- [${file.path}](${urlOf(file)}): ${file.about}`).join("\n"),
  ].join("\n\n") + "\n";
}

export function build() {
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });
  cpSync(join(root, "src"), dist, { recursive: true });

  const example = readFileSync(join(root, "examples", "ROADMAP.md"), "utf8");
  const source = readFileSync(join(root, "src", "index.html"), "utf8");
  if (!source.includes("<!-- EXAMPLE -->")) {
    throw new Error("src/index.html is missing the <!-- EXAMPLE --> placeholder");
  }
  const page = source.replace("<!-- EXAMPLE -->", () => escapeHtml(example.trimEnd()));
  writeFileSync(join(dist, "index.html"), page);

  mkdirSync(join(dist, "examples"), { recursive: true });
  cpSync(join(root, "examples", "ROADMAP.md"), join(dist, "examples", "ROADMAP.md"));
  cpSync(join(root, "examples", "ROADMAP.md"), join(dist, "ROADMAP.md"));
  cpSync(join(root, "CREDITS.md"), join(dist, "CREDITS.md"));
  cpSync(join(root, "LICENSE"), join(dist, "LICENSE"));

  // In-page anchors point at the HTML page, since Markdown headings carry no ids.
  const markdown = htmlToMarkdown(page, {
    preLanguage: "markdown",
    link: (href) => (href.startsWith("#") ? `index.html${href}` : href),
  });
  writeFileSync(join(dist, "index.md"), markdown);
  writeFileSync(join(dist, "llms.txt"), llmsTxt(page));
  writeFileSync(join(dist, "sitemap.md"), sitemapMd());

  const listed = new Set(publicFiles.map((file) => file.path));
  const unlisted = listFiles(dist).filter((path) => !listed.has(path));
  if (unlisted.length) throw new Error(`add these to publicFiles in build.mjs: ${unlisted.join(", ")}`);
  return dist;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`Built ${build()}`);
}
