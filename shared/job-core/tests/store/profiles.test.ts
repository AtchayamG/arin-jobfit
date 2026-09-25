import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StoreError } from "../../src/store/error.js";
import { openStore } from "../../src/store/open.js";
import { SqliteProfileRepo } from "../../src/store/profiles.js";
import type { Store } from "../../src/store/types.js";
import { createTestProfileInput } from "./fixtures.js";

describe("ProfileRepo", () => {
  let store: Store;

  beforeEach(() => {
    store = openStore({ memory: true, product: "naukri" });
  });

  afterEach(() => {
    store.close();
  });

  it("creates a new profile with generated prof_<uuid> ID when profileId is omitted", () => {
    const input = createTestProfileInput();
    const result = store.profiles.upsert(input);

    expect(result.profile_id).toMatch(
      /^prof_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(result.profile.created_at).toBeDefined();
    expect(result.profile.updated_at).toBe(result.profile.created_at);
    expect(result.profile.label).toBe(input.label);
    expect(store.profiles.count()).toBe(1);

    const fetched = store.profiles.get(result.profile_id);
    expect(fetched).not.toBeNull();
    expect(fetched?.label).toBe(input.label);
  });

  it("creates a new profile with specified profileId when not existing", () => {
    const input = createTestProfileInput({ label: "Explicit ID Profile" });
    const explicitId = "prof_00000000-0000-4000-8000-000000000099";

    const result = store.profiles.upsert(input, { profileId: explicitId });
    expect(result.profile_id).toBe(explicitId);
    expect(store.profiles.get(explicitId)?.label).toBe("Explicit ID Profile");
  });

  it("updates existing profile preserving created_at and updating updated_at", () => {
    const input1 = createTestProfileInput({ label: "Initial Version" });
    const t1 = "2026-09-01T10:00:00Z";
    const res1 = store.profiles.upsert(input1, { now: t1 });

    const input2 = createTestProfileInput({ label: "Updated Version" });
    const t2 = "2026-09-15T12:00:00Z";
    const res2 = store.profiles.upsert(input2, {
      profileId: res1.profile_id,
      now: t2,
    });

    expect(res2.profile_id).toBe(res1.profile_id);
    expect(res2.profile.created_at).toBe(t1);
    expect(res2.profile.updated_at).toBe(t2);
    expect(res2.profile.label).toBe("Updated Version");
    expect(store.profiles.count()).toBe(1);
  });

  it("lists profiles ordered by updated_at DESC", () => {
    const p1 = store.profiles.upsert(createTestProfileInput({ label: "P1" }), {
      now: "2026-09-01T00:00:00Z",
    });
    const p2 = store.profiles.upsert(createTestProfileInput({ label: "P2" }), {
      now: "2026-09-02T00:00:00Z",
    });

    const list = store.profiles.list();
    expect(list.length).toBe(2);
    expect(list[0]?.profile_id).toBe(p2.profile_id);
    expect(list[1]?.profile_id).toBe(p1.profile_id);
  });

  it("deletes a profile by ID and reports deletion status", () => {
    const res = store.profiles.upsert(createTestProfileInput());
    expect(store.profiles.count()).toBe(1);

    expect(store.profiles.delete(res.profile_id)).toBe(true);
    expect(store.profiles.count()).toBe(0);
    expect(store.profiles.get(res.profile_id)).toBeNull();

    expect(store.profiles.delete(res.profile_id)).toBe(false);
  });

  it("rejects malformed profile IDs with INVALID_ID", () => {
    const badIds = ["bad_id", "job_00000000-0000-4000-8000-000000000001", "123", ""];
    for (const badId of badIds) {
      expect(() => store.profiles.get(badId)).toThrow(StoreError);
      expect(() => store.profiles.delete(badId)).toThrow(StoreError);
      expect(() => store.profiles.upsert(createTestProfileInput(), { profileId: badId })).toThrow(
        StoreError,
      );
    }
  });

  it("handles corrupt profile rows by throwing CORRUPT_ROW", () => {
    const rawDb = new DatabaseSync(":memory:");
    rawDb.exec(
      "CREATE TABLE profiles (profile_id TEXT PRIMARY KEY, label TEXT, updated_at TEXT, json TEXT);",
    );
    rawDb.exec(
      "INSERT INTO profiles VALUES ('prof_00000000-0000-4000-8000-000000000001', 'bad', '2026-09-01', '{broken json');",
    );

    const repo = new SqliteProfileRepo(rawDb);
    expect(() => repo.get("prof_00000000-0000-4000-8000-000000000001")).toThrow(StoreError);
    rawDb.close();
  });

  it("enforces the 50-profile limit and allows updating existing profiles at the limit", () => {
    // Insert 50 profiles
    const ids: string[] = [];
    for (let i = 0; i < 50; i++) {
      const res = store.profiles.upsert(createTestProfileInput({ label: `Profile ${String(i)}` }));
      ids.push(res.profile_id);
    }
    expect(store.profiles.count()).toBe(50);

    // 51st profile insertion without profileId throws LIMIT_EXCEEDED
    expect(() => store.profiles.upsert(createTestProfileInput())).toThrow(StoreError);
    try {
      store.profiles.upsert(createTestProfileInput());
    } catch (e) {
      expect(e instanceof StoreError && e.code === "LIMIT_EXCEEDED").toBe(true);
    }

    // 51st profile insertion with new explicit profileId throws LIMIT_EXCEEDED
    const newId = "prof_00000000-0000-4000-8000-ffffffffffff";
    expect(() => store.profiles.upsert(createTestProfileInput(), { profileId: newId })).toThrow(
      StoreError,
    );

    // Updating existing profile among the 50 succeeds
    const existingId = ids[0] ?? "";
    expect(() =>
      store.profiles.upsert(createTestProfileInput({ label: "Updated at Limit" }), {
        profileId: existingId,
      }),
    ).not.toThrow();
    expect(store.profiles.get(existingId)?.label).toBe("Updated at Limit");
  });

  it("handles minimal profile inputs where optional fields are omitted", () => {
    const minimalInput = {
      label: "Minimal Dev",
      headline: "Developer",
      total_experience_years: 1,
      skills: [{ name: "Python" }],
      roles: [],
      education: [{ qualification: "B.S.", institution: "Univ" }],
      certifications: [{ name: "Cert" }],
      preferences: {
        locations: [],
        remote_modes: [],
        employment_types: [],
        deal_breakers: [],
      },
    };

    // Calling upsert without second options parameter
    const res = store.profiles.upsert(minimalInput);
    expect(res.profile.skills[0]?.years).toBeNull();
    expect(res.profile.skills[0]?.level).toBeNull();
    expect(res.profile.education[0]?.year).toBeNull();
    expect(res.profile.certifications[0]?.issuer).toBeNull();
    expect(res.profile.certifications[0]?.year).toBeNull();
    expect(res.profile.preferences.min_compensation).toBeNull();
    expect(res.profile.summary_text).toBeNull();
  });
});
