declare module "virtual:agency/site" {
  import type {
    Business, Faq, GalleryItem, Hours, Service, SiteConfig, TeamMember, Testimonial,
  } from "@agency/site-schema";
  export const config: SiteConfig;
  export const credit: { name: string; url: string };
  export const business: Business;
  export const hours: Hours;
  export const services: Service[];
  export const team: TeamMember[];
  export const testimonials: Testimonial[];
  export const gallery: GalleryItem[];
  export const faq: Faq[];
}
