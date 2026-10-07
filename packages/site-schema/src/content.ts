import { z } from "zod";
import { image, isoDate, phone, slug, time } from "./primitives.js";

export const businessSchema = z.object({
  name: z.string().min(1),
  tagline: z.string().optional(),
  description: z.string().min(1),
  /** schema.org LocalBusiness subtype, e.g. "Dentist", "RoofingContractor". */
  schemaType: z.string().default("LocalBusiness"),
  phone,
  email: z.email().optional(),
  address: z.object({
    street: z.string(),
    city: z.string(),
    region: z.string(),
    postalCode: z.string(),
    country: z.string().default("US"),
  }),
  geo: z.object({ lat: z.number(), lng: z.number() }).optional(),
  serviceArea: z.array(z.string()).default([]),
  logo: image.optional(),
  hero: z
    .object({
      heading: z.string(),
      subheading: z.string().optional(),
      image: image.optional(),
      cta: z.object({ label: z.string(), href: z.string() }).optional(),
    })
    .optional(),
  about: z.string().optional(),
  social: z.partialRecord(z.enum(["facebook", "instagram", "google", "yelp", "linkedin", "x", "youtube", "tiktok"]), z.url()).default({}),
});

const range = z
  .object({ open: time, close: time })
  .refine((r) => r.open < r.close, "open must be before close");

const day = z.array(range).default([]); // empty = closed

export const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export const hoursSchema = z.object({
  timezone: z.string().default("America/Chicago"),
  weekly: z.object({
    mon: day, tue: day, wed: day, thu: day, fri: day, sat: day, sun: day,
  }),
  /** Holidays and one-off changes. Empty `ranges` = closed that day. */
  exceptions: z
    .array(z.object({ date: isoDate, ranges: z.array(range).default([]), note: z.string().optional() }))
    .default([]),
  note: z.string().optional(),
});

export const serviceSchema = z.object({
  id: slug,
  title: z.string(),
  summary: z.string(),
  description: z.string().optional(),
  price: z.string().optional(),
  image: image.optional(),
  featured: z.boolean().default(false),
});

export const teamMemberSchema = z.object({
  id: slug,
  name: z.string(),
  role: z.string(),
  bio: z.string().optional(),
  photo: image.optional(),
});

export const testimonialSchema = z.object({
  id: slug,
  author: z.string(),
  quote: z.string(),
  rating: z.number().int().min(1).max(5).optional(),
  source: z.string().optional(),
});

export const galleryItemSchema = image.extend({ id: slug, caption: z.string().optional() });

export const faqSchema = z.object({ id: slug, question: z.string(), answer: z.string() });

/**
 * Content files live in `src/content/` of each site repo.
 * Singletons are objects; the rest are arrays of items with unique `id`s.
 */
export const contentFiles = {
  "business.yaml": { kind: "single", schema: businessSchema },
  "hours.yaml": { kind: "single", schema: hoursSchema },
  "services.yaml": { kind: "list", schema: serviceSchema },
  "team.yaml": { kind: "list", schema: teamMemberSchema },
  "testimonials.yaml": { kind: "list", schema: testimonialSchema },
  "gallery.yaml": { kind: "list", schema: galleryItemSchema },
  "faq.yaml": { kind: "list", schema: faqSchema },
} as const;

export const requiredContentFiles = ["business.yaml", "hours.yaml", "services.yaml"] as const;

export type Business = z.output<typeof businessSchema>;
export type Hours = z.output<typeof hoursSchema>;
export type Service = z.output<typeof serviceSchema>;
export type TeamMember = z.output<typeof teamMemberSchema>;
export type Testimonial = z.output<typeof testimonialSchema>;
export type GalleryItem = z.output<typeof galleryItemSchema>;
export type Faq = z.output<typeof faqSchema>;
