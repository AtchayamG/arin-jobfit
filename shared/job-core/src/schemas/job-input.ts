import { z } from "zod";

export const jobInputSchema = z.strictObject({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(50_000),
  company: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  source_url: z.string().max(2_048).optional(),
  employment_type_text: z.string().max(100).optional(),
  experience_text: z.string().max(100).optional(),
  compensation_text: z.string().max(200).optional(),
  posted_at_text: z.string().max(100).optional(),
  provider_job_id: z.string().max(100).optional(),
  origin: z.enum(["user_paste", "agent_relay"]).default("user_paste"),
  relay_source: z.string().max(100).optional(),
});

export type JobInput = z.infer<typeof jobInputSchema>;
