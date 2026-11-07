import { FlowStepBar } from "../components/common/FlowStepBar";
import { PrescriptionSection } from "../components/optimize/PrescriptionSection";

export default function OptimizationsPage() {
  return (
    <div className="space-y-12" data-testid="page-optimizations">
      <PrescriptionSection />
      <FlowStepBar
        prev={{ to: "/diagnostics", index: "02", label: "Root-Cause Audit", hint: "Verified findings" }}
        next={{ to: "/drilldown", index: "04", label: "Granular Explorer", hint: "Inspect campaigns & creatives" }}
      />
    </div>
  );
}
