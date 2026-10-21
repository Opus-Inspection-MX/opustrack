import type { HelpBlock } from "@/lib/help/guides";

export function HelpContent({ blocks }: { blocks: HelpBlock[] }) {
  return blocks.map((block) => {
    // Content is trusted repository prose, but is always escaped by React.
    const key = `${block.type}-${"text" in block ? block.text : block.items.join("\n")}`;
    if (block.type === "heading") {
      return (
        <h2 key={key} className="pt-4 font-display text-xl font-semibold">
          {block.text}
        </h2>
      );
    }
    if (block.type === "paragraph") {
      return <p key={key}>{block.text}</p>;
    }
    const List = block.type === "ordered-list" ? "ol" : "ul";
    return (
      <List
        key={key}
        className={`space-y-3 pl-6 ${block.type === "ordered-list" ? "list-decimal" : "list-disc"}`}
      >
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </List>
    );
  });
}
