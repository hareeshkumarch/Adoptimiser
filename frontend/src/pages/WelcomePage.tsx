import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuditStep } from "../components/onboarding/AuditStep";
import { ConnectStep } from "../components/onboarding/ConnectStep";
import { GoalStep } from "../components/onboarding/GoalStep";
import { WelcomeSteps } from "../components/onboarding/WelcomeSteps";
import { useWorkspace } from "../hooks/insights";
import { GOALS, insightsApi, type Goal } from "../lib/insights";

export default function WelcomePage() {
  const { data: ws } = useWorkspace();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal | null>(ws?.goal ?? null);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const saveGoal = async (v: { goal: Goal; business_name: string; target_roas: number | null; monthly_budget: number | null }) => {
    setSaving(true);
    try {
      await insightsApi.saveWorkspace({ ...v, business_name: v.business_name || null, onboarded: ws?.onboarded ?? false });
      await qc.invalidateQueries({ queryKey: ["workspace"] });
      setGoal(v.goal);
      setStep(1);
    } catch {
      toast.error("Could not save your goal");
    } finally {
      setSaving(false);
    }
  };

  const finish = async () => {
    const saved = await insightsApi.workspace();
    await insightsApi.saveWorkspace({ goal: goal ?? "cut_waste", business_name: saved.business_name ?? null, target_roas: saved.target_roas ?? null, monthly_budget: saved.monthly_budget ?? null, onboarded: true });
    await qc.invalidateQueries({ queryKey: ["workspace"] });
    navigate("/insights");
  };

  return (
    <div className="grid-paper min-h-screen bg-slate-2" data-testid="page-welcome">
      <header className="flex items-center justify-between border-b border-slate-12 bg-white px-5 py-3 sm:px-8">
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center bg-slate-12 font-serif text-lg text-white">Q</span>
          <span className="font-serif text-[20px] font-medium tracking-tight">Quorum</span>
        </span>
        {ws?.onboarded && <button type="button" className="btn-ghost h-9 px-4" onClick={() => navigate("/insights")} data-testid="welcome-skip-button">Back to app</button>}
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        {step === 0 && (
          <div className="mb-8 animate-fade-up">
            <p className="eyebrow flex items-center gap-2"><span className="h-1.5 w-1.5 bg-jade-9" /> Setup · about 1 minute</p>
            <h1 className="mt-2 max-w-3xl font-serif text-[40px] font-medium leading-[1.05] tracking-tight sm:text-[52px]">Find the money hiding in your ad accounts.</h1>
          </div>
        )}
        <WelcomeSteps step={step} />
        <div key={step} className="mt-8 animate-fade-up border border-slate-12 bg-white p-5 sm:p-8">
          {step === 0 && <GoalStep key={ws ? "ws" : "none"} initial={ws} onNext={saveGoal} saving={saving} />}
          {step === 1 && <ConnectStep onBack={() => setStep(0)} onNext={() => setStep(2)} />}
          {step === 2 && <AuditStep query={GOALS.find((g) => g.key === goal)?.query ?? GOALS[1].query} onFinish={finish} />}
        </div>
      </main>
    </div>
  );
}
