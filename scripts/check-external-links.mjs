// One-off check that every URL in external-links.txt answers. Not part of the
// test suite, because it depends on the network and on other people's servers.
// Some sites refuse scripted requests (403); check those by hand in a browser.
import { readExternalLinks } from "./external-links.mjs";

let failed = 0;
for (const { url } of readExternalLinks()) {
  let status;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "keep-a-roadmap-link-check" },
      signal: AbortSignal.timeout(15000),
    });
    status = res.status;
  } catch (error) {
    status = error.name;
  }
  const ok = typeof status === "number" && status < 400;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${status} ${url}`);
}
process.exitCode = failed ? 1 : 0;
