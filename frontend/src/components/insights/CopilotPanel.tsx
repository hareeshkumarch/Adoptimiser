import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { askCopilot } from "../../lib/insights";
import { useFilters } from "../../state/filters";
import { MiniMarkdown } from "../common/MiniMarkdown";

interface Msg { role: "user" | "assistant"; content: string }

export const STARTER_PROMPTS = [
  "What are the 3 things I should do this week?",
  "Write 3 new creative concepts based on my best ads",
  "Where am I wasting the most money?",
  "Which audience should I expand into next?",
];

export function CopilotPanel({ seed, onSeedUsed }: { seed?: string | null; onSeedUsed?: () => void }) {
  const { platform, accountId } = useFilters();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const thread = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setBusy(true);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: question }, { role: "assistant", content: "" }]);
    try {
      await askCopilot({ question, thread_id: thread.current, scope: { platform, account_id: accountId } }, (e) => {
        if (e.type === "thread") thread.current = e.thread_id ?? null;
        if (e.type === "status") setStatus(e.label ?? "");
        if (e.type === "delta") setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: m[m.length - 1].content + (e.delta ?? "") }]);
      });
    } catch {
      setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: "Copilot could not answer right now. Please try again." }]);
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  useEffect(() => {
    if (seed && !busy) {
      onSeedUsed?.();
      ask(seed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, busy]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <section className="flex h-full min-h-[520px] flex-col border border-slate-12 bg-white" data-testid="copilot-panel">
      <header className="flex items-center justify-between border-b border-slate-12 bg-slate-12 px-4 py-3 text-white">
        <p className="flex items-center gap-2 text-sm font-medium"><Sparkles size={14} className="text-jade-8" /> Ask Copilot</p>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-8">Read-only · your data</span>
      </header>
      <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin" data-testid="copilot-messages">
        {messages.length === 0 && (
          <div className="space-y-2" data-testid="copilot-starters">
            <p className="text-[13px] text-slate-11">Ask anything about your ads. Try one of these:</p>
            {STARTER_PROMPTS.map((p, i) => (
              <button key={p} type="button" onClick={() => ask(p)} className="tile-select block w-full px-3 py-2.5 text-[13px] text-slate-12" data-testid={`copilot-starter-${i}`}>
                {p}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <p key={i} className="ml-8 border-l-2 border-slate-12 bg-slate-3 px-3 py-2 text-[13px] text-slate-12" data-testid="copilot-user-message">{m.content}</p>
          ) : (
            <div key={i} className="animate-fade-up" data-testid="copilot-assistant-message">
              {m.content ? <MiniMarkdown text={m.content} /> : <p className="flex items-center gap-2 text-xs text-slate-10"><Loader2 size={12} className="animate-spin" /> {status || "Thinking"}…</p>}
              {busy && i === messages.length - 1 && m.content && <span className="caret" />}
            </div>
          ),
        )}
      </div>
      <form className="flex border-t border-slate-12" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Why did my CPA go up on Meta?"
          className="min-w-0 flex-1 bg-white px-4 py-3 text-[13px] outline-none placeholder:text-slate-9"
          data-testid="copilot-input"
        />
        <button type="submit" disabled={busy || !input.trim()} className="flex w-12 items-center justify-center border-l border-slate-12 bg-jade-9 text-white transition-colors hover:bg-slate-12 disabled:opacity-40" aria-label="Send question" data-testid="copilot-send-button">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={16} />}
        </button>
      </form>
    </section>
  );
}
