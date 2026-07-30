import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import Clock from "./Clock"

export default function Bar(gdkmonitor: Gdk.Monitor) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

  return (
    <window
      visible
      name="struntuz-topbar"
      namespace="struntuz-topbar"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      anchor={TOP | LEFT | RIGHT}
      marginTop={10}
      marginLeft={14}
      marginRight={14}
      application={app}
    >
      <centerbox class="bar">
        <box $type="center" valign={Gtk.Align.CENTER}>
          <Clock />
        </box>
      </centerbox>
    </window>
  )
}
