import type { ScenarioJD } from "./types.js";

// 1. Naukri: Senior Java Backend
export const JD_NK_01: ScenarioJD = {
  id: "JD_NK_01",
  name: "Senior Java Backend Developer",
  provider: "naukri",
  input: {
    title: "Senior Java Backend Developer",
    company: "Infoserve Global",
    location: "Bengaluru, India",
    experience_text: "5-10 Yrs",
    compensation_text: "₹ 12-18 Lacs P.A.",
    employment_type_text: "Full Time",
    source_url: "https://www.naukri.com/job-listings-12345",
    description: `Key Skills: Java, Spring Boot, Microservices, PostgreSQL, Docker

Roles and Responsibilities:
- Design and develop scalable microservices in Java
- Manage PostgreSQL schemas and performance
- Containerize applications using Docker

Desired Candidate Profile:
- 5+ years of hands-on Java backend experience
- Strong understanding of Spring Boot and REST APIs
- Experience with Docker is preferred

Employment Type: Full Time`,
  },
  expected: {
    required_skills_superset: ["Java", "Spring Boot", "Microservices", "PostgreSQL", "Docker"],
    experience: [5, 10],
    compensation: {
      currency: "INR",
      min: 1200000,
      max: 1800000,
      period: "year",
      disclosed: true,
    },
    city: "Bengaluru",
    country: "IN",
    remote_mode: "unknown",
    employment_type: "full_time",
  },
};

// 2. Naukri: Lead Angular Developer (Not Disclosed salary)
export const JD_NK_02: ScenarioJD = {
  id: "JD_NK_02",
  name: "Lead Angular Developer",
  provider: "naukri",
  input: {
    title: "Lead Angular Developer",
    company: "TechnoStack Labs",
    location: "Bangalore, India",
    experience_text: "8-14 Yrs",
    compensation_text: "Not Disclosed",
    employment_type_text: "Full Time, Permanent",
    source_url: "https://www.naukri.com/job-listings-23456",
    description: `Key Skills: Angular, TypeScript, RxJS, HTML, CSS

Roles and Responsibilities:
- Lead frontend architecture for enterprise web portals
- Enforce TypeScript best practices and code reviews

Desired Candidate Profile:
- 8+ years frontend web development
- Deep expertise in Angular and RxJS
- Good to have: Ionic or mobile exposure

Employment Type: Full Time`,
  },
  expected: {
    required_skills_superset: ["Angular", "TypeScript", "RxJS", "HTML", "CSS"],
    preferred_skills_superset: ["Ionic"],
    experience: [8, 14],
    compensation: {
      currency: null,
      min: null,
      max: null,
      period: "unknown",
      disclosed: false,
    },
    city: "Bangalore",
    country: "IN",
    remote_mode: "unknown",
    employment_type: "full_time",
  },
};

// 3. Naukri: Fresher Python Engineer
export const JD_NK_03: ScenarioJD = {
  id: "JD_NK_03",
  name: "Junior Python Engineer",
  provider: "naukri",
  input: {
    title: "Junior Python Engineer",
    company: "CyberByte Systems",
    location: "Hyderabad, India",
    experience_text: "0-2 Yrs",
    compensation_text: "₹ 3-5 Lacs P.A.",
    employment_type_text: "Full Time",
    source_url: "https://www.naukri.com/job-listings-34567",
    description: `Key Skills: Python, SQL, JavaScript, HTML, CSS

Roles and Responsibilities:
- Build and maintain backend services in Python
- Write basic SQL queries and database migrations

Desired Candidate Profile:
- Fresh graduate or up to 2 years experience
- Sound foundation in Python and web technologies
- Nice to have: Django or Flask

Employment Type: Full Time`,
  },
  expected: {
    required_skills_superset: ["Python", "SQL", "JavaScript", "HTML", "CSS"],
    preferred_skills_superset: ["Django"],
    experience: [0, 2],
    compensation: {
      currency: "INR",
      min: 300000,
      max: 500000,
      period: "year",
      disclosed: true,
    },
    city: "Hyderabad",
    country: "IN",
    remote_mode: "unknown",
    employment_type: "full_time",
  },
};

// 4. Naukri: Principal Mobile Architect (High LPA)
export const JD_NK_04: ScenarioJD = {
  id: "JD_NK_04",
  name: "Principal Mobile Architect",
  provider: "naukri",
  input: {
    title: "Principal Mobile Architect",
    company: "Apex Mobility Solutions",
    location: "Chennai, India",
    experience_text: "10-15 Yrs",
    compensation_text: "₹ 35-50 Lacs P.A.",
    employment_type_text: "Full Time",
    source_url: "https://www.naukri.com/job-listings-45678",
    description: `Key Skills: Flutter, Ionic, Capacitor, Angular, TypeScript

Roles and Responsibilities:
- Architect high performance mobile solutions for iOS and Android
- Define technical roadmaps for hybrid and cross-platform apps

Desired Candidate Profile:
- 10+ years engineering with extensive mobile focus
- Deep hands-on experience in Flutter, Ionic, Capacitor
- Strong background in Angular and TypeScript

Employment Type: Full Time`,
  },
  expected: {
    required_skills_superset: ["Flutter", "Ionic", "Capacitor", "Angular", "TypeScript"],
    experience: [10, 15],
    compensation: {
      currency: "INR",
      min: 3500000,
      max: 5000000,
      period: "year",
      disclosed: true,
    },
    city: "Chennai",
    country: "IN",
    remote_mode: "hybrid",
    employment_type: "full_time",
  },
};
