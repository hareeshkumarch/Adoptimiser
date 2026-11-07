import { FlowStepBar } from "../components/common/FlowStepBar";
import { DrilldownTable } from "../components/drilldown/DrilldownTable";

export default function DrilldownPage() {
  return (
    <div className="space-y-12" data-testid="page-drilldown">
      <DrilldownTable />
      <FlowStepBar
        prev={{ to: "/optimizations", index: "03", label: "Action & Allocation", hint: "Prescriptions & simulator" }}
        next={{ to: "/agent", index: "05", label: "LangGraph Studio", hint: "Inspect reasoning DAG & scratchpad" }}
      />
    </div>
  );
}
