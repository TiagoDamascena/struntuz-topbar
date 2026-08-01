import { Gdk, Gtk } from "ags/gtk4"
import { readFile, writeFile } from "ags/file"
import GLib from "gi://GLib"

import back from "inline:../icons/struntuz-back-symbolic.svg"
import bell from "inline:../icons/struntuz-bell-symbolic.svg"
import bellSlash from "inline:../icons/struntuz-bell-slash-symbolic.svg"
import close from "inline:../icons/struntuz-close-symbolic.svg"
import lock from "inline:../icons/struntuz-lock-symbolic.svg"
import logout from "inline:../icons/struntuz-logout-symbolic.svg"
import moon from "inline:../icons/struntuz-moon-symbolic.svg"
import power from "inline:../icons/struntuz-power-symbolic.svg"
import restart from "inline:../icons/struntuz-restart-symbolic.svg"
import sliders from "inline:../icons/struntuz-sliders-symbolic.svg"

// Names, not paths: everything downstream asks the icon theme, so a widget never
// knows whether the icon shipped with the bar or came from the user's theme.
export const Icons = {
  back: "struntuz-back-symbolic",
  close: "struntuz-close-symbolic",
  controlCenter: "struntuz-sliders-symbolic",
  notification: "struntuz-bell-symbolic",
  notificationOff: "struntuz-bell-slash-symbolic",
  lock: "struntuz-lock-symbolic",
  logout: "struntuz-logout-symbolic",
  power: "struntuz-power-symbolic",
  restart: "struntuz-restart-symbolic",
  suspend: "struntuz-moon-symbolic",
} as const

const SOURCES: Record<string, string> = {
  [Icons.back]: back,
  [Icons.close]: close,
  [Icons.controlCenter]: sliders,
  [Icons.notification]: bell,
  [Icons.notificationOff]: bellSlash,
  [Icons.lock]: lock,
  [Icons.logout]: logout,
  [Icons.power]: power,
  [Icons.restart]: restart,
  [Icons.suspend]: moon,
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
