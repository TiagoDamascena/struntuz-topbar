import { Accessor, createComputed } from "ags"
import { Gdk } from "ags/gtk4"
import { readFile } from "ags/file"
import { createPoll } from "ags/time"
import GLib from "gi://GLib"
import { batteryStatus, hhmm, percent, present } from "./battery"
import { getConfig } from "./config"
import { squareTexture } from "./image"
import { t } from "./i18n"

// `g_get_real_name` answers "Unknown" rather than failing when the GECOS field
// is empty, so it needs checking like an error would.
export function userName(): string {
  const configured = getConfig().userName
  if (configured) return configured

  const real = GLib.get_real_name()
  return real && real !== "Unknown" ? real : GLib.get_user_name()
}

// What the avatar falls back to when there is no picture. Taken from the name
// rather than the login so it follows whatever the pill shows.
export function userInitial(): string {
  return userName().trim().slice(0, 1).toUpperCase() || "?"
}

function avatarPath(): string {
  const configured = getConfig().userAvatar
  if (!configured) return `${GLib.get_home_dir()}/.face`
  return configured.startsWith("~/") ? `${GLib.get_home_dir()}/${configured.slice(2)}` : configured
}

// Cropped square rather than drawn as it comes: `.face` is square by convention,
// not by rule, and the pill's circle needs it to be one.
export function userAvatar(size: number): Gdk.Texture | null {
  const path = avatarPath()
  if (!GLib.file_test(path, GLib.FileTest.EXISTS)) return null

  // The initial says the same thing when the file turns out not to be an image.
  return squareTexture(path, size)
}

// The line under the name in the control centre. The battery says it when there
// is one — the same line the bar's own glyph carries in its tooltip, read from
// `lib/battery.ts` rather than composed a second time — and a machine without
// one falls back to who and where you are, which is the only other thing the
// pill knows that the name above it does not already say.
export function userStatus(): Accessor<string> {
  return createComputed([present(), batteryStatus()], (has, line) =>
    has ? line : `${GLib.get_user_name()}@${GLib.get_host_name()}`,
  )
}

// The kernel's own counter. Close enough to "since you sat down" on a machine
// that suspends rather than reboots, and it costs one small read a minute.
function uptimeSeconds(): number {
  try {
    return Number.parseFloat(readFile("/proc/uptime").split(" ")[0]) || 0
  } catch {
    return 0
  }
}

export function sessionStatus(): Accessor<string> {
  return createComputed(
    [createPoll(uptimeSeconds(), 60_000, uptimeSeconds), present(), percent()],
    (secs, has, level) => {
      const up = `${t.uptime} ${hhmm(secs)}`
      return has ? `${up} · ${t.battery} ${level}%` : up
    },
  )
}
