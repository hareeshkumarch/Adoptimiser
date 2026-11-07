import { AgentWorkspace } from "../components/agent/AgentWorkspace";
import { FlowStepBar } from "../components/common/FlowStepBar";

export default function AgentPage() {
  return (
    <div className="space-y-8" data-testid="page-agent">
      <AgentWorkspace />
      <FlowStepBar
        next={{ to: "/connections", index: "06", label: "Data Connectors", hint: "OAuth & sandbox streams" }}
      />
    </div>
  );
}
