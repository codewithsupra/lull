/**
 * Generates the offline crisis pages: fully self-contained (inline CSS, no JS, no external
 * assets) so the service worker can serve them with no network at all.
 *
 * One page per language (FR8). Someone in crisis should not have to read a second language,
 * and this page is exactly where that matters most — it is the last thing still working.
 */
import { writeFileSync } from "node:fs";
import { REGIONS, GLOBAL_LINE, lineHref } from "../lib/crisis.ts";
import { LOCALES, LOCALE_META } from "../lib/i18n/config.ts";
import { messagesFor } from "../lib/i18n/index.ts";
import { offlinePagePath } from "../lib/offline.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

for (const locale of LOCALES) {
  const t = messagesFor(locale).crisis;
  const regions = REGIONS.map(
    (r) =>
      `<section><h2>${esc(t.countries[r.country])}</h2><p class="em">${esc(t.offline.emergency)} <a href="tel:${r.emergency.replace(/\D/g, "")}">${esc(
        r.emergency,
      )}</a></p><ul>${r.lines
        .map(
          (l) =>
            `<li><a href="${lineHref(l)}"><strong>${esc(l.number ?? "")}</strong> ${esc(l.name)}</a>${
              l.note ? `<span>${esc(t.notes[l.note])}</span>` : ""
            }</li>`,
        )
        .join("")}</ul></section>`,
  ).join("");

  const path = `public/${offlinePagePath(locale)}`;
  writeFileSync(
    path,
    `<!doctype html>
<html lang="${LOCALE_META[locale].tag}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t.offline.title)}</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;padding:28px 20px 60px;background:#03050b;color:#e8edf7;font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
  .wrap{max-width:640px;margin:0 auto}
  h1{font-size:26px;margin:0 0 6px}
  .lead{color:#8b95aa;margin:0 0 26px}
  h2{font-size:14px;letter-spacing:.14em;text-transform:uppercase;color:#8b95aa;margin:26px 0 8px}
  .em a{color:#ff9db5;font-weight:700}
  ul{list-style:none;margin:0;padding:0}
  li{margin:0 0 8px}
  li a{display:block;padding:14px 16px;border:1px solid rgba(160,190,255,.16);border-radius:14px;color:#e8edf7;text-decoration:none}
  li a strong{color:#8ef5d4;margin-right:10px}
  li span{display:block;color:#8b95aa;font-size:13px;margin-top:2px}
  .note{margin-top:32px;color:#566077;font-size:13px}
</style></head>
<body><div class="wrap">
  <h1>${esc(t.offline.heading)}</h1>
  <p class="lead">${esc(t.offline.lead)}</p>
  <section><h2>${esc(t.offline.anywhere)}</h2><ul><li><a href="${GLOBAL_LINE.url}"><strong>findahelpline.com</strong> ${esc(t.findHelpline)}</a></li></ul></section>
  ${regions}
  <p class="note">${esc(t.offline.note)}</p>
</div></body></html>
`,
  );
  console.log(`wrote ${path}`);
}
