/**
 * Aggregates all fit-v1 match dimension calculators.
 */

export {
  calculateMustHaveSkills,
  calculatePreferredSkills,
  calculateDomain,
} from "./dimensions-skills.js";

export {
  calculateExperience,
  calculateSeniority,
  calculateLocationRemote,
  calculateEmploymentType,
} from "./dimensions-fit.js";
