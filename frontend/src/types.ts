import { z } from "zod";

const n = z.number().nullable();

export const PlatformSchema = z.enum(["meta", "google", "tiktok", "linkedin"]);
export const WindowSchema = z.enum(["1d_click", "7d_click", "data_driven"]);
export const CompareSchema = z.enum(["previous_period", "rolling_30d"]);
export const LevelSchema = z.enum(["platform", "campaign", "adset", "creative"]);
export const CurrencySchema = z.enum(["USD", "EUR", "GBP"]);
export const SeveritySchema = z.enum(["critical", "warning"]);
const PlatformOrMulti = z.union([PlatformSchema, z.literal("multi")]);

export type Platform = z.infer<typeof PlatformSchema>;
export type AttributionWindow = z.infer<typeof WindowSchema>;
export type Compare = z.infer<typeof CompareSchema>;
export type Level = z.infer<typeof LevelSchema>;
export type Currency = z.infer<typeof CurrencySchema>;
export type Severity = z.infer<typeof SeveritySchema>;

export const AccountSchema = z.object({
  account_id: z.string(),
  platform: PlatformSchema,
  name: z.string(),
  currency: z.string().nullable(),
  source: z.enum(["sandbox", "oauth"]),
  connection_id: z.string().nullable(),
});
export type Account = z.infer<typeof AccountSchema>;

export const AccountsResponseSchema = z.object({ accounts: z.array(AccountSchema), fx_to_usd: z.record(CurrencySchema, z.number()) });

export const KpiSchema = z.object({
  key: z.string(),
  label: z.string(),
  format: z.enum(["currency", "ratio", "pct"]),
  value: n,
  baseline: n,
  delta_pct: n,
  spark: z.array(n),
});
export type Kpi = z.infer<typeof KpiSchema>;

export const PulseSeriesPointSchema = z.object({
  date: z.string(),
  spend: n,
  revenue: n,
  roas: n,
  mer: n,
  cpa: n,
  cpa_median: n,
  cpa_upper: n,
  cpa_z: n,
  meta_spend: z.number(),
  google_spend: z.number(),
  tiktok_spend: z.number(),
  linkedin_spend: z.number(),
});
export type PulseSeriesPoint = z.infer<typeof PulseSeriesPointSchema>;

export const PulseSchema = z.object({
  period: z.object({ start: z.string(), end: z.string(), compare: CompareSchema, window: WindowSchema }),
  kpis: z.array(KpiSchema),
  platforms: z.array(z.object({ platform: PlatformSchema, spend: z.number(), revenue: z.number(), roas: n, cpa: n, share: z.number() })),
  pacing: z.object({ mtd_spend: z.number(), month_budget: z.number(), projected_spend: z.number(), pace: n, day: z.number(), days_in_month: z.number() }),
  store: z.object({ revenue: z.number(), orders: z.number() }),
  series: z.array(PulseSeriesPointSchema).optional(),
});
export type Pulse = z.infer<typeof PulseSchema>;

export const BreakdownRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  platform: PlatformSchema,
  campaign: z.string().optional(),
  adset_id: z.string().optional(),
  adset: z.string().optional(),
  spend: z.number(),
  revenue: z.number(),
  conversions: z.number(),
  roas: n,
  cpa: n,
  cpm: n,
  ctr: n,
  hook_rate: n,
  hold_rate: n,
  frequency: n,
  is_lost: n,
  delta: z.object({ spend: n, roas: n, cpa: n, revenue: n }),
});
export type BreakdownRow = z.infer<typeof BreakdownRowSchema>;
export const BreakdownSchema = z.object({ level: LevelSchema, rows: z.array(BreakdownRowSchema) });

export const CheckSchema = z.object({ name: z.string(), label: z.string(), passed: z.boolean(), detail: z.string(), required: z.boolean() });
export type Check = z.infer<typeof CheckSchema>;

export const EvidenceStepSchema = z.object({ step: z.enum(["detected", "verified", "rejected"]), agent: z.string(), label: z.string() });
export type EvidenceStep = z.infer<typeof EvidenceStepSchema>;

