import { readFile } from "ags/file"
import GLib from "gi://GLib"

// One shell command per power action. They are commands rather than built-in
// calls because the right one is the session's, not the bar's: this session
// locks through logind (hypridle holds the handle), another may not.
export interface PowerCommands {
  lock: string
  suspend: string
  logout: string
  restart: string
  shutdown: string
}

export interface Config {
  language: string
  dateFormat: string
  clockFormat: string
  userName: string
  userAvatar: string
  toastTimeout: number
  toastLimit: number
  powerCommands: PowerCommands
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
  // Empty: the account's own name (lib/session.ts).
  userName: "",
  // Empty: `~/.face`, where the desktop conventionally keeps the picture. A
  // missing file is not an error — the avatar falls back to the initial.
  userAvatar: "",
  // How long a toast stays up, in milliseconds, when its sender asks for no
  // timeout of its own. The design's own hold.
  toastTimeout: 6800,
  // How far down the screen the stack may reach before the oldest card goes.
  toastLimit: 3,
  powerCommands: {
    lock: "loginctl lock-session",
    suspend: "systemctl suspend",
    // Hyprland's own exit, so whatever supervises the session — uwsm, a systemd
    // unit, a bare exec — tears down after it rather than under it.
    logout: "hyprctl dispatch exit",
    restart: "systemctl reboot",
    shutdown: "systemctl poweroff",
  },
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback
}

// Only finite non-negative numbers: a NaN or an Infinity here would reach a
// timer, and a negative count would empty the toast stack on arrival.
function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback
}

function powerCommands(raw: unknown): PowerCommands {
  const from = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const defaults = DEFAULTS.powerCommands
  return {
    lock: str(from.lock, defaults.lock),
    suspend: str(from.suspend, defaults.suspend),
    logout: str(from.logout, defaults.logout),
    restart: str(from.restart, defaults.restart),
    shutdown: str(from.shutdown, defaults.shutdown),
  }
}

// Per-key merge over the defaults: unknown keys are ignored and a bad value
// only costs its own key, never the whole file.
function merge(raw: Record<string, unknown>): Config {
  return {
    // Resolved to a catalog in lib/i18n.ts, which warns on an unknown tag.
    language: str(raw.language, DEFAULTS.language),
    dateFormat: str(raw.dateFormat, DEFAULTS.dateFormat),
    clockFormat: str(raw.clockFormat, DEFAULTS.clockFormat),
    userName: str(raw.userName, DEFAULTS.userName),
    userAvatar: str(raw.userAvatar, DEFAULTS.userAvatar),
    toastTimeout: num(raw.toastTimeout, DEFAULTS.toastTimeout),
    toastLimit: num(raw.toastLimit, DEFAULTS.toastLimit),
    powerCommands: powerCommands(raw.powerCommands),
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
