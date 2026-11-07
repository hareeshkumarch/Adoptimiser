import type { AgentRun, Platform } from "../types";

export function runMatchesScope(
  run: AgentRun,
  platform: Platform | null,
  accountId: string | null,
  campaign: string | null,
  adsetId: string | null,
  window: AgentRun["window"],
): boolean {
  if (accountId && run.scope.account_id !== accountId) return false;
  if (platform && run.scope.platform && run.scope.platform !== platform) return false;
  if (campaign && (run.scope.campaign ?? null) !== campaign) return false;
  if (adsetId && (run.scope.adset_id ?? null) !== adsetId) return false;
  if (run.window !== window) return false;
  return true;
}

export function runScopeDiffers(
  run: AgentRun,
  platform: Platform | null,
  accountId: string | null,
  campaign: string | null,
  adsetId: string | null,
  window: AgentRun["window"],
): boolean {
  return !runMatchesScope(run, platform, accountId, campaign, adsetId, window) || Boolean(
    (run.scope.platform && !platform) ||
    (run.scope.account_id && !accountId) ||
    (run.scope.campaign && !campaign) ||
    (run.scope.adset_id && !adsetId),
  );
}