const ImpactType = z.enum(["savings", "revenue", "misattributed"]);

export const FindingSchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  severity: SeveritySchema,
  platform: PlatformOrMulti,
  platforms: z.array(PlatformSchema).nullish(),
  campaign: z.string().nullable(),
  entity_level: z.string(),
  entity_ids: z.array(z.string()).optional(),
  entity_name: z.string(),
  headline: z.string(),
  metric: z.string(),
  baseline: n,
  recent: n,
  change: n,
  z: n.optional(),
  evidence: z.array(EvidenceStepSchema),
  dollar_impact: z.number(),
  impact_type: ImpactType,
  status: z.enum(["confirmed", "rejected"]),
  confidence: z.number(),
  critic: z.object({ checks: z.array(CheckSchema), challenge: z.string(), rationale: z.string(), rejection_reason: z.string().optional() }),
});
export type Finding = z.infer<typeof FindingSchema>;

export const SimulatorSchema = z.object({ from: PlatformSchema, to: PlatformSchema, default_pct: z.number(), max_pct: z.number(), base_spend: z.number() });
export type Simulator = z.infer<typeof SimulatorSchema>;

export const PrescriptionSchema = z.object({
  id: z.string(),
  finding_id: z.string(),
  kind: z.string(),
  platform: PlatformOrMulti,
  platforms: z.array(PlatformSchema).nullish(),
  severity: SeveritySchema,
  dollar_impact: z.number(),
  impact_type: ImpactType,
  confidence: z.number(),
  score: z.number(),
  horizon_days: z.number(),
  title: z.string(),
  steps: z.array(z.string()),
  simulator: SimulatorSchema.nullable(),
});
export type Prescription = z.infer<typeof PrescriptionSchema>;

export const CurveGridPointSchema = z.object({
  multiplier: z.number(),
  spend: z.number(),
  revenue: z.number(),
  avg_roas: z.number(),
  marginal_roas: z.number(),
});
export type CurveGridPoint = z.infer<typeof CurveGridPointSchema>;

export const CurveSchema = z.object({
  spend: z.number(),
  revenue: z.number(),
  elasticity: z.number(),
  grid: z.array(CurveGridPointSchema).optional(),
});
export type Curve = z.infer<typeof CurveSchema>;

export const ForensicRowSchema = z.object({
  platform: PlatformSchema,
  ctr_cur: z.number(),
  click_to_session_rate: z.number(),
  click_to_session_delta: z.number(),
  lp_cvr_cur: z.number(),
  lp_cvr_delta: z.number(),
  pixel_vs_server_ratio: z.number(),
  cpm_delta: z.number(),
  hook_delta: n,
  hold_delta: n,
  primary_bottleneck: z.string(),
});
export type ForensicRow = z.infer<typeof ForensicRowSchema>;

export const PortfolioAllocationRowSchema = z.object({
  platform: PlatformSchema,
  base_spend: z.number(),
  optimal_spend: z.number(),
  delta_spend: z.number(),
  delta_pct: z.number(),
  base_revenue: z.number(),
  optimal_revenue: z.number(),
  elasticity: z.number(),
  marginal_roas_base: z.number(),
  marginal_roas_optimal: z.number(),
});
export type PortfolioAllocationRow = z.infer<typeof PortfolioAllocationRowSchema>;

export const PortfolioSchema = z.object({
  total_spend: z.number().optional(),
  base_revenue: z.number().optional(),
  optimal_revenue: z.number().optional(),
  revenue_lift: z.number().optional(),
  base_roas: z.number().optional(),
  optimal_roas: z.number().optional(),
  allocations: z.array(PortfolioAllocationRowSchema).optional(),
});
export type Portfolio = z.infer<typeof PortfolioSchema>;

