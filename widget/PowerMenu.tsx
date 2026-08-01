import { Gtk } from "ags/gtk4"
import { Icons } from "../lib/icons"
import { powerItems, runPower, type PowerItem } from "../lib/power"
import { sessionStatus } from "../lib/session"
import { t } from "../lib/i18n"

function Row(item: PowerItem, onRun: () => void) {
  // Shutting down is the one the design tints — the end of the list and the end
  // of the session, marked so it is never the click you did not mean.
  const primary = item.action === "shutdown"

  return (
    <button class={primary ? "power-row primary" : "power-row"} onClicked={onRun}>
      <box spacing={9}>
        <image
          class="power-row-icon"
          iconName={item.icon}
          pixelSize={17}
          valign={Gtk.Align.CENTER}
        />
        <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER}>
          <label class="power-row-label" label={item.label} xalign={0} />
          <label class="power-row-meta" label={item.meta} xalign={0} />
        </box>
      </box>
    </button>
  )
}

// Its page in the control centre's stack is declared here, as the audio menu's
// is: `$type` reaches the parent from the widget it made.
export default function PowerMenu(props: { onBack: () => void; onRun: () => void }) {
  return (
    <box
      $type="named"
      name="power"
      class="panel submenu"
      orientation={Gtk.Orientation.VERTICAL}
      valign={Gtk.Align.START}
    >
      <box class="submenu-head" spacing={9}>
        <button
          class="icon-button"
          tooltipText={t.back}
          valign={Gtk.Align.CENTER}
          onClicked={props.onBack}
        >
          <image iconName={Icons.back} pixelSize={16} />
        </button>
        <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER}>
          <label class="submenu-title" label={t.power} xalign={0} />
          <label class="submenu-subtitle" label={sessionStatus()} xalign={0} />
        </box>
      </box>
      <box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
        {powerItems().map((item) =>
          Row(item, () => {
            // Out of the way first: the panel should not still be sitting there
            // while the screen locks or the session goes down.
            props.onRun()
            runPower(item.action)
          }),
        )}
      </box>
    </box>
  )
}
