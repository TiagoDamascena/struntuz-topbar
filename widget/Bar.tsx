import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createComputed, createState } from "ags"
import Calendar from "./Calendar"
import Clock from "./Clock"
import ControlCenter, { type View } from "./ControlCenter"
import Controls from "./Controls"
import Media from "./Media"
import MediaPanel from "./MediaPanel"
import Toasts from "./Toasts"
import Tray from "./Tray"
import Workspaces from "./Workspaces"
import { BAR_SIDE, BAR_TOP } from "../lib/layout"

export default function Bar(gdkmonitor: Gdk.Monitor) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

  // One control centre per monitor, opened by that monitor's own button, so the
  // panel always comes down from the bar that was clicked.
  const [open, setOpen] = createState(false)
  // Which panel it comes down on. The bar owns it because the bar has two ways
  // in: the toggle, which opens the main view, and a segment, which opens the
  // sub-panel it stands for and lights up while that one is showing.
  const [view, setView] = createState<View>("main")

  // The media panel, on the other end of the bar, and the calendar under the
  // clock. No two of the three are ever up at once: each is a window over the
  // whole output with a click-away scrim, so the second one to open would be
  // catching the first one's dismissals. The design closes them against each
  // other for the same reason.
  const [media, setMedia] = createState(false)
  const [calendar, setCalendar] = createState(false)

  function show(next: View) {
    setMedia(false)
    setCalendar(false)
    setView(next)
    setOpen(true)
  }

  // Only the window: which view it goes back to is the panel's own, since it
  // has to stay on the one it is showing until it has finished leaving.
  function hide() {
    setOpen(false)
  }

  function showMedia() {
    setOpen(false)
    setCalendar(false)
    setMedia(true)
  }

  function hideMedia() {
    setMedia(false)
  }

  function showCalendar() {
    setOpen(false)
    setMedia(false)
    setCalendar(true)
  }

  function hideCalendar() {
    setCalendar(false)
  }

  ControlCenter({ gdkmonitor, open, view, setView, close: hide })
  MediaPanel({ gdkmonitor, open: media, close: hideMedia })
  Calendar({ gdkmonitor, open: calendar, close: hideCalendar })
  Toasts({ gdkmonitor, hidden: open })

  // Lit only while the panel is showing what it opens, so the toggle and the
  // segments never read as two things being open at once.
  const showingMain = createComputed(() => open() && view() === "main")

  return (
    <window
      visible
      name="struntuz-topbar"
      namespace="struntuz-topbar"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      anchor={TOP | LEFT | RIGHT}
      marginTop={BAR_TOP}
      marginLeft={BAR_SIDE}
      marginRight={BAR_SIDE}
      application={app}
    >
      <centerbox class="bar">
        {/* The same gap the end of the strip leaves between two pills. */}
        <box $type="start" spacing={7} valign={Gtk.Align.CENTER}>
          <Workspaces />
          <Media open={media} onToggle={() => (media.get() ? hideMedia() : showMedia())} />
        </box>
        <box $type="center" valign={Gtk.Align.CENTER}>
          <Clock
            open={calendar}
            onToggle={() => (calendar.get() ? hideCalendar() : showCalendar())}
          />
        </box>
        {/* The design's own gap between two pills, brought down with the bar.
            It is the first place the strip holds more than one, and an invisible
            child takes its spacing with it — so an empty tray costs nothing. */}
        <box $type="end" spacing={7} valign={Gtk.Align.CENTER} halign={Gtk.Align.END}>
          <Tray />
          <Controls
            open={open}
            view={view}
            main={showingMain}
            onOpen={show}
            onClose={hide}
            onToggle={() => (showingMain.get() ? hide() : show("main"))}
          />
        </box>
      </centerbox>
    </window>
  )
}
