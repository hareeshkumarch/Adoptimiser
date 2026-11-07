import { FlowStepBar } from "../components/common/FlowStepBar";
import { AnomalyZScoreChart } from "../components/diagnosis/AnomalyZScoreChart";
import { FunnelForensicsPanel } from "../components/diagnosis/FunnelForensicsPanel";
import { RootCauseSection } from "../components/diagnosis/RootCauseSection";
import { EvaluationPanel } from "../components/evaluation/EvaluationPanel";

export default function DiagnosticsPage() {
  return (
    <div className="space-y-12" data-testid="page-diagnostics">
      <RootCauseSection />
      <AnomalyZScoreChart />
      <FunnelForensicsPanel />
      <EvaluationPanel />
      <FlowStepBar
        prev={{ to: "/", index: "01", label: "Executive Pulse", hint: "KPIs & narrative" }}
        next={{ to: "/optimizations", index: "03", label: "Action & Allocation", hint: "Simulate budget shifts" }}
      />
    </div>
  );
}
