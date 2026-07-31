import { Gtk } from "ags/gtk4"
import { Accessor } from "ags"
import { Icons } from "../lib/icons"
import { notificationCount } from "../lib/notifications"
import { t } from "../lib/i18n"

export default function ControlCenterButton(props: {
  open: Accessor<boolean>
  onToggle: () => void
}) {
  const count = notificationCount()

  return (
    <overlay>
      <box class="pill icon-pill" valign={Gtk.Align.CENTER}>
        <button
          class={props.open.as((open) => (open ? "icon-button open" : "icon-button"))}
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
