import type { ReactElement } from "react";
import { Check, Circle, Loader2 } from "lucide-react";
import { useDeepAgent } from "../../state/deepAgent";
import type { TodoStatus } from "../../types";

const ICON: Record<TodoStatus, ReactElement> = {
  pending: <Circle size={12} className="text-slate-8" />,
  in_progress: <Loader2 size={12} className="animate-spin text-iris-11" />,
  done: <Check size={12} strokeWidth={2.5} className="text-jade-11" />,
};

export function TaskTree() {
  const { todos } = useDeepAgent();
  if (!todos.length) return <p className="px-4 py-6 text-xs text-slate-11">The planner has not written todos yet.</p>;
  const done = todos.filter((t) => t.status === "done").length;
  return (
    <div className="px-4 py-3" data-testid="task-tree">
      <div className="mb-3 flex items-center justify-between">
        <p className="eyebrow">write_todos · investigation plan</p>
        <span className="num text-[11px] text-slate-11">
          {done}/{todos.length}
        </span>
      </div>
      <ol className="space-y-px">
        {todos.map((t, i) => (
          <li key={t.id} className="grid grid-cols-[20px_16px_1fr] items-start gap-2 border-b border-slate-4 py-2 last:border-b-0" data-testid={`todo-${t.id}`}>
            <span className="num text-[10px] text-slate-10">{String(i + 1).padStart(2, "0")}</span>
            <span className="mt-0.5">{ICON[t.status]}</span>
            <span>
              <span className={t.status === "done" ? "text-xs text-slate-11" : "text-xs text-slate-12"}>{t.title}</span>
              <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-iris-11">{t.owner}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
