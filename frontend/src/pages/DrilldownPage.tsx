import { FlowStepBar } from "../components/common/FlowStepBar";
import { DrilldownTable } from "../components/drilldown/DrilldownTable";

export default function DrilldownPage() {
  return (
    <div className="space-y-9" data-testid="page-drilldown">
      <DrilldownTable />
      <FlowStepBar
        next={{ to: "/agent", index: "05", label: "LangGraph Studio", hint: "Inspect reasoning DAG & scratchpad" }}
      />
    </div>
  );
}
