import { Gtk } from "ags/gtk4"
import { Icons } from "../lib/icons"
import { dontDisturb, toggleDontDisturb } from "../lib/notifications"
import { t } from "../lib/i18n"

// The design's toggle tile. It is one button, unlike the tiles beside it there:
// the design splits a tile in two — the disc toggles, the body opens a
// sub-panel — and do-not-disturb has no sub-panel to open, so the whole tile
// does the one thing it has.
export default function DoNotDisturb() {
  const on = dontDisturb()

  return (
    <button class={on.as((quiet) => (quiet ? "tile on" : "tile"))} onClicked={toggleDontDisturb}>
      <box spacing={9}>
        <image
          class="tile-icon"
          iconName={on.as((quiet) => (quiet ? Icons.notificationOff : Icons.notification))}
          pixelSize={18}
          valign={Gtk.Align.CENTER}
        />
        <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER}>
          <label class="tile-label" label={t.doNotDisturb} xalign={0} />
          <label
            class="tile-sub"
            label={on.as((quiet) => (quiet ? t.doNotDisturbOn : t.doNotDisturbOff))}
            xalign={0}
          />
        </box>
      </box>
    </button>
  )
}
