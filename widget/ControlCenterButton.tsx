import { Gtk } from "ags/gtk4"
import { Accessor } from "ags"
import { Icons } from "../lib/icons"
import { t } from "../lib/i18n"

export default function ControlCenterButton(props: {
  open: Accessor<boolean>
  onToggle: () => void
}) {
  return (
    <box class="pill icon-pill" valign={Gtk.Align.CENTER}>
      <button
        class={props.open.as((open) => (open ? "icon-button open" : "icon-button"))}
        tooltipText={t.controlCenter}
        valign={Gtk.Align.CENTER}
        onClicked={props.onToggle}
      >
        <image iconName={Icons.controlCenter} pixelSize={19} />
      </button>
    </box>
  )
}
