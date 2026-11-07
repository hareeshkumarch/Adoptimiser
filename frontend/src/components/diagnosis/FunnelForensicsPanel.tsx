import { pct, PLATFORM_LABEL, signedPct } from "../../lib/format";
import { useDeepAgent } from "../../state/deepAgent";
import { PlatformLogo } from "../common/PlatformLogo";
import { StatusPill, type Tone } from "../common/StatusPill";

const BOTTLENECK_META: Record<string, { label: string; tone: Tone }> = {
  healthy: { label: "Funnel healthy", tone: "jade" },
  creative_thumbstop_decay: { label: "Thumbstop hook decay", tone: "ruby" },
  auction_cpm_inflation: { label: "Auction CPM pressure", tone: "amber" },
  landing_page_friction: { label: "Landing page drop", tone: "ruby" },
  attribution_claim_inflation: { label: "Claim over-attribution", tone: "amber" },
};

export function FunnelForensicsPanel() {
  const { run } = useDeepAgent();
  const rows = run?.forensics ?? [];
  if (!rows.length) return null;

  return (
    <section className="border border-slate-6 bg-white" data-testid="funnel-forensics-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-6 bg-slate-2 px-5 py-3">
        <div>
          <p className="eyebrow">Forensics Sub-Agent · Full-Funnel Stage Telemetry</p>
          <p className="mt-0.5 text-xs text-slate-11">
            Cross-stage conversion integrity from impression thumbstop through server-side landing page CVR and pixel claim ratio.
          </p>
        </div>
        <span className="num text-[11px] text-slate-10">7d vs 21d baseline</span>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="border-b border-slate-6 bg-slate-1">
              <th className="eyebrow px-4 py-2 text-left font-normal">Platform</th>
              <th className="eyebrow px-3 py-2 text-right font-normal">CTR</th>
              <th className="eyebrow px-3 py-2 text-right font-normal">Click → Session</th>
              <th className="eyebrow px-3 py-2 text-right font-normal">Server LP CVR</th>
              <th className="eyebrow px-3 py-2 text-right font-normal">Pixel / Server Ratio</th>
              <th className="eyebrow px-3 py-2 text-right font-normal">CPM Drift</th>
              <th className="eyebrow px-3 py-2 text-right font-normal">Hook Drift</th>
              <th className="eyebrow px-4 py-2 text-right font-normal">Primary Bottleneck</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const meta = BOTTLENECK_META[r.primary_bottleneck] ?? { label: r.primary_bottleneck, tone: "slate" as Tone };
              return (
                <tr key={r.platform} className="border-t border-slate-6 " data-testid={`forensic-row-${r.platform}`}>
                  <td className="px-4 py-2.5 text-xs text-slate-12">
                    <span className="flex items-center gap-2">
                      <PlatformLogo platform={r.platform} size={14} />
                      {PLATFORM_LABEL[r.platform]}
                    </span>
                  </td>
                  <td className="num px-3 py-2.5 text-right text-xs text-slate-12">{pct(r.ctr_cur, 2)}</td>
                  <td className="num px-3 py-2.5 text-right text-xs text-slate-12">{pct(r.click_to_session_rate, 1)}</td>
                  <td className="num px-3 py-2.5 text-right text-xs text-slate-12">
                    {pct(r.lp_cvr_cur, 2)} <span className="text-[10px] text-slate-10">({signedPct(r.lp_cvr_delta, 0)})</span>
                  </td>
                  <td className="num px-3 py-2.5 text-right text-xs text-slate-12">{r.pixel_vs_server_ratio.toFixed(2)}x</td>
                  <td className="num px-3 py-2.5 text-right text-xs text-slate-12">{signedPct(r.cpm_delta, 0)}</td>
                  <td className="num px-3 py-2.5 text-right text-xs text-slate-12">{r.hook_delta !== null ? signedPct(r.hook_delta, 0) : "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
