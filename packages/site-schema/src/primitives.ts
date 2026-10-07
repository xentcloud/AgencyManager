import { z } from "zod";

export const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase letters, digits and dashes");

/** 24h clock time, e.g. "09:00" or "17:30". */
export const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM (24h)");

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

/** E.164 phone number, e.g. "+15125550100". */
export const phone = z.string().regex(/^\+[1-9]\d{6,14}$/, "E.164 format, e.g. +15125550100");

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "#RRGGBB");

/** Path under /public (e.g. "/images/hero.jpg") or an absolute https URL. */
export const imageSrc = z
  .string()
  .refine((s) => s.startsWith("/") || s.startsWith("https://"), "path under /public or https URL");

export const image = z.object({
  src: imageSrc,
  alt: z.string().min(1, "alt text is required for accessibility"),
});