export const RecursionGuardSchema = z.object({
  pass_current: z.number(),
  pass_max: z.number(),
  pass_label: z.string(),
  superstep_current: z.number(),
  superstep_max: z.number(),
  superstep_label: z.string(),
  node_visits: z.number(),
  node_budget: z.number(),
  remaining_steps: z.number(),
});
export type RecursionGuard = z.infer<typeof RecursionGuardSchema>;

export const GraphCheckpointSchema = z.object({
  step: z.number(),
  node: z.string(),
  duration_ms: z.number(),
  files_count: z.number().optional(),
  trace_seq: z.number().optional(),
  summary: z.record(z.unknown()).optional(),
});
export type GraphCheckpoint = z.infer<typeof GraphCheckpointSchema>;

export const GraphTopologySchema = z.object({
  engine: z.string(),
  control_plane: z
    .object({
      max_supersteps: z.number(),
      recursion_limit: z.number(),
      max_passes: z.number(),
      epsilon_confidence: z.number(),
    })
    .optional(),
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      role: z.string(),
      stage: z.number(),
      parallel_group: z.string().nullable().optional(),
      visit_budget: z.number().optional(),
      timeout_s: z.number().optional(),
    }),
  ),
  edges: z.array(z.object({ source: z.string(), target: z.string(), conditional: z.boolean(), label: z.string().nullable().optional() })),
  mermaid: z.string(),
});
export type GraphTopology = z.infer<typeof GraphTopologySchema>;

export const GraphMetaSchema = z.object({
  engine: z.string().optional(),
  steps: z.number().optional(),
  max_supersteps: z.number().optional(),
  recursion_limit: z.number().optional(),
  node_visits: z.record(z.number()).optional(),
  circuit_breaker_events: z.array(z.record(z.unknown())).optional(),
  halt_reason: z.string().optional(),
  checkpoints: z.array(GraphCheckpointSchema).optional(),
  executed_edges: z.array(z.object({ source: z.string(), target: z.string(), conditional: z.boolean(), branch: z.string().nullable().optional(), step: z.number().optional() })).optional(),
  topology: GraphTopologySchema.optional(),
});
export type GraphMeta = z.infer<typeof GraphMetaSchema>;

export const TodoSchema = z.object({ id: z.string(), title: z.string(), owner: z.string(), status: z.enum(["pending", "in_progress", "done"]) });
export type Todo = z.infer<typeof TodoSchema>;
export type TodoStatus = Todo["status"];

export const TableContentSchema = z.object({ columns: z.array(z.string()), rows: z.array(z.record(z.union([z.string(), z.number(), z.null()]))) });
export type TableContent = z.infer<typeof TableContentSchema>;

export const ScratchFileSchema = z.object({ path: z.string(), author: z.string(), kind: z.enum(["json", "table", "markdown"]), content: z.unknown(), created_at: z.string() });
export type ScratchFile = z.infer<typeof ScratchFileSchema>;

const EventBase = z.object({
  seq: z.number(),
  ts: z.string().nullable(),
  type: z.string(),
  agent: z.string(),
  title: z.string().optional(),
  tool: z.string().optional(),
  args: z.record(z.unknown()).optional(),
  summary: z.string().optional(),
  ms: z.number().optional(),
  path: z.string().optional(),
  kind: ScratchFileSchema.shape.kind.optional(),
  content: z.unknown().optional(),
  created_at: z.string().optional(),
  todos: z.array(TodoSchema).optional(),
  delta: z.string().optional(),
  id: z.string().optional(),
  status: z.string().optional(),
  confidence: z.number().optional(),
  headline: z.string().optional(),
  entity: z.string().optional(),
  challenge: z.string().optional(),
  agents: z.array(z.string()).optional(),
  query: z.string().optional(),
  source: z.string().optional(),
  target: z.string().optional(),
  branch: z.string().optional(),
  conditional: z.boolean().optional(),
  step: z.number().optional(),
  duration_ms: z.number().optional(),
  percentage: z.number().optional(),
  stage_index: z.number().optional(),
  total_stages: z.number().optional(),
  stage_label: z.string().optional(),
  active_node: z.string().optional(),
  recursion_guard: RecursionGuardSchema.optional(),
  findings_count: z.number().optional(),
});

