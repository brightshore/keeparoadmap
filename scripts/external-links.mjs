// Reads scripts/external-links.txt: one URL per line, optionally followed by
// " | " and a note on what was checked there. Lines starting with # are comments.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const listPath = join(dirname(fileURLToPath(import.meta.url)), "external-links.txt");

export function readExternalLinks() {
  return readFileSync(listPath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [url, ...note] = line.split(" | ");
      return { url: url.trim(), note: note.join(" | ").trim() };
    });
}
