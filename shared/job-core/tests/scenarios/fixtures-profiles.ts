import type { Profile } from "../../src/schemas/index.js";

export const fresherProfile: Profile = {
  profile_id: "prof_00000000-0000-4000-8000-000000000011",
  schema_version: "1",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-25T00:00:00Z",
  label: "Junior Python & Web Developer",
  headline:
    "Entry-level software engineer with strong foundations in Python, SQL, JavaScript, HTML, and CSS",
  total_experience_years: 0,
  skills: [
    { name: "Python", years: 1, level: "beginner" },
    { name: "SQL", years: 1, level: "beginner" },
    { name: "JavaScript", years: 1, level: "beginner" },
    { name: "HTML", years: 1, level: "beginner" },
    { name: "CSS", years: 1, level: "beginner" },
  ],
  roles: [
    {
      title: "Software Engineering Intern",
      company: "Alpha Tech Labs",
      start: "2025-06",
      end: "2025-12",
      highlights: [
        "Built REST endpoints using Python and SQLite",
        "Developed responsive web components using HTML, CSS, and JavaScript",
      ],
    },
  ],
  education: [
    {
      qualification: "B.Tech in Computer Science",
      institution: "Anna University",
      year: 2025,
    },
  ],
  certifications: [],
  preferences: {
    locations: ["Bengaluru", "Hyderabad"],
    remote_modes: ["hybrid", "remote"],
    employment_types: ["full_time", "internship"],
    deal_breakers: [],
    min_compensation: { amount: 300000, currency: "INR", period: "year" },
  },
  summary_text: "Enthusiastic entry-level engineer seeking junior Python or frontend roles.",
};

export const midJavaProfile: Profile = {
  profile_id: "prof_00000000-0000-4000-8000-000000000012",
  schema_version: "1",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-25T00:00:00Z",
  label: "Senior Java Backend Engineer",
  headline:
    "Backend Engineer with 5 years building scalable microservices in Java, Spring Boot, and PostgreSQL",
  total_experience_years: 5,
  skills: [
    { name: "Java", years: 5, level: "advanced" },
    { name: "Spring Boot", years: 4, level: "advanced" },
    { name: "Microservices", years: 3, level: "advanced" },
    { name: "PostgreSQL", years: 4, level: "advanced" },
    { name: "Docker", years: 3, level: "intermediate" },
    { name: "AWS", years: 2, level: "intermediate" },
    { name: "REST", years: 4, level: "advanced" },
  ],
  roles: [
    {
      title: "Senior Software Engineer",
      company: "Enterprise Cloud Tech",
      start: "2023-01",
      end: "present",
      highlights: [
        "Architected high-throughput microservices using Java and Spring Boot handling 10,000 requests/sec",
        "Managed and optimized PostgreSQL queries and relational schemas",
        "Containerized core services with Docker and deployed to AWS cloud",
      ],
    },
    {
      title: "Software Engineer",
      company: "CodeCraft Solutions",
      start: "2021-01",
      end: "2022-12",
      highlights: [
        "Built REST APIs using Spring Boot and Java",
        "Participated in agile code reviews and container deployment pipelines",
      ],
    },
  ],
  education: [
    {
      qualification: "B.E. in Information Technology",
      institution: "Pune University",
      year: 2020,
    },
  ],
  certifications: [
    {
      name: "AWS Certified Developer",
      issuer: "Amazon Web Services",
      year: 2023,
    },
  ],
  preferences: {
    locations: ["Bengaluru", "Pune"],
    remote_modes: ["hybrid", "onsite"],
    employment_types: ["full_time"],
    deal_breakers: [],
    min_compensation: { amount: 1500000, currency: "INR", period: "year" },
  },
  summary_text:
    "Experienced Java backend developer specializing in Spring Boot, PostgreSQL, and cloud deployments.",
};

export const seniorMobileProfile: Profile = {
  profile_id: "prof_00000000-0000-4000-8000-000000000013",
  schema_version: "1",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-25T00:00:00Z",
  label: "Principal Mobile Architect",
  headline:
    "Lead Mobile & Frontend Architect with 13 years expertise in Angular, TypeScript, Ionic, and Flutter",
  total_experience_years: 13,
  skills: [
    { name: "Angular", years: 8, level: "expert" },
    { name: "TypeScript", years: 8, level: "expert" },
    { name: "Ionic", years: 5, level: "advanced" },
    { name: "Capacitor", years: 4, level: "advanced" },
    { name: "Flutter", years: 4, level: "advanced" },
    { name: "RxJS", years: 6, level: "advanced" },
    { name: "REST", years: 8, level: "expert" },
    { name: "HTML", years: 10, level: "expert" },
    { name: "CSS", years: 10, level: "expert" },
  ],
  roles: [
    {
      title: "Principal Consultant",
      company: "Hyperblitz Mobility",
      start: "2021-06",
      end: "present",
      highlights: [
        "Led cross-platform mobile architecture using Flutter, Ionic, and Capacitor for Fortune 500 clients",
        "Mentored frontend teams on Angular, TypeScript, and RxJS state management patterns",
      ],
    },
    {
      title: "Staff Frontend Engineer",
      company: "Apex Mobility",
      start: "2015-01",
      end: "2021-05",
      highlights: [
        "Engineered enterprise hybrid mobile applications using Angular and Ionic",
        "Delivered performant cross-platform mobile apps with HTML, CSS, and TypeScript",
      ],
    },
  ],
  education: [
    {
      qualification: "B.Tech in Computer Science",
      institution: "IIT Madras",
      year: 2013,
    },
  ],
  certifications: [],
  preferences: {
    locations: ["Chennai", "Bengaluru"],
    remote_modes: ["hybrid", "remote"],
    employment_types: ["full_time"],
    deal_breakers: [],
    min_compensation: { amount: 3000000, currency: "INR", period: "year" },
  },
  summary_text:
    "Principal mobile and frontend consultant delivering high-scale cross-platform mobile applications.",
};
