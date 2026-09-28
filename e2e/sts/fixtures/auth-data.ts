export const STS_ROLES = [
  "platform-admin",
  "province-officer",
  "school-admin",
  "teacher",
  "director",
] as const;

export type StsRole = (typeof STS_ROLES)[number];

export const DEMO_CREDENTIALS: Record<
  StsRole,
  { username: string; password: string; roleEnum: string; expectedPath: RegExp }
> = {
  teacher: {
    username: "teacher_a",
    password: "changeme",
    roleEnum: "TEACHER",
    expectedPath: /\/teacher\/dashboard$/,
  },
  director: {
    username: "director_a",
    password: "changeme",
    roleEnum: "SCHOOL_DIRECTOR",
    expectedPath: /\/director\/dashboard$/,
  },
  "school-admin": {
    username: "admin_a",
    password: "changeme",
    roleEnum: "SCHOOL_ADMIN",
    expectedPath: /\/admin$/,
  },
  "province-officer": {
    username: "province_officer",
    password: "changeme",
    roleEnum: "PROVINCE_OFFICER",
    expectedPath: /\/province\/dashboard$/,
  },
  "platform-admin": {
    username: "platform_admin",
    password: "changeme",
    roleEnum: "PLATFORM_ADMIN",
    expectedPath: /\/admin\/users$/,
  },
};
