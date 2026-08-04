import { Gtk } from "ags/gtk4"
import Pango from "gi://Pango"
import { Icons } from "../lib/icons"
import { enabled, hasWifi, toggleWifi, wifiIcon, wifiStatus } from "../lib/network"
import { t } from "../lib/i18n"

// A network name is as long as whoever named it, and a label asks for the whole
// of it — which the panel's column would then follow.
const NAME_CHARS = 22

// The first split tile in the panel: a disc that switches the radio, and beside
// it a way into the network list. The design draws every tile this way and the
// two already here are the halves of it that were needed — do-not-disturb and
// the night light switch something with nothing under it, so they stayed one
// button. This one is both, which is what the caret says.
//
// It spans the row rather than sharing it with the pair below. What is written
// on the second line here is a network name, where the others write "On" and
// "3400 K", and the disc and the caret take a tile's width off either end
// before the name starts — at half the panel it ellipsized at about eight
// characters.
export default function Wifi(props: { onOpen: () => void }) {
  // Nothing to draw without a card or without NetworkManager: the panel closes
  // the gap rather than offering a switch that answers nothing.
  if (!hasWifi()) return <box visible={false} />

  const on = enabled()

  return (
    <box class={on.as((up) => (up ? "tile split on" : "tile split"))} spacing={9}>
      <button
        class="tile-toggle"
        tooltipText={on.as((up) => (up ? t.wifiDisable : t.wifiEnable))}
        valign={Gtk.Align.CENTER}
        onClicked={toggleWifi}
      >
        {/* Stepped off the ink and not off the box, as the battery is. The
            arcs fill 18.0 units of the 24 `pixelSize` counts and all of the 24
            across, where the bell beside it in `.tile-icon` fills 24.0 by 22.0
            — so it is the wider glyph and takes the smaller box: at 20 it
            draws 20×15 in the 36px disc, leaving 8px a side against the bell's
            9.75, where matching the bell's height would have taken it to 24
            and 6px. */}
        <image iconName={wifiIcon()} pixelSize={20} />
      </button>

      <button class="tile-open" hexpand onClicked={props.onOpen}>
        <box spacing={6}>
          <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER} hexpand>
            <label class="tile-label" label={t.wifi} xalign={0} />
            <label
              class="tile-sub"
              label={wifiStatus()}
              xalign={0}
              maxWidthChars={NAME_CHARS}
              ellipsize={Pango.EllipsizeMode.END}
            />
          </box>
          {/* Only under the pointer, as the volume bar's is: what it opens is
              a second thing the tile does, and a caret sitting there for good
              would read as the tile's own shape. */}
          <image
            class="tile-caret"
            iconName={Icons.forward}
            pixelSize={12}
            valign={Gtk.Align.CENTER}
          />
        </box>
      </button>
    </box>
  )
}
