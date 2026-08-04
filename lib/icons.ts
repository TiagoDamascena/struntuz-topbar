import { Gdk, Gtk } from "ags/gtk4"
import { readFile, writeFile } from "ags/file"
import GLib from "gi://GLib"

import back from "inline:../icons/struntuz-back-symbolic.svg"
import battery0 from "inline:../icons/struntuz-battery-0-symbolic.svg"
import battery25 from "inline:../icons/struntuz-battery-25-symbolic.svg"
import battery50 from "inline:../icons/struntuz-battery-50-symbolic.svg"
import battery75 from "inline:../icons/struntuz-battery-75-symbolic.svg"
import battery100 from "inline:../icons/struntuz-battery-100-symbolic.svg"
import battery0Charging from "inline:../icons/struntuz-battery-0-charging-symbolic.svg"
import battery25Charging from "inline:../icons/struntuz-battery-25-charging-symbolic.svg"
import battery50Charging from "inline:../icons/struntuz-battery-50-charging-symbolic.svg"
import battery75Charging from "inline:../icons/struntuz-battery-75-charging-symbolic.svg"
import battery100Charging from "inline:../icons/struntuz-battery-100-charging-symbolic.svg"
import bell from "inline:../icons/struntuz-bell-symbolic.svg"
import bellSlash from "inline:../icons/struntuz-bell-slash-symbolic.svg"
import check from "inline:../icons/struntuz-check-symbolic.svg"
import close from "inline:../icons/struntuz-close-symbolic.svg"
import forward from "inline:../icons/struntuz-forward-symbolic.svg"
import lock from "inline:../icons/struntuz-lock-symbolic.svg"
import logout from "inline:../icons/struntuz-logout-symbolic.svg"
import moon from "inline:../icons/struntuz-moon-symbolic.svg"
import moonStars from "inline:../icons/struntuz-moon-stars-symbolic.svg"
import music from "inline:../icons/struntuz-music-symbolic.svg"
import pause from "inline:../icons/struntuz-pause-symbolic.svg"
import pauseFill from "inline:../icons/struntuz-pause-fill-symbolic.svg"
import play from "inline:../icons/struntuz-play-symbolic.svg"
import playFill from "inline:../icons/struntuz-play-fill-symbolic.svg"
import power from "inline:../icons/struntuz-power-symbolic.svg"
import repeat from "inline:../icons/struntuz-repeat-symbolic.svg"
import repeatOne from "inline:../icons/struntuz-repeat-one-symbolic.svg"
import restart from "inline:../icons/struntuz-restart-symbolic.svg"
import shuffle from "inline:../icons/struntuz-shuffle-symbolic.svg"
import sliders from "inline:../icons/struntuz-sliders-symbolic.svg"
import speaker from "inline:../icons/struntuz-speaker-symbolic.svg"
import speakerFill from "inline:../icons/struntuz-speaker-fill-symbolic.svg"
import speakerHigh from "inline:../icons/struntuz-speaker-high-symbolic.svg"
import speakerHighFill from "inline:../icons/struntuz-speaker-high-fill-symbolic.svg"
import speakerLow from "inline:../icons/struntuz-speaker-low-symbolic.svg"
import speakerLowFill from "inline:../icons/struntuz-speaker-low-fill-symbolic.svg"
import speakerMedium from "inline:../icons/struntuz-speaker-medium-symbolic.svg"
import speakerMediumFill from "inline:../icons/struntuz-speaker-medium-fill-symbolic.svg"
import speakerSlash from "inline:../icons/struntuz-speaker-slash-symbolic.svg"
import speakerSlashFill from "inline:../icons/struntuz-speaker-slash-fill-symbolic.svg"
import trackNext from "inline:../icons/struntuz-track-next-symbolic.svg"
import trackPrevious from "inline:../icons/struntuz-track-previous-symbolic.svg"

