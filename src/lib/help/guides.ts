import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { mergeRoles, type UserAuthz } from "@/lib/authz/authz";
import { canReadHelpGuide, HELP_GUIDES, meetsHelpRequirements } from "./access";

export type HelpBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "ordered-list"; items: string[] }
  | { type: "unordered-list"; items: string[] };

function parseBlock(chunk: string): HelpBlock {
  if (chunk.startsWith("## ")) {
    return { type: "heading", text: chunk.slice(3) };
  }
  const lines = chunk.split("\n");
  if (lines.every((line) => /^\d+\. /.test(line))) {
    return {
      type: "ordered-list",
      items: lines.map((line) => line.replace(/^\d+\. /, "")),
    };
  }
  if (lines.every((line) => line.startsWith("- "))) {
    return {
      type: "unordered-list",
      items: lines.map((line) => line.slice(2)),
    };
  }
  return { type: "paragraph", text: lines.join(" ") };
}

export async function getHelpGuide(slug: string, user: UserAuthz) {
  // Only known filenames are read; route parameters never become file paths.
  const definition = HELP_GUIDES.find((candidate) => candidate.slug === slug);
  if (!definition || !canReadHelpGuide(user, slug)) return undefined;
  const known = definition.slug;
  const markdown = await readFile(
    join(process.cwd(), "docs", "user-guide", `${known}.md`),
    "utf8",
  );
  const [heading, summary, ...body] = markdown.trim().split(/\n\s*\n/);
  if (!heading?.startsWith("# ") || !summary || summary.startsWith("#")) {
    throw new Error(`Invalid help guide: ${known}`);
  }
  let sectionVisible = true;
  const blocks = body.map(parseBlock).filter((block) => {
    if (block.type === "heading") {
      const section = definition.sections?.find(
        (item) => item.title === block.text,
      );
      sectionVisible =
        !section || meetsHelpRequirements(user, section.requires);
    }
    return sectionVisible;
  });
  return {
    slug: known,
    title: heading.slice(2),
    summary: summary.split("\n").join(" "),
    blocks,
  };
}

export async function getHelpGuides(user: UserAuthz) {
  const guides = await Promise.all(
    HELP_GUIDES.map(({ slug }) => getHelpGuide(slug, user)),
  );
  return guides.filter((guide) => guide !== undefined);
}

export async function getHelpGroups(user: UserAuthz) {
  const guides = await getHelpGuides(user);
  const attributed = new Set<string>();
  const groups = [...user.roles]
    .sort((a, b) => b.priority - a.priority || a.id - b.id)
    .map((role) => {
      const roleViewer = mergeRoles([role]);
      const applicable = guides.filter((guide) =>
        canReadHelpGuide(roleViewer, guide.slug),
      );
      for (const guide of applicable) attributed.add(guide.slug);
      return { id: `role-${role.id}`, title: role.name, guides: applicable };
    })
    .filter((group) => group.guides.length > 0);
  const combined = guides.filter((guide) => !attributed.has(guide.slug));
  if (combined.length) {
    groups.push({
      id: "combined",
      title: "Permisos combinados",
      guides: combined,
    });
  }
  return groups;
}
