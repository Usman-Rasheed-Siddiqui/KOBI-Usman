import type { Opportunity, SearchIntent } from "@openforge/domain";

export type AdapterHealth = {
  ok: boolean;
  latencyMs: number;
  message?: string;
  rateLimitedUntil?: string;
};

export interface SourceAdapter {
  id: string;
  name: string;
  supportedEntityTypes: string[];
  defaultConcurrency: number;
  search(intent: SearchIntent, signal?: AbortSignal): Promise<Opportunity[]>;
  healthCheck(signal?: AbortSignal): Promise<AdapterHealth>;
}

export type SearchStreamEvent =
  | { type: "session_started"; sessionId: string; query: string }
  | { type: "source_started"; source: string }
  | { type: "source_result"; source: string; count: number; items: Opportunity[] }
  | { type: "source_complete"; source: string; count: number; latencyMs: number }
  | { type: "source_failed"; source: string; message: string }
  | { type: "dedupe_complete"; before: number; after: number }
  | { type: "ranking_update"; count: number; items: Opportunity[] }
  | { type: "session_complete"; sessionId: string; count: number };
