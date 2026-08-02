import { Gdk, Gtk } from "ags/gtk4"
import { readFile, writeFile } from "ags/file"
import GLib from "gi://GLib"

import back from "inline:../icons/struntuz-back-symbolic.svg"
import bell from "inline:../icons/struntuz-bell-symbolic.svg"
import bellSlash from "inline:../icons/struntuz-bell-slash-symbolic.svg"
import check from "inline:../icons/struntuz-check-symbolic.svg"
import close from "inline:../icons/struntuz-close-symbolic.svg"
import forward from "inline:../icons/struntuz-forward-symbolic.svg"
import lock from "inline:../icons/struntuz-lock-symbolic.svg"
import logout from "inline:../icons/struntuz-logout-symbolic.svg"
import moon from "inline:../icons/struntuz-moon-symbolic.svg"
import moonStars from "inline:../icons/struntuz-moon-stars-symbolic.svg"
import pause from "inline:../icons/struntuz-pause-symbolic.svg"
import pauseFill from "inline:../icons/struntuz-pause-fill-symbolic.svg"
import play from "inline:../icons/struntuz-play-symbolic.svg"
import playFill from "inline:../icons/struntuz-play-fill-symbolic.svg"
import power from "inline:../icons/struntuz-power-symbolic.svg"
import repeat from "inline:../icons/struntuz-repeat-symbolic.svg"
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
