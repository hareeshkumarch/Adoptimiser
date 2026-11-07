import { FlowStepBar } from "../components/common/FlowStepBar";
import { NarrativeSection } from "../components/pulse/NarrativeSection";
import { PulseStrip } from "../components/pulse/PulseStrip";
import { useDeepAgent } from "../state/deepAgent";

export default function OverviewPage() {
  const { run } = useDeepAgent();
  return (
    <div className="space-y-9" data-testid="page-overview">
      <PulseStrip />
      <NarrativeSection />
      <FlowStepBar
        summary={run ? `${run.findings.length} verified root causes & ${run.rejected.length} filtered trap ready for inspection` : undefined}
        next={{ to: "/diagnostics", index: "02", label: "Root-Cause Audit", hint: "Verify evidence chains" }}
      />
    </div>
  );
}
