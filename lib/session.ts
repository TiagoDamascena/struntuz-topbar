import { Accessor, createBinding, createComputed } from "ags"
import { Gdk } from "ags/gtk4"
import { readFile } from "ags/file"
import { createPoll } from "ags/time"
import AstalBattery from "gi://AstalBattery"
import GdkPixbuf from "gi://GdkPixbuf"
import GLib from "gi://GLib"
import { getConfig } from "./config"
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

// Cropped to a centred square and scaled here rather than at render time,
// because a `Gtk.Image` scales a paintable to *fit*: anything but a square would
// letterbox inside the circle instead of filling it. `.face` is square by
// convention, not by rule.
//
// `size` is the avatar in logical pixels; the texture is cut at twice that, so
// it still has pixels to give on a scaled display without carrying a whole
// portrait around.
export function userAvatar(size: number): Gdk.Texture | null {
  const path = avatarPath()
  if (!GLib.file_test(path, GLib.FileTest.EXISTS)) return null

  try {
    const picture = GdkPixbuf.Pixbuf.new_from_file(path)
    const side = Math.min(picture.get_width(), picture.get_height())
    const square = picture.new_subpixbuf(
      Math.floor((picture.get_width() - side) / 2),
      Math.floor((picture.get_height() - side) / 2),
      side,
      side,
    )
    const scaled = square.scale_simple(size * 2, size * 2, GdkPixbuf.InterpType.BILINEAR)
    return scaled && Gdk.Texture.new_for_pixbuf(scaled)
  } catch (err) {
    // Never worth losing the pill over: the initial says the same thing.
    console.warn(`struntuz-topbar: ignoring avatar at ${path}: ${err}`)
    return null
  }
}

function hhmm(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

// Percentage first, then whatever the battery can say about the rest: an
// estimate arrives late and reads as 0 until it does, so it is left out until
// it means something.
function batteryLine(present: boolean, percent: number, charging: boolean, secs: number): string {
  if (!present) return `${GLib.get_user_name()}@${GLib.get_host_name()}`

  const level = `${t.battery} ${Math.round(percent * 100)}%`
  if (charging) return `${level} · ${t.batteryCharging}`
  return secs > 0 ? `${level} · ${hhmm(secs)} ${t.batteryLeft}` : level
}

export function batteryStatus(): Accessor<string> {
  const battery = AstalBattery.get_default()

  return createComputed(
    [
      createBinding(battery, "isPresent"),
      createBinding(battery, "percentage"),
      createBinding(battery, "charging"),
      createBinding(battery, "timeToEmpty"),
    ],
    batteryLine,
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
  const battery = AstalBattery.get_default()

  return createComputed(
    [
      createPoll(uptimeSeconds(), 60_000, uptimeSeconds),
      createBinding(battery, "isPresent"),
      createBinding(battery, "percentage"),
    ],
    (secs, present, percent) => {
      const up = `${t.uptime} ${hhmm(secs)}`
      return present ? `${up} · ${t.battery} ${Math.round(percent * 100)}%` : up
    },
  )
}
