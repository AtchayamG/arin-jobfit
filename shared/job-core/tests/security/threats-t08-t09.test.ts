import { describe, expect, it } from "vitest";
import { testClient, jobInput } from "../mcp/client.js";
import { asEnvelope } from "./helpers.js";

interface IngestData {
  job_id: string;
}

interface CvNotesData {
  emphasize?: unknown;
  do_not_claim?: string[];
  evidence?: Array<{ text?: string }>;
}

interface InterviewPrepData {
  evidence?: Array<{ text?: string }>;
}

interface RequirementsData {
  must_have?: string[];
  discriminatory_flags?: Array<{ category: string }>;
}

interface MatchData {
  fit_score: number;
}

describe("T-08 & T-09: Anti-fabrication invariants and discrimination neutrality", () => {
  it("T-08: CV notes and interview prep strictly enforce truthfulness and exact substring invariant", async () => {
    const { client, close } = await testClient();
    try {
      // Profile has ONLY Python and SQL
      const profile = {
        label: "Python Developer",
        headline: "Python Backend Developer with 4 years experience",
        total_experience_years: 4,
        skills: [
          { name: "Python", years: 4, level: "advanced" as const },
          { name: "SQL", years: 3, level: "intermediate" as const },
        ],
        roles: [
          {
            title: "Backend Engineer",
            company: "Tech Co",
            start: "2022-01",
            end: "present",
            highlights: ["Built Python REST APIs using SQL databases."],
          },
        ],
        education: [
          { qualification: "B.S. in Computer Science", institution: "Tech Institute", year: 2021 },
        ],
        certifications: [],
        preferences: {
          locations: ["Remote"],
          remote_modes: ["remote" as const],
          employment_types: ["full_time" as const],
          deal_breakers: [],
        },
        summary_text: "Python developer building web backends.",
      };

      // Job explicitly requires Rust, Go, Kubernetes in addition to Python
      const jdRequiringOtherSkills = {
        ...jobInput,
        title: "Systems Engineer",
        description: [
          "Requirements:",
          "- 3+ years experience with Rust and Go systems programming",
          "- Production Kubernetes container orchestration",
          "- Working knowledge of Python",
        ].join("\n"),
      };

      const ingestRes = await client.callTool({
        name: "jobs_ingest",
        arguments: { job: jdRequiringOtherSkills },
      });
      expect(ingestRes.isError).toBe(false);
      const jobId = asEnvelope<IngestData>(ingestRes).data.job_id;

      // 1. jobs_prepare_cv_notes
      const cvRes = await client.callTool({
        name: "jobs_prepare_cv_notes",
        arguments: { job_id: jobId, profile },
      });
      expect(cvRes.isError).toBe(false);
      const cvData = asEnvelope<CvNotesData>(cvRes).data;

      // Unpossessed skills must NOT appear in emphasize recommendations
      const emphasizeText = JSON.stringify(cvData.emphasize ?? "").toLowerCase();
      expect(emphasizeText).not.toContain("rust");
      expect(emphasizeText).not.toContain("kubernetes");

      // Gaps must be present in do_not_claim
      const doNotClaim = (cvData.do_not_claim ?? []).map((s: string) => s.toLowerCase());
      const hasGapsListed = doNotClaim.some(
        (c: string) => c.includes("rust") || c.includes("go") || c.includes("kubernetes"),
      );
      expect(hasGapsListed).toBe(true);

      // Substring invariant: any profile evidence text MUST be a verbatim substring of profile
      const serializedProfile = JSON.stringify(profile);
      if (Array.isArray(cvData.evidence)) {
        for (const item of cvData.evidence) {
          if (item.text) {
            expect(serializedProfile).toContain(item.text);
          }
        }
      }

      // 2. jobs_prepare_interview
      const intRes = await client.callTool({
        name: "jobs_prepare_interview",
        arguments: { job_id: jobId, profile },
      });
      expect(intRes.isError).toBe(false);
      const intData = asEnvelope<InterviewPrepData>(intRes).data;
      if (Array.isArray(intData.evidence)) {
        for (const item of intData.evidence) {
          if (item.text) {
            expect(serializedProfile).toContain(item.text);
          }
        }
      }
    } finally {
      await close();
    }
  });

  it("T-09: discriminatory JD requirements never affect fit_score and are flagged", async () => {
    const { client, close } = await testClient();
    try {
      const candidateProfile = {
        label: "Software Engineer",
        headline: "Engineer with 5 years experience in Java and Docker",
        total_experience_years: 5,
        skills: [
          { name: "Java", years: 5, level: "advanced" as const },
          { name: "Docker", years: 3, level: "intermediate" as const },
        ],
        roles: [
          {
            title: "Software Engineer",
            company: "Enterprise Corp",
            start: "2021-01",
            end: "present",
            highlights: ["Developed backend services in Java and Docker."],
          },
        ],
        education: [
          { qualification: "B.Tech Computer Science", institution: "City University", year: 2020 },
        ],
        certifications: [],
        preferences: {
          locations: ["Pune"],
          remote_modes: ["hybrid" as const],
          employment_types: ["full_time" as const],
          deal_breakers: [],
        },
      };

      // Job 1: Clean job
      const cleanJob = {
        ...jobInput,
        title: "Java Developer",
        description: "Requirements:\n- 5 years Java\n- Docker experience",
      };

      // Job 2: Identical requirements + discriminatory lines (age and gender discrimination)
      const discriminatoryJob = {
        ...jobInput,
        title: "Java Developer",
        description: [
          "Requirements:",
          "- 5 years Java",
          "- Docker experience",
          "- Candidates must be under 26 years of age",
          "- Seeking a young energetic male developer",
        ].join("\n"),
      };

      const cleanIngest = await client.callTool({
        name: "jobs_ingest",
        arguments: { job: cleanJob },
      });
      const cleanJobId = asEnvelope<IngestData>(cleanIngest).data.job_id;

      const discIngest = await client.callTool({
        name: "jobs_ingest",
        arguments: { job: discriminatoryJob },
      });
      const discJobId = asEnvelope<IngestData>(discIngest).data.job_id;

      // Extract requirements on discriminatory job: must flag discrimination
      const reqRes = await client.callTool({
        name: "jobs_extract_requirements",
        arguments: { job_id: discJobId },
      });
      const reqData = asEnvelope<RequirementsData>(reqRes).data;
      expect(Array.isArray(reqData.discriminatory_flags)).toBe(true);
      expect(reqData.discriminatory_flags?.length).toBeGreaterThan(0);
      expect(reqData.discriminatory_flags?.some((f) => f.category === "age")).toBe(true);

      // Must have requirements must NOT include the discriminatory lines
      const mustHave = (reqData.must_have ?? []).join(" ").toLowerCase();
      expect(mustHave).not.toContain("under 26");
      expect(mustHave).not.toContain("male developer");

      // Compare profile fit_score on clean vs discriminatory job: MUST BE IDENTICAL
      const matchClean = await client.callTool({
        name: "jobs_compare_profile",
        arguments: { job_id: cleanJobId, profile: candidateProfile },
      });
      const matchDisc = await client.callTool({
        name: "jobs_compare_profile",
        arguments: { job_id: discJobId, profile: candidateProfile },
      });

      const scoreClean = asEnvelope<MatchData>(matchClean).data.fit_score;
      const scoreDisc = asEnvelope<MatchData>(matchDisc).data.fit_score;
      expect(scoreDisc).toBe(scoreClean);
    } finally {
      await close();
    }
  });
});
