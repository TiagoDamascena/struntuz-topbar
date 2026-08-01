import { Gtk } from "ags/gtk4"
import { Accessor, createComputed } from "ags"
import { Icons } from "../lib/icons"
import { dontDisturb, notificationCount } from "../lib/notifications"
import { t } from "../lib/i18n"
import Segments from "./Segments"
import type { View } from "./ControlCenter"

// The bar's right-hand pill: the segments and the control-centre toggle in one
// capsule. They were two pills, which is the design's shape, and one is the
// user's: everything in here opens the same panel, and two capsules said they
// were two places to go.
export default function Controls(props: {
  open: Accessor<boolean>
  view: Accessor<View>
  // Whether the panel is showing the main view — the one the toggle opens. A
  // sub-panel is a segment's to light up, not the toggle's.
  main: Accessor<boolean>
  onOpen: (view: View) => void
  onClose: () => void
  onToggle: () => void
}) {
  // Do-not-disturb takes the count off the bar as well as the cards off the
  // screen, the way the design does: a badge is an interruption of its own, and
  // what is waiting is still there to be found in the panel.
  const count = createComputed([notificationCount(), dontDisturb()], (n, quiet) => (quiet ? 0 : n))

  return (
    <overlay>
      {/* The gap between the two lit circles, not between the glyphs: at 30px
          the buttons grew toward each other, and circles a pixel apart read as
          one shape the moment either of them lights up. */}
      <box class="pill icon-pill" spacing={3} valign={Gtk.Align.CENTER}>
        <Segments open={props.open} view={props.view} onOpen={props.onOpen} onClose={props.onClose} />
        <button
          class={props.main.as((open) => (open ? "icon-button open" : "icon-button"))}
          tooltipText={count.as((n) =>
            n > 0 ? `${t.controlCenter} · ${n} ${t.notifications.toLowerCase()}` : t.controlCenter,
          )}
          valign={Gtk.Align.CENTER}
          onClicked={props.onToggle}
        >
          <image iconName={Icons.controlCenter} pixelSize={15} />
        </button>
      </box>
      {/* The design hangs the badge off the button's top-right corner, and the
          overlay goes around the whole pill for it: the toggle is the last thing
          in the pill, so the pill's own corner is the toggle's, and aligned to
          the pill the disc lands where a circle leaves the corner empty — while
          staying inside the window, which is exactly as tall as the pill and
          would cut off anything above it. */}
      <label
        $type="overlay"
        class="badge"
        label={count.as(String)}
        visible={count.as((n) => n > 0)}
        halign={Gtk.Align.END}
        valign={Gtk.Align.START}
      />
    </overlay>
  )
}
