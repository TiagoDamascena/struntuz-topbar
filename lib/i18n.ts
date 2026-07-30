import GLib from "gi://GLib"
import { getConfig } from "./config"

export interface Strings {
  // Not a label but a `g_date_time_format` pattern: the locale translates the
  // weekday and month names, never the order they go in. `config.dateFormat`
  // overrides it.
  dateFormat: string
}

// The base every other language falls back to, key by key.
const EN: Strings = {
  dateFormat: "%a, %b %-d",
}

const PT_BR: Partial<Strings> = {
  dateFormat: "%a, %-d de %b",
}

const CATALOG: Record<string, Partial<Strings>> = {
  en: {},
  pt: PT_BR,
  "pt-br": PT_BR,
}

// What the dates are formatted under, so LC_TIME outranks LANG here — LC_ALL
// still overrides both. Empty means the locale is unset and glibc falls back
// to C, which is English.
function systemLanguage(): string {
  for (const name of ["LC_ALL", "LC_TIME", "LANG"]) {
    const value = GLib.getenv(name)
    if (value) return value
  }
  return "en"
}

// Accepts "pt", "pt-BR", "pt_BR" and "pt_BR.UTF-8" alike, then falls back to the
// primary subtag, so an unlisted region still gets its language.
function resolve(language: string): Partial<Strings> {
  const tag = language.split(".")[0].split("@")[0].replace("_", "-").toLowerCase()
  if (tag === "c" || tag === "posix") return {}
  const table = CATALOG[tag] ?? CATALOG[tag.split("-")[0]]
  if (!table) {
    console.warn(`struntuz-topbar: unknown language "${language}", using English`)
    return {}
  }
  return table
}

export const t: Strings = { ...EN, ...resolve(getConfig().language || systemLanguage()) }
