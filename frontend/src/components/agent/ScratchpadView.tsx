import * as Accordion from "@radix-ui/react-accordion";
import { FileJson, FileText, Table2 } from "lucide-react";
import { useDeepAgent } from "../../state/deepAgent";
import type { ScratchFile, TableContent } from "../../types";

const KIND_ICON = { json: FileJson, table: Table2, markdown: FileText };

const fmt = (v: string | number | null) => (typeof v === "number" ? (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(4)) : v ?? "—");

function TableView({ content }: { content: TableContent }) {
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full border-collapse font-mono text-[10px]">
        <thead>
          <tr>
            {content.columns.map((c) => (
              <th key={c} className="whitespace-nowrap border-b border-slate-6 px-2 py-1 text-left font-normal text-slate-11">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {content.rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-4">
              {content.columns.map((c) => (
                <td key={c} className="whitespace-nowrap px-2 py-1 text-slate-12">
                  {fmt(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FileBody({ file }: { file: ScratchFile }) {
  if (file.kind === "table") return <TableView content={file.content as TableContent} />;
  if (file.kind === "markdown") return <p className="font-serif text-[13px] leading-relaxed text-slate-12">{String(file.content)}</p>;
  return <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-slate-12 scrollbar-thin">{JSON.stringify(file.content, null, 2)}</pre>;
}

export function ScratchpadView() {
  const { files } = useDeepAgent();
  if (!files.length) return <p className="px-4 py-6 text-xs text-slate-11">The shared scratchpad is empty.</p>;
  return (
    <div data-testid="scratchpad-view">
      <p className="eyebrow px-4 pb-2 pt-3">Virtual file system · {files.length} files</p>
      <Accordion.Root type="single" collapsible>
        {files.map((f) => {
          const Icon = KIND_ICON[f.kind];
          return (
            <Accordion.Item key={f.path} value={f.path} className="border-t border-slate-6">
              <Accordion.Trigger className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-slate-2" data-testid={`scratchpad-file-${f.path}`}>
                <Icon size={13} className="text-slate-10" />
                <span className="flex-1 truncate font-mono text-[11px] text-slate-12">{f.path}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-iris-11">{f.author}</span>
              </Accordion.Trigger>
              <Accordion.Content className="overflow-hidden bg-slate-2 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <div className="px-4 py-3">
                  <FileBody file={f} />
                </div>
              </Accordion.Content>
            </Accordion.Item>
          );
        })}
      </Accordion.Root>
    </div>
  );
}
