import axios, { isAxiosError } from "axios";
import { z } from "zod";
import {
  AccountsResponseSchema,
  AgentEventSchema,
  AgentRunSchema,
  BenchmarkSchema,
  BreakdownSchema,
  CandidateDiscoverySchema,
  ConnectionSchema,
  ConnectorSchema,
  EvaluationSchema,
  GraphTopologySchema,
  PlatformSchema,
  PulseSchema,
  RunSummarySchema,
  type AgentEvent,
  type AttributionWindow,
  type Compare,
  type Level,
  type Platform,
} from "../types";

const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api/v1`;
const http = axios.create({ baseURL: API, timeout: 30_000 });

export interface ScopeParams {
  platform: Platform | null;
  account_id: string | null;
  campaign?: string | null;
  adset_id?: string | null;
  window: AttributionWindow;
  compare: Compare;
}

export interface RunBody {
  query: string;
  scope: { platform: Platform | null; account_id: string | null; campaign?: string | null; adset_id?: string | null };
  window: AttributionWindow;
}

const clean = (p: object) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== null && v !== undefined));

async function get<T>(schema: z.ZodType<T>, url: string, params?: object): Promise<T> {
  const { data } = await http.get(url, { params: params && clean(params) });
  return schema.parse(data);
}

const RunEnvelope = z.object({ run: AgentRunSchema.nullable() });
const RunsListEnvelope = z.object({ runs: z.array(RunSummarySchema) });
const StartResponse = z.object({ run_id: z.string() });
const ConflictDetail = z.object({ detail: z.object({ run_id: z.string() }) });
const WizardConnectResponse = z.object({
  connection: ConnectionSchema,
  backfilled_rows: z.number(),
  partitions_synced: z.number(),
  reconciled: z.boolean(),
});
const SyncConnectionResponse = z.object({
  connection_id: z.string(),
  provider: PlatformSchema,
  synced_accounts: z.number(),
  backfilled_rows: z.number(),
  status: z.string(),
});

export const api = {
  accounts: () => get(AccountsResponseSchema, "/accounts"),
  pulse: (p: ScopeParams) => get(PulseSchema, "/pulse", p),
  breakdown: (p: ScopeParams & { level: Level }) => get(BreakdownSchema, "/breakdown", p).then((r) => r.rows),
  connectors: () => get(z.object({ connectors: z.array(ConnectorSchema) }), "/connectors").then((r) => r.connectors),
  connectorCandidates: (provider: Platform) => get(CandidateDiscoverySchema, `/connectors/${provider}/candidates`),
  wizardConnect: async (provider: Platform, accountIds: string[]) => {
    const { data } = await http.post(`/connectors/${provider}/wizard-connect`, { account_ids: accountIds });
    return WizardConnectResponse.parse(data);
  },
  syncConnection: async (connectionId: string) => {
    const { data } = await http.post(`/connections/${connectionId}/sync`);
    return SyncConnectionResponse.parse(data);
  },
  oauthStart: (provider: Platform) => get(z.object({ url: z.string().url() }), `/oauth/${provider}/start`).then((r) => r.url),
  reseedSandbox: async () => {
    const { data } = await http.post("/connectors/reseed");
    return data;
  },
  disconnect: async (connectionId: string) => {
    const { data } = await http.delete(`/connections/${connectionId}`);
    return z.object({ deleted: z.boolean() }).parse(data);
  },
  latestRun: () => get(RunEnvelope, "/deep-agent/runs/latest").then((r) => r.run),
  listRuns: () => get(RunsListEnvelope, "/deep-agent/runs").then((r) => r.runs),
  getRun: (runId: string) => get(RunEnvelope, `/deep-agent/runs/${runId}`).then((r) => r.run),
  graphTopology: () => get(GraphTopologySchema, "/deep-agent/graph"),
  activeRun: () => get(z.object({ run_id: z.string().nullable() }), "/deep-agent/active").then((r) => r.run_id),
  evaluation: (runId: string) => get(EvaluationSchema, `/deep-agent/runs/${runId}/evaluation`),
  benchmark: (seeds: number, window: AttributionWindow) => get(BenchmarkSchema, "/deep-agent/evaluation/benchmark", { seeds, window }),
  async startRun(body: RunBody): Promise<string> {
    try {
      const { data } = await http.post("/deep-agent/run", body);
      return StartResponse.parse(data).run_id;
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) return ConflictDetail.parse(err.response.data).detail.run_id;
      throw err;
    }
  },
};

const TERMINAL = new Set(["run_complete", "run_failed"]);

export function subscribeRun(runId: string, onEvent: (e: AgentEvent) => void, onError: (message: string) => void): () => void {
  const source = new EventSource(`${API}/deep-agent/runs/${runId}/events`);
  source.addEventListener("agent", (msg) => {
    try {
      const raw = JSON.parse((msg as MessageEvent<string>).data);
      const parsed = AgentEventSchema.safeParse(raw);
      if (!parsed.success) return onError("Received a malformed agent event");
      onEvent(parsed.data);
      if (TERMINAL.has(parsed.data.type)) source.close();
    } catch {
      onError("Received unparseable agent stream payload");
    }
  });
  source.onerror = () => {
    if (source.readyState === EventSource.CLOSED) onError("Lost connection to the agent stream");
  };
  return () => source.close();
}
