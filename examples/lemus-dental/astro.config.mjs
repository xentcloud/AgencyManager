import { defineConfig } from "astro/config";
import agency from "@agency/astro-core";
import site from "./site.config.ts";

export default defineConfig({ integrations: [agency(site)] });
