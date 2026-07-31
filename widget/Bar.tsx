import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState } from "ags"
import Clock from "./Clock"
import ControlCenter from "./ControlCenter"
import ControlCenterButton from "./ControlCenterButton"
import Workspaces from "./Workspaces"

export default function Bar(gdkmonitor: Gdk.Monitor) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

  // One control centre per monitor, opened by that monitor's own button, so the
  // panel always comes down from the bar that was clicked.
  const [open, setOpen] = createState(false)
  ControlCenter({ gdkmonitor, open, close: () => setOpen(false) })

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
        <box $type="start" spacing={8} valign={Gtk.Align.CENTER}>
          <Workspaces />
        </box>
        <box $type="center" valign={Gtk.Align.CENTER}>
          <Clock />
        </box>
        <box $type="end" spacing={8} valign={Gtk.Align.CENTER} halign={Gtk.Align.END}>
          <ControlCenterButton open={open} onToggle={() => setOpen(!open.get())} />
        </box>
      </centerbox>
    </window>
  )
}
