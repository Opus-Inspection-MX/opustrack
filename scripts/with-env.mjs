#!/usr/bin/env node
/**
 * Run a command with an environment profile loaded.
 *
 *   node scripts/with-env.mjs <perfil> [KEY=VALUE...] -- <comando...>
 *
 * See scripts/lib/env-profiles.mjs for what each profile means.
 */
import { spawn } from "node:child_process";
import { loadProfile, PROFILES } from "./lib/env-profiles.mjs";

const [profile, ...rest] = process.argv.slice(2);
const separator = rest.indexOf("--");
const inline = separator === -1 ? [] : rest.slice(0, separator);
const command = separator === -1 ? rest : rest.slice(separator + 1);

if (!profile || !PROFILES[profile] || command.length === 0) {
  console.error(
    `Uso: node scripts/with-env.mjs <${Object.keys(PROFILES).join("|")}> [KEY=VALUE...] -- <comando...>`,
  );
  process.exit(1);
}

loadProfile(profile);

// Inline KEY=VALUE pairs win over the files — they are the caller's explicit
// intent for this one invocation.
for (const pair of inline) {
  const index = pair.indexOf("=");
  if (index === -1) {
    console.error(`Argumento inválido: "${pair}". Se esperaba KEY=VALUE.`);
    process.exit(1);
  }
  process.env[pair.slice(0, index)] = pair.slice(index + 1);
}

const child = spawn(command[0], command.slice(1), {
  stdio: "inherit",
  shell: false,
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
