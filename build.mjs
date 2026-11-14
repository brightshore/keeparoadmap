// Builds the site into dist/: copies src/, inlines examples/ROADMAP.md into the
// page, and publishes the example and CREDITS.md beside it so the page can link
// to them. No dependencies beyond Node itself.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");

const escapeHtml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function build() {
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });
  cpSync(join(root, "src"), dist, { recursive: true });

  const example = readFileSync(join(root, "examples", "ROADMAP.md"), "utf8");
  const page = readFileSync(join(root, "src", "index.html"), "utf8");
  if (!page.includes("<!-- EXAMPLE -->")) {
    throw new Error("src/index.html is missing the <!-- EXAMPLE --> placeholder");
  }
  writeFileSync(
    join(dist, "index.html"),
    page.replace("<!-- EXAMPLE -->", () => escapeHtml(example.trimEnd())),
  );

  mkdirSync(join(dist, "examples"), { recursive: true });
  cpSync(join(root, "examples", "ROADMAP.md"), join(dist, "examples", "ROADMAP.md"));
  cpSync(join(root, "CREDITS.md"), join(dist, "CREDITS.md"));
  return dist;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`Built ${build()}`);
}