// Names, not paths: everything downstream asks the icon theme, so a widget never
// knows whether the icon shipped with the bar or came from the user's theme.
export const Icons = {
  back: "struntuz-back-symbolic",
  // The same chevron the other way round: it opens a sub-panel where `back`
  // leaves one, so the pair reads as the one movement.
  forward: "struntuz-forward-symbolic",
  check: "struntuz-check-symbolic",
  close: "struntuz-close-symbolic",
  controlCenter: "struntuz-sliders-symbolic",
  notification: "struntuz-bell-symbolic",
  notificationOff: "struntuz-bell-slash-symbolic",
  lock: "struntuz-lock-symbolic",
  logout: "struntuz-logout-symbolic",
  // Stars beside the crescent, so the filter's tile and the power menu's
  // suspend row do not read as the same switch.
  nightLight: "struntuz-moon-stars-symbolic",
  power: "struntuz-power-symbolic",
  restart: "struntuz-restart-symbolic",
  suspend: "struntuz-moon-symbolic",
  // The transport. `trackNext` is not `forward`: that one is the chevron the
  // sub-panels open on, and these two are the bar at the end of a track.
  trackPrevious: "struntuz-track-previous-symbolic",
  trackNext: "struntuz-track-next-symbolic",
  shuffle: "struntuz-shuffle-symbolic",
  repeat: "struntuz-repeat-symbolic",
  // The same arrows with a 1 in them: looping one track and looping the list
  // are two states of one button, so they have to be two glyphs or the button
  // has only the tooltip to tell them apart.
  repeatOne: "struntuz-repeat-one-symbolic",
  // A track with no cover wears this rather than an empty tile.
  music: "struntuz-music-symbolic",
} as const

// Play and pause, twice over, on the same rule the volume ramp follows: outline
// in the panel, filled on the bar. The pill's glyph is a state and not a
// control, so the weight is what has to carry it at 12px of ink.
export const PlayIcons = {
  outline: {
    play: "struntuz-play-symbolic",
    pause: "struntuz-pause-symbolic",
  },
  fill: {
    play: "struntuz-play-fill-symbolic",
    pause: "struntuz-pause-fill-symbolic",
  },
} as const

export type PlayWeight = keyof typeof PlayIcons

// The volume ramp: how many waves is how loud, so the glyph carries the number
// the label shows rather than decorating it. Every step is drawn on the same
// 24 canvas with the cone in the same place, so what changes as the volume
// moves is the waves and not the size of the speaker.
//
// Twice over, per the set's rule: outline in the panels, filled in the bar —
// the same symbol carries the weight of what it sits on, and a bar pill is a
// smaller, busier surface than a 452px panel.
export const VolumeIcons = {
  outline: {
    muted: "struntuz-speaker-slash-symbolic",
    silent: "struntuz-speaker-symbolic",
    low: "struntuz-speaker-low-symbolic",
    medium: "struntuz-speaker-medium-symbolic",
    high: "struntuz-speaker-high-symbolic",
  },
  fill: {
    muted: "struntuz-speaker-slash-fill-symbolic",
    silent: "struntuz-speaker-fill-symbolic",
    low: "struntuz-speaker-low-fill-symbolic",
    medium: "struntuz-speaker-medium-fill-symbolic",
    high: "struntuz-speaker-high-fill-symbolic",
  },
} as const

export type VolumeWeight = keyof typeof VolumeIcons

// The battery ramp: how full the casing is drawn is how much is left, the same
// lever the volume ramp pulls, and the same two-ramp shape — except that what
// picks the ramp here is the direction the level is moving, not the surface the
// glyph sits on. The "outline in the panels, filled in the bar" rule has
// nothing to choose between: SF Symbols ships no filled battery to pair with
// the outline, because the casing already *is* the outline and the level inside
// it already is the fill, so a battery in a panel would wear these same ten.
//
// The bolt is per level and not one glyph for all of charging. SF Symbols only
// ships `battery.100percent.bolt`, which would collapse every charging state
// into a full battery — rendered and looked at, all five drew identically, so a
// battery charging at 5% read as one about to come off the charger. The bolt is
// a second thing to say, and it does not get to cost the first.
export const BatteryIcons = {
  discharging: {
    empty: "struntuz-battery-0-symbolic",
    quarter: "struntuz-battery-25-symbolic",
    half: "struntuz-battery-50-symbolic",
    threeQuarters: "struntuz-battery-75-symbolic",
    full: "struntuz-battery-100-symbolic",
  },
  charging: {
    empty: "struntuz-battery-0-charging-symbolic",
    quarter: "struntuz-battery-25-charging-symbolic",
    half: "struntuz-battery-50-charging-symbolic",
    threeQuarters: "struntuz-battery-75-charging-symbolic",
    // The one SF Symbols ships as drawn: `battery.100percent.bolt`. It is also
    // where a full battery with a bolt is literally true, which is what a
    // machine sitting at FULLY_CHARGED wears.
    full: "struntuz-battery-100-charging-symbolic",
  },
} as const

