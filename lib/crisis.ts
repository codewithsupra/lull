/**
 * Crisis resources (FR3). Deliberately hardcoded and dependency-free so they work offline,
 * with no network, no database and no auth. Every country falls back to a global option.
 * Numbers are free/24-7 national services unless noted.
 */

import type { Messages } from "@/lib/i18n";

/** Keys into `t.crisis.notes`, so a helpline's hours are never shown in the wrong language. */
export type CrisisNoteKey = keyof Messages["crisis"]["notes"];

export type CrisisLine = {
  /** Organisation name — a proper noun, deliberately not translated. */
  name: string;
  /** Display number, dialled via tel: (digits only) or a url for web-only services. */
  number?: string;
  url?: string;
  note?: CrisisNoteKey;
  /** Text/SMS rather than a voice call. */
  text?: boolean;
  /** Set when the "name" is a phrase rather than an organisation, so it can be translated. */
  nameKey?: "findHelpline";
};

export type CountryCode = keyof Messages["crisis"]["countries"];

export type CrisisRegion = {
  country: CountryCode;
  /** English name, used for logs and the build-time offline page. UI reads t.crisis.countries. */
  label: string;
  emergency: string;
  lines: CrisisLine[];
};

export const GLOBAL_LINE: CrisisLine = {
  name: "findahelpline.com",
  nameKey: "findHelpline",
  url: "https://findahelpline.com",
  note: "global",
};

export const REGIONS: CrisisRegion[] = [
  {
    country: "IN",
    label: "India",
    emergency: "112",
    lines: [
      { name: "Tele-MANAS (Govt. of India)", number: "14416", note: "free247Multi" },
      { name: "KIRAN Mental Health Helpline", number: "1800 599 0019", note: "free247" },
      { name: "iCall (TISS)", number: "91529 87821", note: "counsellingHours" },
      { name: "AASRA", number: "98204 66726", note: "suicide247" },
    ],
  },
  {
    country: "US",
    label: "United States",
    emergency: "911",
    lines: [
      { name: "988 Suicide & Crisis Lifeline", number: "988", note: "callOrText247" },
      { name: "Crisis Text Line", number: "741741", text: true, note: "textHome" },
      { name: "Trevor Project (LGBTQ+ youth)", number: "1 866 488 7386", note: "open247" },
    ],
  },
  {
    country: "GB",
    label: "United Kingdom",
    emergency: "999",
    lines: [
      { name: "Samaritans", number: "116 123", note: "free247" },
      { name: "Shout", number: "85258", text: true, note: "textShout" },
      { name: "NHS 111 (option 2)", number: "111", note: "urgentMentalHealth" },
    ],
  },
  {
    country: "IE",
    label: "Ireland",
    emergency: "112",
    lines: [
      { name: "Samaritans Ireland", number: "116 123", note: "free247" },
      { name: "Text About It", number: "50808", text: true, note: "textHello" },
    ],
  },
  {
    country: "CA",
    label: "Canada",
    emergency: "911",
    lines: [{ name: "9-8-8 Suicide Crisis Helpline", number: "988", note: "callOrText247EnFr" }],
  },
  {
    country: "AU",
    label: "Australia",
    emergency: "000",
    lines: [
      { name: "Lifeline", number: "13 11 14", note: "open247" },
      { name: "Beyond Blue", number: "1300 22 4636", note: "open247" },
    ],
  },
  {
    country: "NZ",
    label: "New Zealand",
    emergency: "111",
    lines: [{ name: "1737 Need to Talk?", number: "1737", note: "callOrText247" }],
  },
  {
    country: "SG",
    label: "Singapore",
    emergency: "995",
    lines: [{ name: "Samaritans of Singapore (SOS)", number: "1767", note: "open247" }],
  },
  {
    country: "AE",
    label: "United Arab Emirates",
    emergency: "999",
    lines: [{ name: "Estijaba (Dept. of Health)", number: "800 1717", note: "open247" }],
  },
  {
    country: "DE",
    label: "Germany",
    emergency: "112",
    lines: [{ name: "Telefonseelsorge", number: "0800 111 0 111", note: "free247" }],
  },
  {
    country: "NL",
    label: "Netherlands",
    emergency: "112",
    lines: [{ name: "113 Zelfmoordpreventie", number: "0800 0113", note: "free247" }],
  },
  {
    country: "ZA",
    label: "South Africa",
    emergency: "112",
    lines: [{ name: "SADAG Suicide Crisis Line", number: "0800 567 567", note: "open247" }],
  },
];

const DEFAULT_REGION: CrisisRegion = {
  country: "XX",
  label: "your country",
  emergency: "your local emergency number",
  lines: [],
};

/** Resolves an ISO country code (from a geo header or a manual pick) to its resources. */
export function regionFor(country: string | null | undefined): CrisisRegion {
  const code = (country ?? "").trim().toUpperCase();
  return REGIONS.find((r) => r.country === code) ?? DEFAULT_REGION;
}

/** Everything to show in the crisis sheet: national lines first, always with a global fallback. */
export function crisisLinesFor(country: string | null | undefined): { region: CrisisRegion; lines: CrisisLine[] } {
  const region = regionFor(country);
  return { region, lines: [...region.lines, GLOBAL_LINE] };
}

/** tel:/sms:/https: href for a line. */
export function lineHref(line: CrisisLine): string {
  if (line.url) return line.url;
  const digits = (line.number ?? "").replace(/\D/g, "");
  if (!digits) return GLOBAL_LINE.url!;
  return line.text ? `sms:${digits}` : `tel:${digits}`;
}

/** Country picker options, named and sorted in the reader's own language. */
export function countryOptions(t: Messages, tag: string): { code: CountryCode; label: string }[] {
  return REGIONS.map((r) => ({ code: r.country, label: t.crisis.countries[r.country] })).sort((a, b) => a.label.localeCompare(b.label, tag));
}
