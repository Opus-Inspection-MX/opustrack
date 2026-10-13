/** Resolve the isolation boundary before loading profiles or starting Docker. */
export function workflowOptions(args) {
  const workflows = args.includes("--workflows");
  const devMode = args.includes("--dev");
  if (!workflows) {
    return {
      workflows,
      devMode,
      playwrightArgs: args.filter((arg) => arg !== "--dev"),
    };
  }
  if (devMode)
    throw new Error(
      "Workflow acceptance requires the production build; --dev is not allowed.",
    );

  const playwrightArgs = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--workflows") continue;
    if (/^--shard(?:=|$)/.test(arg))
      throw new Error("Workflow calendar isolation does not allow sharding.");
    const match = /^(--project|--workers|-j)(?:=(.*))?$/.exec(arg);
    const shortWorkers = /^-j(.+)$/.exec(arg);
    if (match || shortWorkers) {
      const flag = match?.[1] ?? "-j";
      const value = match ? (match[2] ?? args[++index]) : shortWorkers[1];
      const expected = flag === "--project" ? "workflows" : "1";
      if (value !== expected)
        throw new Error(`Workflow invocation requires ${flag}=${expected}.`);
      continue;
    }
    playwrightArgs.push(arg);
  }
  playwrightArgs.push("--project=workflows", "--workers=1");
  return { workflows, devMode: false, playwrightArgs };
}
