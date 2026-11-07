import { AgentWorkspace } from "../components/agent/AgentWorkspace";
import { FlowStepBar } from "../components/common/FlowStepBar";
import { SectionHeader } from "../components/common/SectionHeader";

export default function AgentPage() {
  return (
    <div className="space-y-10" data-testid="page-agent">
      <SectionHeader index="05" kicker="StateGraph DAG · sub-agents · virtual scratchpad" title="LangGraph Studio" />
      <AgentWorkspace />
      <FlowStepBar
        prev={{ to: "/drilldown", index: "04", label: "Granular Explorer", hint: "Campaign & creative breakdown" }}
        next={{ to: "/connections", index: "06", label: "Data Connectors", hint: "OAuth & sandbox streams" }}
      />
    </div>
  );
}
