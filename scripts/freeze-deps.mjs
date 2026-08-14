/**
 * Roll the dependency cutoff date in `.npmrc`.
 *
 * npm has NO `minimumReleaseAge` — that is a pnpm setting. The closest npm
 * offers is `before`, which refuses to resolve any version published after a
 * given instant. The difference matters: `minimumReleaseAge` is a rolling
 * window that maintains itself, while `before` is a fixed date that has to be
 * moved by hand. Forget to move it and the project silently freezes on old
 * versions — including security patches.
 *
 * This script exists to make moving it a one-liner:
 *
 *   node scripts/freeze-deps.mjs          # cutoff = 7 days ago
 *   node scripts/freeze-deps.mjs 14       # cutoff = 14 days ago
 *
 * Why a delay helps at all: the npm supply-chain compromises of 2025 were
 * malicious versions published to the registry and pulled within hours to a
 * couple of days. Installing nothing younger than a week means the window in
 * which you would adopt one is mostly closed.
 *
 * It only matters when resolving NEW versions. `npm ci` installs exactly what
 * package-lock.json already pins, so CI and Docker were never the exposure —
 * `npm install`, `npm update` and `npm i <pkg>` on a developer machine are.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const NPMRC = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".npmrc",
);

const days = Number.parseInt(process.argv[2] ?? "7", 10);
if (!Number.isFinite(days) || days < 0) {
  console.error("Uso: node scripts/freeze-deps.mjs [días]");
  process.exit(1);
}

const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const iso = cutoff.toISOString();

let contents = "";
try {
  contents = readFileSync(NPMRC, "utf8");
} catch {
  // No .npmrc yet: the file is created below.
}

const line = `before=${iso}`;
contents = contents.match(/^before=.*$/m)
  ? contents.replace(/^before=.*$/m, line)
  : `${contents.trimEnd()}\n${line}\n`.trimStart();

writeFileSync(NPMRC, contents.endsWith("\n") ? contents : `${contents}\n`);

console.log(`✅ .npmrc: before=${iso} (hace ${days} día(s))`);
console.log(
  "   npm no instalará versiones publicadas después de esa fecha.\n" +
    "   Vuelve a correr esto antes de agregar o actualizar dependencias.",
);