export const AgentRunSchema = z.object({
  run_id: z.string(),
  query: z.string(),
  scope: z.object({ platform: PlatformSchema.nullable(), account_id: z.string().nullable(), campaign: z.string().nullable().optional(), adset_id: z.string().nullable().optional() }),
  window: WindowSchema,
  status: z.enum(["completed", "failed"]),
  created_at: z.string(),
  completed_at: z.string().nullable(),
  todos: z.array(TodoSchema),
  files: z.array(ScratchFileSchema),
  trace: z.array(EventBase).optional(),
  findings: z.array(FindingSchema),
  rejected: z.array(FindingSchema),
  prescriptions: z.array(PrescriptionSchema),
  curves: z.record(CurveSchema),
  forensics: z.array(ForensicRowSchema).optional(),
  portfolio: PortfolioSchema.optional(),
  graph_meta: GraphMetaSchema.optional(),
  narrative: z.string(),
  error: z.string().nullable(),
});
export type AgentRun = z.infer<typeof AgentRunSchema>;

export const RunSummarySchema = z.object({
  run_id: z.string(),
  query: z.string(),
  scope: z.object({ platform: PlatformSchema.nullable(), account_id: z.string().nullable() }),
  window: WindowSchema,
  status: z.string(),
  created_at: z.string(),
  completed_at: z.string().nullable(),
  findings_count: z.number(),
  prescriptions_count: z.number(),
});
export type RunSummary = z.infer<typeof RunSummarySchema>;

export const AgentEventSchema = EventBase.extend({ run: AgentRunSchema.optional() });
export type AgentEvent = z.infer<typeof AgentEventSchema>;

export const ConnectionSchema = z.object({
  connection_id: z.string(),
  provider: PlatformSchema,
  expires_at: z.string().nullable(),
  scopes: z.array(z.string()),
  connected_at: z.string(),
  accounts: z.array(z.object({ account_id: z.string(), name: z.string(), currency: z.string().nullable() })),
  skipped_accounts: z.array(z.string()),
  discovery_error: z.string().nullable(),
});
export type Connection = z.infer<typeof ConnectionSchema>;

export const ConnectorSchema = z.object({
  provider: PlatformSchema,
  name: z.string(),
  scopes: z.array(z.string()),
  oauth_configured: z.boolean(),
  redirect_uri: z.string(),
  console_url: z.string(),
  credential_env: z.array(z.string()),
  sandbox_accounts: z.array(AccountSchema),
  connections: z.array(ConnectionSchema),
});
export type Connector = z.infer<typeof ConnectorSchema>;

export const CandidateDiscoverySchema = z.object({
  provider: PlatformSchema,
  name: z.string(),
  scopes: z.array(z.string()),
  forbidden_scopes: z.array(z.string()),
  candidates: z.array(
    z.object({
      account_id: z.string(),
      name: z.string(),
      currency: z.string().nullable(),
      already_linked: z.boolean(),
    }),
  ),
});
export type CandidateDiscovery = z.infer<typeof CandidateDiscoverySchema>;

export const EvaluationSchema = z.object({
  run_id: z.string(),
  precision: n,
  recall: n,
  f1: n,
  issues: z.array(z.object({ kind: z.string(), label: z.string(), detected_by: z.string().nullable() })),
  false_positives: z.array(z.object({ id: z.string(), headline: z.string() })),
  traps: z.object({ raised: z.number(), filtered: z.number(), labels: z.array(z.string()) }),
  critic_filter_rate: n,
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

export const BenchmarkSchema = z.object({
  seeds: z.number(),
  window: WindowSchema,
  precision: n,
  recall: n,
  f1: n,
  trap_filter_rate: n,
  runs: z.array(z.object({ seed: z.number(), precision: n, recall: n, f1: n, traps_filtered: z.number(), traps_raised: z.number(), missed: z.array(z.string()) })),
});
export type Benchmark = z.infer<typeof BenchmarkSchema>;
