import { Fragment, type ReactNode } from "react";

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="font-semibold text-slate-12">{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

export function MiniMarkdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-[13.5px] leading-relaxed text-slate-11">
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter(Boolean);
        if (lines.length && lines.every((l) => /^\s*([-*]|\d+\.)\s/.test(l))) {
          return (
            <ul key={bi} className="space-y-1.5">
              {lines.map((l, li) => (
                <li key={li} className="flex gap-2.5"><span className="mt-[9px] h-[5px] w-[5px] shrink-0 bg-jade-9" /><span>{inline(l.replace(/^\s*([-*]|\d+\.)\s/, ""))}</span></li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>{li > 0 && <br />}{inline(l.replace(/^#+\s/, ""))}</Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
