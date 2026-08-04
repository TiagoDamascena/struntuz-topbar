import { Gtk } from "ags/gtk4"
import { Accessor } from "ags"
import { createPoll } from "ags/time"
import GLib from "gi://GLib"
import { getConfig } from "../lib/config"
import { t } from "../lib/i18n"

function format(pattern: string): string {
  return GLib.DateTime.new_now_local().format(pattern) ?? ""
}

// The whole pill is the button, as on the media pill: the date and the time are
// what it says, not two controls, and the calendar under it is what a date on a
// bar is for.
export default function Clock(props: { open: Accessor<boolean>; onToggle: () => void }) {
  const cfg = getConfig()
  const dateFormat = cfg.dateFormat || t.dateFormat

  const date = createPoll("", 30_000, () => format(dateFormat))
  const time = createPoll("", 1_000, () => format(cfg.clockFormat))

  return (
    <button
      // Lit while the panel it opens is showing, the way the bar's other
      // openers are.
      class={props.open.as((open) => (open ? "clock open" : "clock"))}
      tooltipText={t.calendar}
      valign={Gtk.Align.CENTER}
      onClicked={props.onToggle}
    >
      <box spacing={10}>
        <label class="clock-date" label={date} />
        <label class="clock-time" label={time} />
      </box>
    </button>
  )
}
