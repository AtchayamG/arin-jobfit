/**
 * SQLite implementation of ProfileRepo.
 *
 * Implements bounded profile storage (max 50), schema-validated reads,
 * and upsert logic per Doc 16 §3D.
 */

import crypto from "node:crypto";
import type { DatabaseSync, StatementSync } from "node:sqlite";
import {
  type Profile,
  type ProfileInput,
  profileInputSchema,
  profileSchema,
} from "../schemas/profile.js";
import { StoreError } from "./error.js";
import { validateProfileId } from "./id.js";
import type { ProfileRepo } from "./types.js";

const MAX_PROFILES_LIMIT = 50;

function parseProfileJson(jsonStr: string): Profile {
  try {
    const raw = JSON.parse(jsonStr) as unknown;
    return profileSchema.parse(raw);
  } catch {
    throw new StoreError("CORRUPT_ROW", "Corrupt profile row in database");
  }
}

export class SqliteProfileRepo implements ProfileRepo {
  private readonly db: DatabaseSync;
  private readonly countStmt: StatementSync;
  private readonly getStmt: StatementSync;
  private readonly insertStmt: StatementSync;
  private readonly listStmt: StatementSync;
  private readonly deleteStmt: StatementSync;

  constructor(db: DatabaseSync) {
    this.db = db;
    this.countStmt = this.db.prepare("SELECT COUNT(*) as c FROM profiles;");
    this.getStmt = this.db.prepare("SELECT json FROM profiles WHERE profile_id = ?;");
    this.insertStmt = this.db.prepare(
      "INSERT OR REPLACE INTO profiles (profile_id, label, updated_at, json) VALUES (?, ?, ?, ?);",
    );
    this.listStmt = this.db.prepare(
      "SELECT profile_id, label, updated_at FROM profiles ORDER BY updated_at DESC;",
    );
    this.deleteStmt = this.db.prepare("DELETE FROM profiles WHERE profile_id = ?;");
  }

  count(): number {
    const row = this.countStmt.get() as { c: number };
    return row.c;
  }

  upsert(
    profileInput: ProfileInput,
    options?: { profileId?: string; now?: string },
  ): { profile_id: string; profile: Profile } {
    const validatedInput = profileInputSchema.parse(profileInput);
    const nowStr = options?.now ?? new Date().toISOString();

    let profileId: string;
    let createdAt: string;

    if (options?.profileId !== undefined) {
      validateProfileId(options.profileId);
      profileId = options.profileId;
      const existingRow = this.getStmt.get(profileId) as { json: string } | undefined;
      if (existingRow) {
        const existing = parseProfileJson(existingRow.json);
        createdAt = existing.created_at;
      } else {
        if (this.count() >= MAX_PROFILES_LIMIT) {
          throw new StoreError("LIMIT_EXCEEDED", "Profile store limit of 50 exceeded");
        }
        createdAt = nowStr;
      }
    } else {
      if (this.count() >= MAX_PROFILES_LIMIT) {
        throw new StoreError("LIMIT_EXCEEDED", "Profile store limit of 50 exceeded");
      }
      profileId = `prof_${crypto.randomUUID()}`;
      createdAt = nowStr;
    }

    const candidateProfile: Profile = {
      profile_id: profileId,
      schema_version: "1",
      created_at: createdAt,
      updated_at: nowStr,
      label: validatedInput.label,
      headline: validatedInput.headline,
      total_experience_years: validatedInput.total_experience_years,
      skills: validatedInput.skills.map((s) => ({
        name: s.name,
        years: s.years ?? null,
        level: s.level ?? null,
      })),
      roles: validatedInput.roles,
      education: validatedInput.education.map((e) => ({
        qualification: e.qualification,
        institution: e.institution,
        year: e.year ?? null,
      })),
      certifications: validatedInput.certifications.map((c) => ({
        name: c.name,
        issuer: c.issuer ?? null,
        year: c.year ?? null,
      })),
      preferences: {
        locations: validatedInput.preferences.locations,
        remote_modes: validatedInput.preferences.remote_modes,
        employment_types: validatedInput.preferences.employment_types,
        deal_breakers: validatedInput.preferences.deal_breakers,
        min_compensation: validatedInput.preferences.min_compensation ?? null,
      },
      summary_text: validatedInput.summary_text ?? null,
    };

    const validatedProfile = profileSchema.parse(candidateProfile);
    const jsonStr = JSON.stringify(validatedProfile);

    this.insertStmt.run(profileId, validatedProfile.label, validatedProfile.updated_at, jsonStr);

    return { profile_id: profileId, profile: validatedProfile };
  }

  get(id: string): Profile | null {
    validateProfileId(id);
    const row = this.getStmt.get(id) as { json: string } | undefined;
    if (!row) return null;
    return parseProfileJson(row.json);
  }

  list(): Array<{ profile_id: string; label: string; updated_at: string }> {
    const rows = this.listStmt.all() as Array<{
      profile_id: string;
      label: string;
      updated_at: string;
    }>;
    return rows;
  }

  delete(id: string): boolean {
    validateProfileId(id);
    const result = this.deleteStmt.run(id);
    return Number(result.changes) > 0;
  }
}