// The ramp read low to high, so a step is an index rather than five branches.
export const BATTERY_STEPS = ["empty", "quarter", "half", "threeQuarters", "full"] as const

const SOURCES: Record<string, string> = {
  [Icons.back]: back,
  [Icons.forward]: forward,
  [Icons.check]: check,
  [Icons.close]: close,
  [Icons.controlCenter]: sliders,
  [Icons.notification]: bell,
  [Icons.notificationOff]: bellSlash,
  [Icons.lock]: lock,
  [Icons.logout]: logout,
  [Icons.nightLight]: moonStars,
  [Icons.power]: power,
  [Icons.restart]: restart,
  [Icons.suspend]: moon,
  [Icons.trackPrevious]: trackPrevious,
  [Icons.trackNext]: trackNext,
  [Icons.shuffle]: shuffle,
  [Icons.repeat]: repeat,
  [Icons.repeatOne]: repeatOne,
  [Icons.music]: music,
  [BatteryIcons.discharging.empty]: battery0,
  [BatteryIcons.discharging.quarter]: battery25,
  [BatteryIcons.discharging.half]: battery50,
  [BatteryIcons.discharging.threeQuarters]: battery75,
  [BatteryIcons.discharging.full]: battery100,
  [BatteryIcons.charging.empty]: battery0Charging,
  [BatteryIcons.charging.quarter]: battery25Charging,
  [BatteryIcons.charging.half]: battery50Charging,
  [BatteryIcons.charging.threeQuarters]: battery75Charging,
  [BatteryIcons.charging.full]: battery100Charging,
  [PlayIcons.outline.play]: play,
  [PlayIcons.outline.pause]: pause,
  [PlayIcons.fill.play]: playFill,
  [PlayIcons.fill.pause]: pauseFill,
  // The bare speaker is only the ramp's 0% now — the audio menu's rows wear
  // `high`, since a device in that list is never the silent one.
  [VolumeIcons.outline.silent]: speaker,
  [VolumeIcons.outline.low]: speakerLow,
  [VolumeIcons.outline.medium]: speakerMedium,
  [VolumeIcons.outline.high]: speakerHigh,
  [VolumeIcons.outline.muted]: speakerSlash,
  [VolumeIcons.fill.silent]: speakerFill,
  [VolumeIcons.fill.low]: speakerLowFill,
  [VolumeIcons.fill.medium]: speakerMediumFill,
  [VolumeIcons.fill.high]: speakerHighFill,
  [VolumeIcons.fill.muted]: speakerSlashFill,
}

// GTK only recolours an icon it loaded itself, from a file whose name ends in
// `-symbolic.svg`, so the SVGs cannot stay strings: they are bundled into the
// binary (`inline:`) and laid back down on disk here. The cache is the right
// place for that — it is derived data, rewritten on every start.
const DIR = `${GLib.get_user_cache_dir()}/struntuz-topbar/icons`

let installed = false

export function installIcons(): void {
  if (installed) return
  installed = true

  if (GLib.mkdir_with_parents(DIR, 0o755) !== 0) {
    console.warn(`struntuz-topbar: cannot write icons to ${DIR}, falling back to the icon theme`)
    return
  }

  for (const [name, svg] of Object.entries(SOURCES)) {
    const path = `${DIR}/${name}.svg`
    try {
      // Only when it changed: an unchanged mtime keeps GTK from reloading the
      // theme behind us on every start.
      if (GLib.file_test(path, GLib.FileTest.EXISTS) && readFile(path) === svg) continue
      writeFile(path, svg)
    } catch (err) {
      console.warn(`struntuz-topbar: cannot write ${path}: ${err}`)
    }
  }

  const display = Gdk.Display.get_default()
  if (!display) return console.warn("struntuz-topbar: no display, icons stay unthemed")

  // A search path is scanned for loose icons as well as for themes, so the flat
  // directory above is enough — no index.theme, no size subdirectories.
  Gtk.IconTheme.get_for_display(display).add_search_path(DIR)
}

// Whether the theme can draw a name at all. GTK answers a missing icon with the
// broken-image glyph, which says less than the bar's own fallback does.
export function hasIcon(name: string): boolean {
  const display = Gdk.Display.get_default()
  return display ? Gtk.IconTheme.get_for_display(display).has_icon(name) : false
}
