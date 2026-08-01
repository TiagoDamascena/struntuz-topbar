import { Gtk } from "ags/gtk4"
import { Accessor, createComputed } from "ags"
import { Icons } from "../lib/icons"
import { dontDisturb, notificationCount } from "../lib/notifications"
import { t } from "../lib/i18n"

export default function ControlCenterButton(props: {
  // Whether the panel is showing the main view — the one this button opens.
  // A sub-panel is a segment's to light up, not this one's.
  active: Accessor<boolean>
  onToggle: () => void
}) {
  // Do-not-disturb takes the count off the bar as well as the cards off the
  // screen, the way the design does: a badge is an interruption of its own, and
  // what is waiting is still there to be found in the panel.
  const count = createComputed([notificationCount(), dontDisturb()], (n, quiet) => (quiet ? 0 : n))

  return (
    <overlay>
      <box class="pill icon-pill" valign={Gtk.Align.CENTER}>
        <button
          class={props.active.as((open) => (open ? "icon-button open" : "icon-button"))}
          tooltipText={count.as((n) =>
            n > 0 ? `${t.controlCenter} · ${n} ${t.notifications.toLowerCase()}` : t.controlCenter,
          )}
          valign={Gtk.Align.CENTER}
          onClicked={props.onToggle}
        >
          <image iconName={Icons.controlCenter} pixelSize={19} />
        </button>
      </box>
      {/* The design hangs the badge off the button's top-right corner. The
          overlay goes around the pill and not inside it for that: aligned to the
          pill's own box, the disc lands on the corner a circle leaves empty and
          reads as hanging off its edge, while staying inside the window — which
          is exactly as tall as the pill and would cut off anything above it. */}
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
