import { defineSiteConfig } from "@agency/astro-core";

export default defineSiteConfig({
  id: "lemus-dental",
  url: "https://www.lemusdental.com",
  theme: { preset: "warm", primary: "#0f766e", accent: "#f59e0b" },
  home: ["hero", "services", "about", "team", "testimonials", "hours", "contact"],
});
