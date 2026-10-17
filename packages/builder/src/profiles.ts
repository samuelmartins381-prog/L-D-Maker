// Output profiles (ADR 0016): Sam picks "Watch Live" or "Cornerstone", not a SCORM version.
// Each profile names its package format and the player options it needs. Labels live in the
// Studio's interface catalogues; quirks are sourced in ADR 0016 when a profile is implemented.

export type PackageFormat = "scorm12" | "scorm2004" | "html-file" | "html-site";

export interface Profile {
  format: PackageFormat;
  /** Always-visible Quit button that ends the session (LMS showing content without controls). */
  exitButton?: boolean;
  /** Largest accepted package, in bytes. */
  maxBytes?: number;
  /** false until the profile's specific options and checks are implemented and tested. */
  ready: boolean;
}

export const PROFILES = {
  "teach-on-mars": {
    format: "scorm12",
    exitButton: true,
    maxBytes: 200 * 1024 * 1024,
    ready: false,
  },
  cornerstone: { format: "scorm12", ready: false },
  successfactors: { format: "scorm12", ready: false },
  docebo: { format: "scorm12", ready: false },
  moodle: { format: "scorm12", ready: false },
  "360learning": { format: "scorm12", ready: false },
  workday: { format: "scorm12", ready: false },
  /** Unknown LMS: SCORM 1.2 is accepted almost everywhere. */
  "lms-unknown": { format: "scorm12", ready: true },
  "scorm2004-generic": { format: "scorm2004", ready: true },
  "html-file": { format: "html-file", ready: false },
  "html-site": { format: "html-site", ready: true },
} as const satisfies Record<string, Profile>;

export type ProfileId = keyof typeof PROFILES;
export const PROFILE_IDS = Object.keys(PROFILES) as ProfileId[];
