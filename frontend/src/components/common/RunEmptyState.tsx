import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

interface Props {
  failed: boolean;
  item: string;
}

export function RunEmptyState({ failed, item }: Props) {
  return (
    <div className="border border-slate-6 bg-white px-5 py-6" role={failed ? "alert" : "status"} data-testid="run-empty-state">
      <p className="text-sm font-medium text-slate-12">{failed ? "The latest investigation didn't finish." : `No ${item} yet.`}</p>
      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-11">
        {failed ? "Retry the full audit from the header, or open the workspace to review the investigation trace." : `Run a full audit from the header to see ${item} here, or open the workspace for a focused investigation.`}
      </p>
      <Link to="/agent" className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-iris-11 hover:text-iris-12" data-testid="empty-run-agent-link">
        Open agent workspace <ArrowRight size={13} />
      </Link>
    </div>
  );
}
