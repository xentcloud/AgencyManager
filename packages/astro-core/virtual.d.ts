declare module "virtual:agency/site" {
  import type {
    Business, CaseStudy, Faq, GalleryItem, Hours, Service, SiteConfig, StackGroup, TeamMember, Testimonial,
  } from "@agency-manager/site-schema";
  export const config: SiteConfig;
  export const credit: { name: string; url: string };
  export const business: Business;
  /** null for professional businesses without hours.yaml */
  export const hours: Hours | null;
  export const services: Service[];
  export const team: TeamMember[];
  export const testimonials: Testimonial[];
  export const gallery: GalleryItem[];
  export const faq: Faq[];
  export const stack: StackGroup[];
  export const caseStudies: CaseStudy[];
}
