import { z } from "zod";

export const ALLOWED_EMAIL_DOMAIN = "epitech.eu";

/** Same rule as public.is_allowed_email() in the database. */
export function isEpitechEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

export const PROMOS = ["tek1", "tek2", "tek3", "tek4", "tek5"] as const;

export const CAMPUSES = [
  "paris",
  "bordeaux",
  "lille",
  "lyon",
  "marseille",
  "montpellier",
  "mulhouse",
  "nancy",
  "nantes",
  "nice",
  "rennes",
  "la-reunion",
  "strasbourg",
  "toulouse",
] as const;

export const LANGUAGES = [
  "c",
  "cpp",
  "python",
  "javascript",
  "typescript",
  "haskell",
  "rust",
  "java",
  "go",
  "csharp",
  "asm",
  "sql",
] as const;

export const AVAILABILITY_SLOTS = ["weekday", "evening", "weekend"] as const;

export type Campus = (typeof CAMPUSES)[number];
export type Language = (typeof LANGUAGES)[number];
export type AvailabilitySlot = (typeof AVAILABILITY_SLOTS)[number];

export const skillLevelSchema = z.number().int().min(1).max(5);

export const onboardingSchema = z.object({
  promo: z.enum(PROMOS),
  city: z.enum(CAMPUSES),
  languages: z
    .record(z.enum(LANGUAGES), skillLevelSchema)
    .refine((langs) => Object.keys(langs).length > 0, { message: "languages.required" }),
  availability: z
    .array(z.enum(AVAILABILITY_SLOTS))
    .min(1, { message: "availability.required" })
    .transform((slots) => [...new Set(slots)]),
  matchmakingOptIn: z.boolean().default(false),
});

export type OnboardingInput = z.input<typeof onboardingSchema>;
export type OnboardingData = z.output<typeof onboardingSchema>;
