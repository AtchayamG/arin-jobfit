import { z } from "zod";
import { profileInputSchema, profileSchema } from "../schemas/index.js";
import { def, empty, id, profileId, type ToolDef } from "./catalog-shapes.js";

export const miscToolDefs: readonly ToolDef[] = [
  def(
    "profile_delete",
    "Delete profile",
    "Delete one locally stored profile.",
    "l0.local_store",
    profileId,
    z.strictObject({ deleted: z.boolean() }),
    false,
    true,
    true,
  ),
  def(
    "profile_get",
    "Get profile",
    "Read a locally stored profile.",
    "l0.local_store",
    profileId,
    z.strictObject({ profile: profileSchema }),
    true,
    false,
    true,
  ),
  def(
    "profile_list",
    "List profiles",
    "List local profile identifiers and labels.",
    "l0.local_store",
    empty,
    z.strictObject({
      items: z.array(z.strictObject({ profile_id: id, label: z.string(), updated_at: z.string() })),
    }),
    true,
    false,
    true,
  ),
  def(
    "profile_upsert",
    "Upsert profile",
    "Create or update a locally stored profile.",
    "l0.local_store",
    z.strictObject({ profile: profileInputSchema, profile_id: id.optional() }),
    z.strictObject({ profile_id: id, profile: profileSchema }),
  ),
  def(
    "provider_capabilities",
    "Provider capabilities",
    "Report capability gates and approval status for this independent product.",
    "l0.analysis",
    empty,
    z.strictObject({
      capabilities: z.array(
        z.strictObject({
          id: z.string(),
          level: z.string(),
          status: z.string(),
          reason: z.string(),
          approval_ref: z.string().nullable(),
        }),
      ),
    }),
    true,
  ),
  def(
    "provider_policy_status",
    "Provider policy status",
    "Report the policy snapshot and documented approvals.",
    "l0.analysis",
    empty,
    z.strictObject({
      snapshot_date: z.string(),
      stale: z.boolean(),
      stale_after_days: z.number(),
      partner_approval_recorded: z.boolean(),
      approvals: z.array(z.string()),
    }),
    true,
  ),
];
