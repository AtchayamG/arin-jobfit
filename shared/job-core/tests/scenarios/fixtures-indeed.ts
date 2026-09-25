import type { ScenarioJD } from "./types.js";

// 5. Indeed: Web Development Intern (Monthly stipend, Remote)
export const JD_IN_01: ScenarioJD = {
  id: "JD_IN_01",
  name: "Web Development Intern",
  provider: "indeed",
  input: {
    title: "Web Development Intern",
    company: "NexGen Media",
    location: "Remote",
    experience_text: "0-1 years",
    compensation_text: "₹15,000 - ₹25,000 a month",
    employment_type_text: "Full-time, Internship",
    source_url: "https://www.indeed.com/viewjob?jk=intern001",
    description: `Job details:
Full-time, Internship
Salary: ₹15,000 - ₹25,000 a month

Requirements:
- Basic knowledge of HTML, CSS, JavaScript
- Foundational Python skills for scripting
- Familiarity with SQL databases

Benefits:
- Flexible working hours
- Mentorship from senior developers`,
  },
  expected: {
    required_skills_superset: ["HTML", "CSS", "JavaScript", "Python", "SQL"],
    experience: [0, 1],
    compensation: {
      currency: "INR",
      min: 15000,
      max: 25000,
      period: "month",
      disclosed: true,
    },
    city: null,
    country: null,
    remote_mode: "remote",
    employment_type: "internship",
  },
};

// 6. Indeed: Backend Engineer - Java & Cloud (Pune Hybrid)
export const JD_IN_02: ScenarioJD = {
  id: "JD_IN_02",
  name: "Backend Engineer - Java & Cloud",
  provider: "indeed",
  input: {
    title: "Backend Engineer - Java & Cloud",
    company: "CloudPeak Systems",
    location: "Pune (Hybrid)",
    experience_text: "4-7 years",
    compensation_text: "16-24 LPA",
    employment_type_text: "Full-time, Permanent",
    source_url: "https://www.indeed.com/viewjob?jk=java002",
    description: `Job details:
Full-time, Permanent
Location: Pune (Hybrid)

Requirements:
- 4+ years of Java and Spring Boot experience
- Strong skills in Microservices and REST APIs
- Practical experience with Docker and PostgreSQL

Preferred:
- AWS cloud certifications
- Kubernetes knowledge

Benefits:
- Health insurance
- Annual bonus`,
  },
  expected: {
    required_skills_superset: [
      "Java",
      "Spring Boot",
      "Microservices",
      "REST",
      "Docker",
      "PostgreSQL",
    ],
    preferred_skills_superset: ["AWS", "Kubernetes"],
    experience: [4, 7],
    compensation: {
      currency: "INR",
      min: 1600000,
      max: 2400000,
      period: "year",
      disclosed: true,
    },
    city: "Pune",
    country: "IN",
    remote_mode: "hybrid",
    employment_type: "full_time",
  },
};

// 7. Indeed: Mobile Engineering Lead (Chennai Hybrid)
export const JD_IN_03: ScenarioJD = {
  id: "JD_IN_03",
  name: "Mobile Engineering Lead",
  provider: "indeed",
  input: {
    title: "Mobile Engineering Lead",
    company: "Pulse Digital",
    location: "Chennai (Hybrid)",
    experience_text: "10+ years",
    compensation_text: "30-45 LPA",
    employment_type_text: "Full-time",
    source_url: "https://www.indeed.com/viewjob?jk=mobile003",
    description: `Job details:
Full-time
Location: Chennai (Hybrid)

Requirements:
- 10+ years software engineering
- Expert in Angular, TypeScript, Ionic, Capacitor
- Proven leadership on production mobile applications

Preferred:
- Flutter experience
- RxJS event streaming

Benefits:
- Stock options
- Hybrid work flexibility`,
  },
  expected: {
    required_skills_superset: ["Angular", "TypeScript", "Ionic", "Capacitor"],
    preferred_skills_superset: ["Flutter", "RxJS"],
    experience: [10, null],
    compensation: {
      currency: "INR",
      min: 3000000,
      max: 4500000,
      period: "year",
      disclosed: true,
    },
    city: "Chennai",
    country: "IN",
    remote_mode: "hybrid",
    employment_type: "full_time",
  },
};

// 8. Indeed: Full Stack Engineer (Java/Angular)
export const JD_IN_04: ScenarioJD = {
  id: "JD_IN_04",
  name: "Full Stack Engineer (Java/Angular)",
  provider: "indeed",
  input: {
    title: "Full Stack Engineer (Java/Angular)",
    company: "OmniTech Solutions",
    location: "Bengaluru, Karnataka (On-site)",
    experience_text: "3-6 years",
    compensation_text: "14-20 LPA",
    employment_type_text: "Full-time",
    source_url: "https://www.indeed.com/viewjob?jk=fs004",
    description: `Job details:
Full-time
Location: Bengaluru, Karnataka (On-site)

Requirements:
- 3+ years experience with Java and Spring Boot
- Experience building frontend UIs with Angular and TypeScript
- REST API development

Preferred:
- Docker containerization
- PostgreSQL database tuning

Benefits:
- Relocation assistance`,
  },
  expected: {
    required_skills_superset: ["Java", "Spring Boot", "Angular", "TypeScript", "REST"],
    preferred_skills_superset: ["Docker", "PostgreSQL"],
    experience: [3, 6],
    compensation: {
      currency: "INR",
      min: 1400000,
      max: 2000000,
      period: "year",
      disclosed: true,
    },
    city: "Bengaluru",
    country: "IN",
    remote_mode: "onsite",
    employment_type: "full_time",
  },
};
