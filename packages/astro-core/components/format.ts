import type { Hours } from "@agency-manager/site-schema";

export const dayNames = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
} as const;

/** "13:30" → "1:30 PM" */
export function to12h(t: string): string {
  const [h = 0, m = 0] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour} ${suffix}` : `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatRanges(ranges: { open: string; close: string }[]): string {
  return ranges.length ? ranges.map((r) => `${to12h(r.open)} – ${to12h(r.close)}`).join(", ") : "Closed";
}

/** schema.org openingHoursSpecification entries. */
export function openingHoursSpec(hours: Hours) {
  const map = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
  return Object.entries(hours.weekly).flatMap(([d, ranges]) =>
    ranges.map((r) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: map[d as keyof typeof map],
      opens: r.open,
      closes: r.close,
    })),
  );
}

export function telHref(phone: string) {
  return `tel:${phone}`;
}

/** +15125550100 → (512) 555-0100 for US numbers; unchanged otherwise. */
export function displayPhone(phone: string): string {
  const m = phone.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : phone;
}
