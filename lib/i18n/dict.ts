/**
 * Dictionary typing and interpolation.
 *
 * `Dict<T>` widens the English source's string literals to `string`, so every other locale is
 * forced to have exactly the same keys and shape while being free to write its own text.
 * A missing or misspelled Hindi key is therefore a compile error, not a runtime blank —
 * which is how FR8's "100% string coverage" is actually enforced.
 */
export type Dict<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends readonly (infer E)[]
      ? E extends string
        ? readonly string[]
        : readonly Dict<E>[]
      : Dict<T[K]>;
};

/** `{name}` placeholders. Unknown placeholders are left in place so a test can catch them. */
export function fmt(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in params ? String(params[key]) : whole));
}

/** Every `{placeholder}` a template expects, for parity tests. */
export function placeholders(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

/**
 * Picks a plural form. English and Hindi share the same two-form rule (1 vs everything else),
 * so this stays simple until a locale with more forms is added.
 */
export function plural(n: number, forms: { one: string; other: string }): string {
  return n === 1 ? forms.one : forms.other;
}
