 OpusTrack — stabilize, refactor, extend                                     │
│                                                                             │
│ Context                                                                     │
│                                                                             │
│ You reported that changes keep breaking parts of the system, and that the tree carries                                                                │
│ unused code and old code that no longer works. That is accurate, and the audit found the                                                             │
│ mechanism behind it.                                                        │
│                                                                             │
│ npx tsc --noEmit and npx biome check both pass completely clean — 0 errors, 0                                                                           │
│ diagnostics, zero any, zero @ts-ignore, zero commented-out blocks, one TODO (and it                                                                     │
│ lives in a dead file). The disciplined parts of this codebase are genuinely disciplined:                                                                │
│ the route-access.ts / authz.ts layering, the state machines, the result.ts error                                                                       │
│ contract, the e2e harness with assertEphemeralDatabase().                   │
│                                                                             │
│ The rot is entirely invisible to the toolchain. Dead files, orphaned API routes,                                                                     │
│ missing auth guards, mocked pages, un-scoped tenant queries and un-parsed input are all                                                               │
│ type-correct and lint-clean. That is precisely why they accumulated, and why a green build                                                           │
│ keeps reassuring you while the app misbehaves.                              │
│                                                                             │
│ Two things make it worse:                                                   │
│                                                                             │
│ 1. CLAUDE.md — the fi change — describes a     │ OpusTrack — stabilize, refactor, extend                                     │
│                                                                             │
│ Context                                                                     │
│                                                                             │
│ You reported that changes keep breaking parts of the system, and that the tree carries                                                                │
│ unused code and old code that no longer works. That is accurate, and the audit found the                                                             │
│ mechanism behind it.                                                        │
│                                                                             │
│ npx tsc --noEmit and npx biome check both pass completely clean — 0 errors, 0                                                                           │
│ diagnostics, zero any, zero @ts-ignore, zero commented-out blocks, one TODO (and it                                                                     │
│ lives in a dead file). The disciplined parts of this codebase are genuinely disciplined:                                                                │
│ the route-access.ts / authz.ts layering, the state machines, the result.ts error                                                                       │
│ contract, the e2e harness with assertEphemeralDatabase().                   │
│                                                                             │
│ The rot is entirely invisible to the toolchain. Dead files, orphaned API routes,                                                                     │
│ missing auth guards, mocked pages, un-scoped tenant queries and un-parsed input are all                                                               │
│ type-correct and lint-clean. That is precisely why they accumulated, and why a green build                                                           │
│ keeps reassuring you while the app misbehaves.                              │
│                                                                             │
│ Two things make it worse:                                                   │
│                                                                             │
│ 1. CLAUDE.md — the fi change — describes a     │
