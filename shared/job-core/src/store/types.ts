/**
 * Store type definitions per Doc 16 §3D and Doc 17 §4.
 */

import type { z } from "zod";
import type {
  employmentTypeSchema,
  remoteModeSchema,
  retentionClassSchema,
} from "../schemas/domain.js";
import type { Job, JobSummary } from "../schemas/job.js";
import type { Profile, ProfileInput } from "../schemas/profile.js";

export type RemoteMode = z.infer<typeof remoteModeSchema>;
export type EmploymentType = z.infer<typeof employmentTypeSchema>;
export type RetentionClass = z.infer<typeof retentionClassSchema>;

export interface ResolveDataDirOptions {
  readonly envValue?: string | undefined;
  readonly product: string;
  readonly platform: NodeJS.Platform;
  readonly home?: string | undefined;
  readonly appData?: string | undefined;
  readonly xdgDataHome?: string | undefined;
}

export interface OpenStoreOptions {
  readonly dataDir?: string | undefined;
  readonly memory?: boolean | undefined;
  readonly product: string;
  readonly now?: (() => string) | string | undefined;
}

export interface JobFilters {
  readonly remote_mode?: readonly RemoteMode[] | undefined;
  readonly employment_type?: readonly EmploymentType[] | undefined;
  readonly retention_class?: readonly RetentionClass[] | undefined;
}

export interface JobListOptions {
  readonly filters?: JobFilters | undefined;
  readonly pageSize?: number | undefined;
  readonly cursor?: string | undefined;
}

export interface JobSearchOptions extends JobListOptions {
  readonly query: string;
}

export interface JobPageResult {
  readonly items: readonly JobSummary[];
  readonly nextCursor: string | null;
}

export interface JobRepo {
  insert(job: Job): void;
  get(id: string): Job | null;
  findByFingerprint(fp: string): Job | null;
  list(opts?: JobListOptions): JobPageResult;
  search(opts: JobSearchOptions): JobPageResult;
  delete(id: string): boolean;
  count(): number;
  recent(limit?: number): Job[];
}

export interface ProfileRepo {
  upsert(
    profileInput: ProfileInput,
    options?: { profileId?: string; now?: string },
  ): { profile_id: string; profile: Profile };
  get(id: string): Profile | null;
  list(): Array<{ profile_id: string; label: string; updated_at: string }>;
  delete(id: string): boolean;
  count(): number;
}

export interface AuditEntry {
  readonly tool: string;
  readonly requestId: string;
  readonly outcome: "ok" | "error";
  readonly errorCode?: string | null | undefined;
  readonly subjectId?: string | null | undefined;
  readonly at?: string | undefined;
}

export interface AuditRow {
  readonly id: number;
  readonly at: string;
  readonly tool: string;
  readonly request_id: string;
  readonly outcome: string;
  readonly error_code: string | null;
  readonly subject_hash: string | null;
}

export interface AuditRepo {
  append(entry: AuditEntry): void;
  list(limit?: number): AuditRow[];
  count(): number;
}

export interface PurgeTokenSummary {
  readonly token: string;
  readonly expires_at: string;
  readonly summary: {
    readonly jobs: number;
    readonly profiles: number;
  };
}

export interface PurgeResult {
  readonly purged_jobs: number;
  readonly purged_profiles: number;
  readonly purged_audit: number;
}

export interface ExportAllResult {
  readonly export_version: "1";
  readonly exported_at: string;
  readonly jobs: readonly Job[];
  readonly profiles: readonly Profile[];
}

export interface DataRightsRepo {
  exportAll(now?: string): ExportAllResult;
  createPurgeToken(now?: string): PurgeTokenSummary;
  purge(token: string, now?: string): PurgeResult;
}

export interface Store {
  readonly jobs: JobRepo;
  readonly profiles: ProfileRepo;
  readonly audit: AuditRepo;
  readonly rights: DataRightsRepo;
  close(): void;
}
