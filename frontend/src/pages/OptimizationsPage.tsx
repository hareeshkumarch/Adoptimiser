import { FlowStepBar } from "../components/common/FlowStepBar";
import { PrescriptionSection } from "../components/optimize/PrescriptionSection";

export default function OptimizationsPage() {
  return (
    <div className="space-y-9" data-testid="page-optimizations">
      <PrescriptionSection />
      <FlowStepBar
        next={{ to: "/drilldown", index: "04", label: "Granular Explorer", hint: "Inspect campaigns & creatives" }}
      />
    </div>
  );
}
