import { readFile } from "ags/file"
import GLib from "gi://GLib"

export interface Config {
  language: string
  dateFormat: string
  clockFormat: string
}

// User config; `STRUNTUZ_TOPBAR_CONFIG` overrides it (useful in development).
// Unlike the greeter this is a session program, so it reads the user's own
// XDG config dir rather than /etc.
const USER_PATH = `${GLib.get_user_config_dir()}/struntuz-topbar/config.json`

export const DEFAULTS: Config = {
  // Empty: the locale the session runs under (lib/i18n.ts).
  language: "",
  // Empty: the language's own pattern (lib/i18n.ts) unless overridden here.
  dateFormat: "",
  clockFormat: "%H:%M",
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback
}

// Per-key merge over the defaults: unknown keys are ignored and a bad value
// only costs its own key, never the whole file.
function merge(raw: Record<string, unknown>): Config {
  return {
    // Resolved to a catalog in lib/i18n.ts, which warns on an unknown tag.
    language: str(raw.language, DEFAULTS.language),
    dateFormat: str(raw.dateFormat, DEFAULTS.dateFormat),
    clockFormat: str(raw.clockFormat, DEFAULTS.clockFormat),
  }
}

// A broken config must never keep the bar off the screen: every failure path
// falls back to the defaults.
function load(): Config {
  const override = GLib.getenv("STRUNTUZ_TOPBAR_CONFIG")
  const path = override || USER_PATH

  if (!GLib.file_test(path, GLib.FileTest.EXISTS)) {
    if (override) console.warn(`struntuz-topbar: no config at ${path}, using defaults`)
    return DEFAULTS
  }

  try {
    const parsed: unknown = JSON.parse(readFile(path))
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.warn(`struntuz-topbar: ${path} is not a JSON object, using defaults`)
      return DEFAULTS
    }
    return merge(parsed as Record<string, unknown>)
  } catch (err) {
    console.warn(`struntuz-topbar: ignoring invalid config at ${path}: ${err}`)
    return DEFAULTS
  }
}

let cached: Config | null = null

export function getConfig(): Config {
  if (!cached) cached = load()
  return cached
}
