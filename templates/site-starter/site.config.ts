import { defineSiteConfig } from "@agency/astro-core";

export default defineSiteConfig({
  id: "demo-dental",
  url: "https://demo-dental.example.com",
  theme: { preset: "modern", primary: "#0e7490", accent: "#fbbf24" },
  home: ["hero", "services", "about", "team", "testimonials", "hours", "faq", "contact"],
});
