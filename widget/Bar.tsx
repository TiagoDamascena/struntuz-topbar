import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createPoll } from "ags/time"
import GLib from "gi://GLib"

export default function Bar(gdkmonitor: Gdk.Monitor) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

  const clock = createPoll(
    "",
    1000,
    () => GLib.DateTime.new_now_local().format("%H:%M") ?? "",
  )

  return (
    <window
      visible
      name="struntuz-topbar"
      namespace="struntuz-topbar"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      anchor={TOP | LEFT | RIGHT}
      application={app}
    >
      <centerbox class="bar">
        <box $type="start" class="section" halign={Gtk.Align.START} />
        <box $type="center" class="section" halign={Gtk.Align.CENTER}>
          <label class="clock" label={clock} />
        </box>
        <box $type="end" class="section" halign={Gtk.Align.END} />
      </centerbox>
    </window>
  )
}
