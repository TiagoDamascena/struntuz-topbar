import { Gtk } from "ags/gtk4"
import { Icons } from "../lib/icons"
import { nightLightOn, nightLightStatus, toggleNightLight } from "../lib/nightlight"
import { t } from "../lib/i18n"

// The blue light filter's tile, beside do-not-disturb. One button like that one:
// the design splits a tile in two where the switch has a sub-panel to open, and
// this one has nothing under it either.
export default function NightLight() {
  const on = nightLightOn()

  return (
    <button class={on.as((warm) => (warm ? "tile on" : "tile"))} onClicked={toggleNightLight}>
      <box spacing={9}>
        <image
          class="tile-icon"
          iconName={Icons.nightLight}
          pixelSize={18}
          valign={Gtk.Align.CENTER}
        />
        <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER}>
          <label class="tile-label" label={t.nightLight} xalign={0} />
          <label class="tile-sub" label={nightLightStatus()} xalign={0} />
        </box>
      </box>
    </button>
  )
}
