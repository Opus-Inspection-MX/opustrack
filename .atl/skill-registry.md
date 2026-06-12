# Skill Registry — opustrack

<!-- Updated by sdd-init 2026-06-10. Claude Code paths authoritative for claude-code sessions. -->

Last updated: 2026-06-10

## Sources scanned

- /Users/abdiel/.claude/skills (claude-code — authoritative)
- /Users/abdiel/.config/opencode/skills (opencode fallback)

## Contract

**Delegator use only.** This registry is an index, not a summary. Any agent that launches subagents reads it to select relevant skills, then passes exact `SKILL.md` paths for the subagent to read before work.

`SKILL.md` remains the source of truth. Do not inject generated summaries or compact rules by default; pass paths so subagents load the full runtime contract and preserve author intent.

## Skills

| Skill | Trigger / description | Scope | Path |
| --- | --- | --- | --- |
| `branch-pr` | Create Gentle AI pull requests with issue-first checks. Trigger: creating, opening, or preparing PRs for review. | user | `/Users/abdiel/.claude/skills/branch-pr/SKILL.md` |
| `chained-pr` | Trigger: PRs over 400 lines, stacked PRs, review slices. Split oversized changes into chained PRs that protect review focus. | user | `/Users/abdiel/.claude/skills/chained-pr/SKILL.md` |
| `cognitive-doc-design` | Design docs that reduce cognitive load. Trigger: writing guides, READMEs, RFCs, onboarding, architecture, or review-facing docs. | user | `/Users/abdiel/.claude/skills/cognitive-doc-design/SKILL.md` |
| `comment-writer` | Write warm, direct collaboration comments. Trigger: PR feedback, issue replies, reviews, Slack messages, or GitHub comments. | user | `/Users/abdiel/.claude/skills/comment-writer/SKILL.md` |
| `go-testing` | Trigger: Go tests, go test coverage, Bubbletea teatest, golden files. NOT APPLICABLE — project is TypeScript/Next.js. | user | `/Users/abdiel/.claude/skills/go-testing/SKILL.md` |
| `issue-creation` | Create Gentle AI issues with issue-first checks. Trigger: creating GitHub issues, bug reports, or feature requests. | user | `/Users/abdiel/.claude/skills/issue-creation/SKILL.md` |
| `judgment-day` | Trigger: judgment day, dual review, adversarial review, juzgar. Run blind dual review, fix confirmed issues, then re-judge. | user | `/Users/abdiel/.claude/skills/judgment-day/SKILL.md` |
| `skill-creator` | Trigger: new skills, agent instructions, documenting AI usage patterns. Create LLM-first skills with valid frontmatter. | user | `/Users/abdiel/.claude/skills/skill-creator/SKILL.md` |
| `skill-improver` | Trigger: improve skills, audit skills, refactor skills, skill quality. Audit and upgrade existing LLM-first skills. | user | `/Users/abdiel/.claude/skills/skill-improver/SKILL.md` |
| `work-unit-commits` | Plan commits as reviewable work units. Trigger: implementation, commit splitting, chained PRs, or keeping tests and docs with code. | user | `/Users/abdiel/.claude/skills/work-unit-commits/SKILL.md` |

## Project-specific notes

- `go-testing`: NOT applicable — project is TypeScript/Next.js. Do not inject.
- `chained-pr` + `work-unit-commits`: REQUIRED together whenever sdd-tasks forecasts `Chained PRs recommended: Yes` or `400-line budget risk: High`.
- `branch-pr`: Load for all sdd-apply steps that create or open a PR.
- `judgment-day`: Load on-demand for adversarial/dual review requests.
- `comment-writer`: Load when writing PR comments, issue replies, or code review feedback.

## Project Convention Files

- /Users/abdiel/work/opustrack/CLAUDE.md — architecture and dev patterns (partially outdated; uses VIC/WorkOrder — see spec/ for current domain)
- /Users/abdiel/work/opustrack/spec/00-overview.md — domain overview, glossary, cross-cutting rules (source of truth)
- /Users/abdiel/work/opustrack/spec/README.md — spec index

## Loading protocol

1. Match task context and target files against the `Trigger / description` column.
2. Pass only the matching `Path` values to the subagent under `## Skills to load before work`.
3. Instruct the subagent to read those exact `SKILL.md` files before reading, writing, reviewing, testing, or creating artifacts.
4. If no matching skill exists, proceed without project skill injection and report `skill_resolution: none`.
