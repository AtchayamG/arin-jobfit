# Project Charter v1

## Mission

Build two independent production-grade Model Context Protocol connectors that help job seekers and AI agents work with job opportunities more efficiently while preserving human agency and respecting portal rules:

- `naukri-mcp`
- `indeed-mcp`

The products should be useful directly to end users and also be technically/policy-ready for review by the corresponding portal as a possible approved integration or partner product.

## Product promise

Turn permitted job information into structured, explainable decision support: normalize the JD, extract requirements, compare it with a user-supplied profile/CV, identify gaps, prioritize opportunities, prepare truthful application notes and interview preparation, then hand the user back to the official portal for the consequential action.

## Non-goals for v1

- autonomous apply-at-scale
- CAPTCHA solving or bot-evasion
- scraping behind authentication without written permission
- undocumented/private API use
- auto-answering sensitive screening questions
- pretending to be an official Naukri or Indeed product

## Success definition

A release is successful when it has:

- stable MCP contracts
- local stdio transport for development/desktop agents
- remote Streamable HTTP transport for hosted use
- explainable job/profile comparison
- portal-specific capability gates
- audit logs without unnecessary personal data
- consent and deletion controls
- strong automated tests
- security review
- client compatibility verification
- partner-review documentation
