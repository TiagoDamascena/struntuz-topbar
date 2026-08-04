import { Accessor, createBinding, createComputed } from "ags"
import { readFile } from "ags/file"
import AstalBattery from "gi://AstalBattery"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { BATTERY_STEPS, BatteryIcons } from "./icons"
import { getConfig } from "./config"
import { t } from "./i18n"

// upower's DisplayDevice, which is what astal's default is: the aggregate it
// composes from every battery it can see, so a laptop with two of them reports
// one level and nothing here has to pick. Unlike `lib/audio.ts` there is no
// null to guard — a machine with no battery answers `isPresent` false rather
// than leaving the library missing, so absence is a reading and not a branch.
const device = AstalBattery.get_default()

export function present(): Accessor<boolean> {
  return createBinding(device, "isPresent")
}

// Rounded once, here. Everything downstream steps on this rather than on the
// raw fraction, so the glyph and the number can never disagree — the rule
// `volumeIcon` follows in `lib/audio.ts`.
export function percent(): Accessor<number> {
  return createBinding(device, "percentage").as((value) => Math.round(value * 100))
}

export function charging(): Accessor<boolean> {
  return createBinding(device, "charging")
}

// On AC with nothing left to put in. upower stops calling that charging and
// reports no estimate either way, so without it the bar would draw a
// discharging battery on a machine with a cable in it.
export function charged(): Accessor<boolean> {
  return createBinding(device, "state").as((state) => state === AstalBattery.State.FULLY_CHARGED)
}

// Cable in, level held: a laptop that has hit a charge threshold sits here for
// hours, and the kernel calls it "Not charging" where upower calls it
// PENDING_CHARGE. It is neither of the two states the ramp was built around,
// and getting it wrong is not cosmetic — read as discharging, a machine holding
// at a 60% threshold would fly the low warning with the charger plugged in.
export function pendingCharge(): Accessor<boolean> {
  return createBinding(device, "state").as((state) => state === AstalBattery.State.PENDING_CHARGE)
}

// Which of the two ramps is drawn, and it is the cable that decides rather than
// the movement: a battery filling wears the bolt whether it is filling toward
// 80%, sitting at 100%, or held at a threshold, since none of those is a level
// being spent. Charged lands on the ramp's own top step — a full battery with a
// bolt, the one place SF Symbols' stock glyph says exactly what is true.
function plugged(): Accessor<boolean> {
  return createComputed(
    [charging(), charged(), pendingCharge()],
    (a, b, c) => a || b || c,
  )
}

// Stepped to the *nearest* quarter, not to the band below it: five casings
// drawn 25 apart can only be read as pictures of the level, and biasing them
// down would put an empty casing on a battery with an hour left. What warns is
// the colour (`isLow`), which is why the ramp is free to stay honest.
//
// The bolt rides the same step rather than replacing it, so the level survives
// being plugged in — the whole reason charging is a ramp here and not the one
// glyph SF Symbols ships.
export function batteryIcon(): Accessor<string> {
  const [level, filling] = [percent(), plugged()]

  return createComputed(() => {
    const ramp = filling() ? BatteryIcons.charging : BatteryIcons.discharging
    return ramp[BATTERY_STEPS[Math.min(Math.max(Math.round(level() / 25), 0), 4)]]
  })
}

// An uptime and a time-to-empty are the same shape of number, so this is the
// one clock both are read on — `lib/session.ts` takes it from here rather than
// keeping a second copy.
export function hhmm(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

// Percentage first, then whatever the battery can say about the rest: an
// estimate arrives late and reads as 0 until it does, so it is left out until
// it means something.
export function batteryStatus(): Accessor<string> {
  return createComputed(
    [
      percent(),
      charging(),
      charged(),
      pendingCharge(),
      createBinding(device, "timeToEmpty"),
      createBinding(device, "timeToFull"),
    ],
    (level, isCharging, isCharged, isHeld, toEmpty, toFull) => {
      const head = `${t.battery} ${level}%`
      if (isCharged) return `${head} · ${t.batteryFull}`
      if (isCharging) {
        return toFull > 0 ? `${head} · ${hhmm(toFull)} ${t.batteryUntilFull}` : `${head} · ${t.batteryCharging}`
      }
      // No estimate on either side of it: nothing is moving, so both of
      // upower's clocks read 0 and the bolt would otherwise go unexplained.
      if (isHeld) return `${head} · ${t.batteryPlugged}`
      return toEmpty > 0 ? `${head} · ${hhmm(toEmpty)} ${t.batteryLeft}` : head
    },
  )
}

// The kernel's own view, consulted only to explain a disagreement. Astal reads
// UPower, and UPower is a daemon that can simply not be running — which looks
// exactly like a desktop with no battery, since `isPresent` is false either way
// and the widget hides itself either way. This is what tells the two apart.
function kernelHasBattery(): boolean {
  const root = "/sys/class/power_supply"
  try {
    const dir = GLib.Dir.open(root, 0)
    for (let name = dir.read_name(); name; name = dir.read_name()) {
      const kind = `${root}/${name}/type`
      if (!GLib.file_test(kind, GLib.FileTest.EXISTS)) continue
      if (readFile(kind).trim() === "Battery") return true
    }
  } catch {
    // No sysfs, or nothing readable in it — then there is no second opinion to
    // hold UPower against, and saying nothing is the honest answer.
  }
  return false
}

// Name ownership rather than a property that has not synced yet: this runs at
// startup, and a proxy still settling reports the same false a missing daemon
// does. Asking the bus has no such window.
function upowerRunning(): boolean {
  try {
    const reply = Gio.DBus.system.call_sync(
      "org.freedesktop.DBus",
      "/org/freedesktop/DBus",
      "org.freedesktop.DBus",
      "NameHasOwner",
      new GLib.Variant("(s)", ["org.freedesktop.UPower"]),
      new GLib.VariantType("(b)"),
      Gio.DBusCallFlags.NONE,
      1000,
      null,
    )
    return reply.deep_unpack<[boolean]>()[0]
  } catch {
    // No system bus to ask. Whatever is wrong, it is not this module's to
    // diagnose, and a warning here would be guessing.
    return true
  }
}

// Said once, at startup. A battery the kernel can see and UPower cannot is
// almost always UPower not running, and there is nothing else anywhere — no
// toast, no glyph, no line in the log — to say why the bar came up without one.
export function warnIfUnreadable(): void {
  if (upowerRunning() || !kernelHasBattery()) return

  console.warn(
    "struntuz-topbar: the kernel reports a battery but UPower is not on the " +
      "system bus, so there is nothing to read it with and the bar leaves the " +
      "battery out. Start the upower daemon (NixOS: services.upower.enable = true).",
  )
}

// Held to 1–100: a threshold outside that is not one, and a 0 would take the
// warning off the bar altogether rather than turning it off deliberately.
function lowThreshold(): number {
  return Math.min(Math.max(getConfig().batteryLow, 1), 100)
}

// Only on the way down. A battery at 15% with a cable in it is filling, and a
// bar that warns about it is warning about something already being handled.
export function isLow(): Accessor<boolean> {
  const threshold = lowThreshold()

  return createComputed(
    [percent(), plugged()],
    (level, filling) => !filling && level <= threshold,
  )
}
