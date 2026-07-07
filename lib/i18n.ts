import en from "../locales/en.json";
import mn from "../locales/mn.json";

export const defaultLocale = "mn";
export const supportedLocales = ["mn", "en"] as const;
export type Locale = (typeof supportedLocales)[number];

const dictionaries = { en, mn } as const;

function getValue(source: unknown, key: string): string | undefined {
  return key.split(".").reduce<unknown>((value, part) => {
    if (value && typeof value === "object" && part in value) {
      return (value as Record<string, unknown>)[part];
    }
    return undefined;
  }, source) as string | undefined;
}

export function t(key: string, values?: Record<string, string | number>, locale: Locale = defaultLocale) {
  const template = getValue(dictionaries[locale], key) ?? getValue(dictionaries.en, key) ?? key;

  if (!values) {
    return template;
  }

  return Object.entries(values).reduce(
    (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
    template,
  );
}
