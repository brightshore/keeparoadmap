// Turns the built page into Markdown for dist/index.md. It understands only the
// elements src/index.html uses and throws on anything else, so a new element
// can't silently drop out of the Markdown twin: teach it the element instead.
// No dependencies beyond Node itself.

const VOID = new Set(["meta", "link", "br", "img"]);
const CONTAINERS = new Set(["body", "header", "main", "section", "footer", "figure"]);
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

// Parses well-formed HTML into { tag, attrs, children } nodes and { text } nodes.
export function parseHtml(html) {
  const root = { tag: "#root", attrs: {}, children: [] };
  const stack = [root];
  const token = /<!--[\s\S]*?-->|<![^>]*>|<\/([a-z0-9]+)\s*>|<([a-z0-9]+)((?:\s+[a-z-]+(?:="[^"]*")?)*)\s*\/?>|[^<]+/gi;
  for (const [match, closing, opening, attrText] of html.matchAll(token)) {
    const parent = stack.at(-1);
    if (match.startsWith("<!")) continue;
    if (closing) {
      if (parent.tag !== closing.toLowerCase()) {
        throw new Error(`</${closing}> closes <${parent.tag}>`);
      }
      stack.pop();
    } else if (opening) {
      const attrs = {};
      for (const [, name, value = ""] of attrText.matchAll(/([a-z-]+)(?:="([^"]*)")?/gi)) {
        attrs[name.toLowerCase()] = decodeEntities(value);
      }
      const node = { tag: opening.toLowerCase(), attrs, children: [] };
      parent.children.push(node);
      if (!VOID.has(node.tag)) stack.push(node);
    } else {
      parent.children.push({ text: decodeEntities(match) });
    }
  }
  if (stack.length !== 1) throw new Error(`<${stack.at(-1).tag}> is never closed`);
  return root;
}

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name) => {
    if (name[0] === "#") {
      const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return String.fromCodePoint(code);
    }
    if (!(name in ENTITIES)) throw new Error(`unknown entity ${entity}`);
    return ENTITIES[name];
  });
}

export function find(node, test) {
  if (test(node)) return node;
  for (const child of node.children ?? []) {
    const found = find(child, test);
    if (found) return found;
  }
  return null;
}

export function textOf(node) {
  return node.text ?? node.children.map(textOf).join("");
}

const classes = (node) => (node.attrs?.class ?? "").split(/\s+/);

// Things a reader of the Markdown doesn't need: the table of contents (Markdown
// readers have their own) and anything hidden on the page.
const skipped = (node) =>
  node.tag === "nav" || classes(node).includes("skip-link") || classes(node).includes("visually-hidden");

const escapeText = (text) => text.replace(/[\\`*_[\]<]/g, "\\$&");

function inline(nodes, options) {
  const out = nodes
    .map((node) => {
      if (node.text !== undefined) return escapeText(node.text.replace(/\s+/g, " "));
      const inner = () => inline(node.children, options);
      switch (node.tag) {
        case "code": {
          const code = textOf(node).replace(/\s+/g, " ");
          const ticks = "`".repeat(longestRun(code, "`") + 1);
          return ticks.length > 1 ? `${ticks} ${code} ${ticks}` : `\`${code}\``;
        }
        case "strong":
          return `**${inner()}**`;
        case "em":
          return `*${inner()}*`;
        case "a":
          return `[${inner()}](${options.link(node.attrs.href)})`;
        default:
          throw new Error(`html-to-markdown doesn't know <${node.tag}> inside text`);
      }
    })
    .join("");
  return out.replace(/ +/g, " ").trim();
}

function longestRun(text, char) {
  return Math.max(0, ...(text.match(new RegExp(`\\${char}+`, "g")) ?? []).map((run) => run.length));
}

function blocks(node, options) {
  const out = [];
  for (const child of node.children) {
    if (child.text !== undefined) {
      if (child.text.trim()) throw new Error(`loose text "${child.text.trim()}" in <${node.tag}>`);
      continue;
    }
    if (skipped(child)) continue;
    const { tag } = child;
    if (CONTAINERS.has(tag)) {
      if (tag === "footer") out.push("---");
      out.push(...blocks(child, options));
    } else if (/^h[1-6]$/.test(tag)) {
      out.push(`${"#".repeat(Number(tag[1]))} ${inline(child.children, options)}`);
    } else if (tag === "p" || tag === "figcaption") {
      out.push(inline(child.children, options));
    } else if (tag === "ul" || tag === "ol") {
      const items = child.children.filter((item) => item.tag === "li");
      out.push(
        items.map((item, i) => `${tag === "ol" ? `${i + 1}.` : "-"} ${inline(item.children, options)}`).join("\n"),
      );
    } else if (tag === "dl") {
      for (const item of child.children.filter((entry) => entry.tag)) {
        const text = inline(item.children, options);
        out.push(item.tag === "dt" ? `**${text}**` : text);
      }
    } else if (tag === "pre") {
      const code = textOf(child).replace(/\n+$/, "");
      const fence = "`".repeat(Math.max(3, longestRun(code, "`") + 1));
      out.push(`${fence}${options.preLanguage ?? ""}\n${code}\n${fence}`);
    } else {
      throw new Error(`html-to-markdown doesn't know <${tag}>`);
    }
  }
  return out;
}

// options.link(href) rewrites each link target; options.preLanguage labels code fences.
export function htmlToMarkdown(html, options = {}) {
  const body = find(parseHtml(html), (node) => node.tag === "body");
  if (!body) throw new Error("no <body> in the page");
  return `${blocks(body, { link: (href) => href, ...options }).join("\n\n")}\n`;
}
