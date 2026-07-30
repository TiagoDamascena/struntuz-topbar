import { Gtk } from "ags/gtk4"
import { createPoll } from "ags/time"
import GLib from "gi://GLib"
import { getConfig } from "../lib/config"
import { t } from "../lib/i18n"

function format(pattern: string): string {
  return GLib.DateTime.new_now_local().format(pattern) ?? ""
}

export default function Clock() {
  const cfg = getConfig()
  const dateFormat = cfg.dateFormat || t.dateFormat

  const date = createPoll("", 30_000, () => format(dateFormat))
  const time = createPoll("", 1_000, () => format(cfg.clockFormat))

  return (
    <box class="pill clock" spacing={10} valign={Gtk.Align.CENTER}>
      <label class="clock-date" label={date} />
      <label class="clock-time" label={time} />
    </box>
  )
}
