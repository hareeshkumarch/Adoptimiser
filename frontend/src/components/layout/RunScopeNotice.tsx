import { ArrowRight, RefreshCw } from "lucide-react";
import { useAccounts } from "../../hooks/queries";
import { PLATFORM_LABEL } from "../../lib/format";
import { runScopeDiffers } from "../../lib/runScope";
import { useDeepAgent } from "../../state/deepAgent";
import { useFilters } from "../../state/filters";

export function RunScopeNotice() {
  const { run, status, start } = useDeepAgent();
  const { platform, accountId, campaign, adsetId, adsetName, window } = useFilters();
  const { data } = useAccounts();
  if (!run || status === "loading" || status === "starting" || status === "running" || !runScopeDiffers(run, platform, accountId, campaign, adsetId, window)) return null;

  const accounts = data?.accounts ?? [];
  const currentAccount = accounts.find((account) => account.account_id === accountId);
  const priorAccount = accounts.find((account) => account.account_id === run.scope.account_id);
  const windowLabel = (value: typeof window) => value === "data_driven" ? "data-driven attribution" : value === "1d_click" ? "1-day click attribution" : "7-day click attribution";
  const currentParts = [currentAccount ? `${PLATFORM_LABEL[currentAccount.platform]} Ads · ${currentAccount.name}` : accountId ? `account ${accountId}` : platform ? `${PLATFORM_LABEL[platform]} Ads` : "all platforms"];
  const priorParts = [priorAccount ? `${PLATFORM_LABEL[priorAccount.platform]} Ads · ${priorAccount.name}` : run.scope.account_id ? `account ${run.scope.account_id}` : run.scope.platform ? `${PLATFORM_LABEL[run.scope.platform]} Ads` : "all platforms"];
  if (campaign) currentParts.push(`Campaign ${campaign}`);
  if (adsetId) currentParts.push(`Ad set ${adsetName ?? adsetId}`);
  if (run.scope.campaign) priorParts.push(`Campaign ${run.scope.campaign}`);
  if (run.scope.adset_id) priorParts.push(`Ad set ${run.scope.adset_id}`);
  currentParts.push(windowLabel(window));
  priorParts.push(windowLabel(run.window));
  const currentScope = currentParts.join(" · ");
  const priorScope = priorParts.join(" · ");

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-amber-6 bg-amber-2 px-4 py-3" role="status" data-testid="run-scope-notice">
      <p className="max-w-3xl text-xs leading-relaxed text-amber-11">
        The current view is scoped to <strong>{currentScope}</strong>, while the latest investigation covered <strong>{priorScope}</strong>. Run it again to refresh findings for this selection.
      </p>
      <button type="button" className="btn-ghost shrink-0" onClick={() => start(run.query)} data-testid="run-scope-refresh-button">
        <RefreshCw size={13} /> Run for this scope <ArrowRight size={13} />
      </button>
    </div>
  );
}
