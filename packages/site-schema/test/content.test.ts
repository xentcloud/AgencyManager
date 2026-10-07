import { describe, expect, it } from "vitest";
import { siteConfigSchema, validateContent } from "../src/index.js";
import { validateContentDir } from "../src/validate.js";

const hours = {
  timezone: "America/Chicago",
  weekly: { mon: [{ open: "08:00", close: "17:00" }], sat: [{ open: "09:00", close: "13:00" }] },
};

describe("hours", () => {
  it("accepts valid hours and treats missing days as closed", () => {
    expect(validateContent("hours.yaml", hours)).toEqual([]);
  });
  it("rejects open after close", () => {
    const bad = { ...hours, weekly: { mon: [{ open: "18:00", close: "09:00" }] } };
    expect(validateContent("hours.yaml", bad)[0]?.message).toMatch(/before close/);
  });
  it("rejects 12h times", () => {
    const bad = { ...hours, weekly: { mon: [{ open: "9am", close: "5pm" }] } };
    expect(validateContent("hours.yaml", bad).length).toBeGreaterThan(0);
  });
});

describe("lists", () => {
  it("flags duplicate ids", () => {
    const services = [
      { id: "cleaning", title: "Cleaning", summary: "x" },
      { id: "cleaning", title: "Cleaning 2", summary: "y" },
    ];
    expect(validateContent("services.yaml", services)).toEqual([
      { file: "services.yaml", path: "cleaning", message: 'duplicate id "cleaning"' },
    ]);
  });
  it("requires alt text on gallery images", () => {
    const issues = validateContent("gallery.yaml", [{ id: "a", src: "/images/a.jpg", alt: "" }]);
    expect(issues[0]?.path).toBe("0.alt");
  });
});

describe("business", () => {
  it("requires E.164 phone", () => {
    const issues = validateContent("business.yaml", {
      name: "Smile Dental", description: "d", phone: "(512) 555-0100",
      address: { street: "1 Main", city: "Austin", region: "TX", postalCode: "78701" },
    });
    expect(issues.map((i) => i.path)).toContain("phone");
  });
});

describe("site config", () => {
  it("applies defaults", () => {
    const cfg = siteConfigSchema.parse({ id: "smile-dental", url: "https://smiledental.com" });
    expect(cfg.theme.preset).toBe("modern");
    expect(cfg.home[0]).toBe("hero");
  });
});

describe("professional services", () => {
  it("accepts stack groups and case studies", () => {
    expect(validateContent("stack.yaml", [{ id: "cloud", title: "Cloud", items: ["AWS", "Azure"] }])).toEqual([]);
    expect(validateContent("case-studies.yaml", [{ id: "acme", title: "Acme portal", summary: "Rebuilt it." }])).toEqual([]);
  });
  it("rejects an empty stack group", () => {
    expect(validateContent("stack.yaml", [{ id: "x", title: "X", items: [] }]).length).toBe(1);
  });
});

describe("content dir", () => {
  const dir = (name: string) => new URL(`./fixtures/${name}/`, import.meta.url).pathname;
  it("does not require hours for professional businesses", async () => {
    expect(await validateContentDir(dir("pro"))).toEqual([]);
  });
  it("requires hours for local businesses", async () => {
    expect((await validateContentDir(dir("local-missing-hours"))).map((i) => i.file)).toEqual(["hours.yaml"]);
  });
});
