import Link from "next/link";
import { categoryStyles, type Tool } from "@/lib/tools";

export default function ToolCard({ tool }: { tool: Tool }) {
  const disabled = !tool.ready;

  const inner = (
    <div
      className={`group relative flex h-full flex-col rounded-2xl border border-oddsbag-light-gray bg-white p-4 transition ${
        disabled
          ? "opacity-70"
          : "hover:-translate-y-0.5 hover:border-oddsbag-purple hover:shadow-lg hover:shadow-oddsbag-purple/10"
      }`}
    >
      <div className="mb-2 flex items-start justify-between">
        <span className="text-3xl" aria-hidden>
          {tool.emoji}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${categoryStyles[tool.category]}`}
        >
          {tool.category}
        </span>
      </div>
      <h3 className="text-base font-bold text-oddsbag-dark">{tool.title}</h3>
      <p className="mt-1 line-clamp-2 flex-1 text-sm leading-relaxed text-oddsbag-gray">
        {tool.description}
      </p>
      {disabled && (
        <span className="mt-3 inline-block text-xs font-semibold text-oddsbag-purple-light">
          곧 만나요 · Coming Soon
        </span>
      )}
    </div>
  );

  if (disabled) {
    return <div className="cursor-default">{inner}</div>;
  }

  return (
    <Link href={`/tools/${tool.slug}`} className="block h-full">
      {inner}
    </Link>
  );
}
