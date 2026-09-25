import type { z } from "zod";
import type { jobInputSchema, Profile } from "../../src/schemas/index.js";

export interface ScenarioJD {
  id: string;
  name: string;
  provider: "naukri" | "indeed";
  input: z.input<typeof jobInputSchema>;
  expected: {
    required_skills_superset: string[];
    preferred_skills_superset?: string[];
    experience: [number | null, number | null];
    compensation: {
      currency: string | null;
      min: number | null;
      max: number | null;
      period: "year" | "month" | "hour" | "unknown";
      disclosed: boolean;
    };
    city: string | null;
    country: string | null;
    remote_mode: "hybrid" | "remote" | "onsite" | "unknown";
    employment_type:
      "full_time" | "part_time" | "contract" | "temporary" | "internship" | "unknown";
    discriminatory_categories?: Array<
      | "age"
      | "gender"
      | "religion"
      | "caste"
      | "marital_status"
      | "nationality_origin"
      | "disability"
      | "appearance"
    >;
    warning_codes?: string[];
  };
}

export interface ScenarioPair {
  id: string;
  jd: ScenarioJD;
  profile: Profile;
  expectedFitBand: "strong" | "moderate" | "weak";
  expectedMissingSkills: string[];
}
