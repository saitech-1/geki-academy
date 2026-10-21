import { z } from "zod";
export const ProfileInput = z.object({
  displayName: z.string().trim().min(2).max(80),
  language: z.enum(["en", "mm"]),
  accountType: z.enum(["ADULT", "GUARDIAN"]),
  consent: z.literal(true),
});
export const ReasonInput = z.object({
  reason: z.string().trim().min(8).max(500),
});
export const CourseInput = z.object({
  title: z.string().trim().min(3).max(150),
  titleMm: z.string().max(200).default(""),
  description: z.string().max(5000),
  descriptionMm: z.string().max(5000).default(""),
  instructor: z.string().max(100).default("GEKI Instruction Team"),
  thumbnail: z
    .string()
    .max(2000)
    .regex(
      /^(https?:\/\/|\/images\/)/,
      "Use an HTTPS image URL or an /images/ asset path.",
    )
    .default("/images/hero.jpg"),
  category: z
    .enum(["Kihon", "Kihon Ido", "Basic Kumite", "Kata"])
    .default("Kihon"),
});
export const QuestionInput = z
  .object({
    prompt: z.string().trim().min(5).max(1000),
    options: z.array(z.string().trim().min(1).max(500)).min(2).max(6),
    correctIndex: z.number().int().min(0),
    explanation: z.string().trim().min(5).max(2000),
  })
  .refine((q) => q.correctIndex < q.options.length, {
    message: "Correct answer must reference an option",
  });
export type Language = "en" | "mm";
export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  language: Language;
  accountType: string;
  onboarded: boolean;
  role: "STUDENT" | "ADMIN" | "SUPER_ADMIN";
  emailVerified: boolean;
  membership: { plan: string; endsAt: string } | null;
};
export type ApiError = { error: string; code: string; details?: unknown };
