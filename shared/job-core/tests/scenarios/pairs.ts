import {
  JD_EDGE_01_INLINE,
  JD_EDGE_02_HTML_EMOJI,
  JD_EDGE_03_DISCRIMINATORY,
  JD_EDGE_04_HOSTILE,
} from "./fixtures-edge.js";
import { JD_IN_01, JD_IN_02, JD_IN_03, JD_IN_04 } from "./fixtures-indeed.js";
import { JD_NK_01, JD_NK_02, JD_NK_03, JD_NK_04 } from "./fixtures-naukri.js";
import { fresherProfile, midJavaProfile, seniorMobileProfile } from "./fixtures-profiles.js";
import type { ScenarioPair } from "./types.js";

export const SCENARIO_PAIRS: readonly ScenarioPair[] = [
  // JD_NK_01: Senior Java Backend (5-10y, Bengaluru)
  {
    id: "NK01_MidJava",
    jd: JD_NK_01,
    profile: midJavaProfile,
    expectedFitBand: "strong", // Skills + exp 5y + location Bengaluru match
    expectedMissingSkills: [],
  },
  {
    id: "NK01_Fresher",
    jd: JD_NK_01,
    profile: fresherProfile,
    expectedFitBand: "weak", // Missing Java, Spring Boot, Microservices, PostgreSQL, Docker; exp 0 < 5
    expectedMissingSkills: ["Java", "Spring Boot", "Microservices", "PostgreSQL", "Docker"],
  },
  {
    id: "NK01_SeniorMobile",
    jd: JD_NK_01,
    profile: seniorMobileProfile,
    expectedFitBand: "moderate", // 13y exp and Bengaluru match, but missing core Java backend stack
    expectedMissingSkills: ["Java", "Spring Boot", "Microservices", "PostgreSQL", "Docker"],
  },

  // JD_NK_02: Lead Angular Developer (8-14y, Bangalore)
  {
    id: "NK02_SeniorMobile",
    jd: JD_NK_02,
    profile: seniorMobileProfile,
    expectedFitBand: "strong", // Angular, TypeScript, RxJS, HTML, CSS match; exp 13y in 8-14y
    expectedMissingSkills: [],
  },
  {
    id: "NK02_MidJava",
    jd: JD_NK_02,
    profile: midJavaProfile,
    expectedFitBand: "weak", // Missing Angular, TypeScript, RxJS, HTML, CSS
    expectedMissingSkills: ["Angular", "TypeScript", "RxJS"],
  },
  {
    id: "NK02_Fresher",
    jd: JD_NK_02,
    profile: fresherProfile,
    expectedFitBand: "weak", // Missing Angular, TypeScript, RxJS; exp 0 < 8
    expectedMissingSkills: ["Angular", "TypeScript", "RxJS"],
  },

  // JD_NK_03: Junior Python Engineer (0-2y, Hyderabad)
  {
    id: "NK03_Fresher",
    jd: JD_NK_03,
    profile: fresherProfile,
    expectedFitBand: "strong", // Python, SQL, JS, HTML, CSS match; exp 0 in 0-2y; location Hyderabad
    expectedMissingSkills: [],
  },
  {
    id: "NK03_MidJava",
    jd: JD_NK_03,
    profile: midJavaProfile,
    expectedFitBand: "weak", // Missing Python; exp 5 > 2
    expectedMissingSkills: ["Python"],
  },

  // JD_NK_04: Principal Mobile Architect (10-15y, Chennai)
  {
    id: "NK04_SeniorMobile",
    jd: JD_NK_04,
    profile: seniorMobileProfile,
    expectedFitBand: "strong", // Flutter, Ionic, Capacitor, Angular, TS match; exp 13 in 10-15y; Chennai match
    expectedMissingSkills: [],
  },
  {
    id: "NK04_MidJava",
    jd: JD_NK_04,
    profile: midJavaProfile,
    expectedFitBand: "weak", // Missing mobile stack
    expectedMissingSkills: ["Flutter", "Ionic", "Capacitor", "Angular", "TypeScript"],
  },

  // JD_IN_01: Web Development Intern (0-1y, Remote)
  {
    id: "IN01_Fresher",
    jd: JD_IN_01,
    profile: fresherProfile,
    expectedFitBand: "strong", // HTML, CSS, JS, Python, SQL match; exp 0; remote match; internship match
    expectedMissingSkills: [],
  },
  {
    id: "IN01_MidJava",
    jd: JD_IN_01,
    profile: midJavaProfile,
    expectedFitBand: "weak", // 5y exp for 0-1y intern; missing HTML/CSS/JS/Python
    expectedMissingSkills: ["HTML", "CSS", "JavaScript", "Python"],
  },

  // JD_IN_02: Backend Engineer - Java & Cloud (4-7y, Pune)
  {
    id: "IN02_MidJava",
    jd: JD_IN_02,
    profile: midJavaProfile,
    expectedFitBand: "strong", // Java, Spring Boot, Microservices, REST, Docker, Postgres match; Pune match
    expectedMissingSkills: ["Kubernetes"], // Kubernetes in preferred
  },
  {
    id: "IN02_Fresher",
    jd: JD_IN_02,
    profile: fresherProfile,
    expectedFitBand: "weak", // Missing Java, Spring, Microservices, Docker, Postgres
    expectedMissingSkills: ["Java", "Spring Boot", "Microservices", "Docker", "PostgreSQL"],
  },
  {
    id: "IN02_SeniorMobile",
    jd: JD_IN_02,
    profile: seniorMobileProfile,
    expectedFitBand: "weak", // Missing Java, Spring, Docker, Postgres
    expectedMissingSkills: ["Java", "Spring Boot", "Microservices", "Docker", "PostgreSQL"],
  },

  // JD_IN_03: Mobile Engineering Lead (10+y, Chennai)
  {
    id: "IN03_SeniorMobile",
    jd: JD_IN_03,
    profile: seniorMobileProfile,
    expectedFitBand: "strong", // Angular, TS, Ionic, Capacitor, Flutter, RxJS match; 13y exp; Chennai match
    expectedMissingSkills: [],
  },
  {
    id: "IN03_MidJava",
    jd: JD_IN_03,
    profile: midJavaProfile,
    expectedFitBand: "weak", // Missing Angular, TS, Ionic, Capacitor, Flutter, RxJS
    expectedMissingSkills: ["Angular", "TypeScript", "Ionic", "Capacitor"],
  },

  // JD_IN_04: Full Stack Engineer (Java/Angular, 3-6y, Bengaluru)
  {
    id: "IN04_MidJava",
    jd: JD_IN_04,
    profile: midJavaProfile,
    expectedFitBand: "strong", // Matches Java/Spring/REST/Docker/Postgres, 5y in 3-6y range, Bengaluru match
    expectedMissingSkills: ["Angular", "TypeScript"],
  },
  {
    id: "IN04_SeniorMobile",
    jd: JD_IN_04,
    profile: seniorMobileProfile,
    expectedFitBand: "moderate", // Matches Angular/TS/REST, lacks Java/Spring Boot/Docker/Postgres
    expectedMissingSkills: ["Java", "Spring Boot"],
  },
  {
    id: "IN04_Fresher",
    jd: JD_IN_04,
    profile: fresherProfile,
    expectedFitBand: "weak", // Missing Java/Spring/Angular/TS; exp 0 < 3
    expectedMissingSkills: ["Java", "Spring Boot", "Angular", "TypeScript"],
  },

  // JD_EDGE_01_INLINE: Cloud DevOps (4+y, Noida)
  {
    id: "EDGE01_MidJava",
    jd: JD_EDGE_01_INLINE,
    profile: midJavaProfile,
    expectedFitBand: "moderate", // Matches Docker/AWS, lacks Kubernetes/Terraform
    expectedMissingSkills: ["Kubernetes", "Terraform"],
  },
  {
    id: "EDGE01_Fresher",
    jd: JD_EDGE_01_INLINE,
    profile: fresherProfile,
    expectedFitBand: "weak", // Missing Docker/K8s/Terraform; exp 0 < 4
    expectedMissingSkills: ["Docker", "Kubernetes", "AWS", "Terraform"],
  },

  // JD_EDGE_02_HTML_EMOJI: Frontend Specialist (6+y, Bengaluru)
  {
    id: "EDGE02_SeniorMobile",
    jd: JD_EDGE_02_HTML_EMOJI,
    profile: seniorMobileProfile,
    expectedFitBand: "strong", // Angular, TS, RxJS, HTML, CSS, Ionic, Capacitor match; 13y exp; Bengaluru match
    expectedMissingSkills: [],
  },
  {
    id: "EDGE02_Fresher",
    jd: JD_EDGE_02_HTML_EMOJI,
    profile: fresherProfile,
    expectedFitBand: "weak", // Missing Angular, TS, RxJS; exp 0 < 6
    expectedMissingSkills: ["Angular", "TypeScript", "RxJS"],
  },

  // JD_EDGE_03_DISCRIMINATORY: Backend Support (3-5y, Pune)
  {
    id: "EDGE03_MidJava",
    jd: JD_EDGE_03_DISCRIMINATORY,
    profile: midJavaProfile,
    expectedFitBand: "strong", // Java, SQL, REST match; 5y exp; Pune match
    expectedMissingSkills: [],
  },

  // JD_EDGE_04_HOSTILE: Python Cloud Developer (5+y, Hyderabad)
  {
    id: "EDGE04_Fresher",
    jd: JD_EDGE_04_HOSTILE,
    profile: fresherProfile,
    expectedFitBand: "weak", // Python matches, lacks Docker/Postgres; exp 0 < 5; REST matched in profile
    expectedMissingSkills: ["Docker", "PostgreSQL"],
  },
];
