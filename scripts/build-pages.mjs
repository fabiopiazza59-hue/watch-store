// Builds the static GitHub Pages demo into ./out.
//
// GitHub Pages serves files only, so the parts that need a server (API routes, the order store, the
// workshop pages and the proxy) are left out of this build. The configurator, rules, pricing, extras
// and the offline designer all run in the browser. The build happens in a temporary copy of the
// project so the server-only files never have to be removed from the working tree.
//
// Usage: npm run build:pages   (PAGES_BASE_PATH=/repo-name for a project site; CI sets it)
import { execFileSync } from "node:child_process";
import { cp, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";

const SERVER_ONLY = [
  "src/app/api",
  "src/app/orders",
  "src/app/order-placed",
  "src/proxy.ts",
  "src/proxy.test.ts",
];
const NOT_COPIED = new Set(["node_modules", ".next", "out", ".git", "data", "e2e"]);

const root = process.cwd();
const work = await mkdtemp(join(tmpdir(), "atelier-pages-"));

try {
  await cp(root, work, {
    recursive: true,
    filter: (source) => !NOT_COPIED.has(relative(root, source).split(sep)[0]),
  });
  for (const path of SERVER_ONLY) await rm(join(work, path), { recursive: true, force: true });
  await symlink(join(root, "node_modules"), join(work, "node_modules"), "dir");

  // Webpack, because Turbopack refuses a node_modules symlinked from outside the project.
  execFileSync("npx", ["next", "build", "--webpack"], {
    cwd: work,
    stdio: "inherit",
    env: { ...process.env, STATIC_EXPORT: "1" },
  });

  await rm(join(root, "out"), { recursive: true, force: true });
  await cp(join(work, "out"), join(root, "out"), { recursive: true });
  // Serve `_next/` as-is: without this file Jekyll would skip folders starting with "_".
  await writeFile(join(root, "out", ".nojekyll"), "");
  console.log(`Static demo written to ${join(root, "out")}`);
} finally {
  await rm(work, { recursive: true, force: true });
}
