import app from "ags/gtk4/app"
import { Astal, Gdk, Gtk } from "ags/gtk4"
import { Accessor, createState, onCleanup } from "ags"
import { idle, timeout, Timer } from "ags/time"
import { Icons } from "../lib/icons"
import { userAvatar, userInitial, userName, userStatus } from "../lib/session"
import { t } from "../lib/i18n"
import AudioMenu from "./AudioMenu"
import DoNotDisturb from "./DoNotDisturb"
import NightLight from "./NightLight"
import Notifications from "./Notifications"
import PowerMenu from "./PowerMenu"
import Volume from "./Volume"
import { readNightLight } from "../lib/nightlight"
import { PANEL_SIDE, PANEL_TOP } from "../lib/layout"

// Where it hangs is the bar's, not this window's: measured from the top of the
// output, since the window ignores exclusive zones (see `lib/layout.ts`).
const PANEL_WIDTH = 400
const AVATAR = 36

// The panel sliding in from off the right edge and back out, which is
// `.control-center` in the stylesheet — this is the same number written a
// second time. The window has to outlive the close by exactly it, or there is
// nothing left on screen to animate; hence the mount/reveal pair below rather
// than the window's own `visible`.
const REVEAL_MS = 220

// Sliding from one view to the next. Shorter than the reveal: the panel is
// already up, and only its contents are changing.
const SWITCH_MS = 170

// The picture, or the initial when there is none. `overflow` is what rounds the
// picture off: in GTK4 a border-radius clips the background but not the content,
// until the widget is told to hide what falls outside its own rounded box.
function Avatar() {
  const picture = userAvatar(AVATAR)

  return picture ? (
    <image
      class="avatar"
      paintable={picture}
      pixelSize={AVATAR}
      overflow={Gtk.Overflow.HIDDEN}
      valign={Gtk.Align.CENTER}
    />
  ) : (
    <label class="avatar" label={userInitial()} valign={Gtk.Align.CENTER} />
  )
}

function UserPill(props: { onPower: () => void }) {
  return (
    <box class="panel user" spacing={10}>
      <Avatar />
      <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER} hexpand>
        <label class="user-name" label={userName()} xalign={0} />
        <label class="user-status" label={userStatus()} xalign={0} />
      </box>
      <button
        class="icon-button large"
        tooltipText={t.power}
        valign={Gtk.Align.CENTER}
        onClicked={props.onPower}
      >
        <image iconName={Icons.power} pixelSize={18} />
      </button>
    </box>
  )
}

// A sub-panel replaces the main view rather than stacking under it, as in the
// design, so the panel is only ever showing one of these. It is the bar's state
// and not this window's: the bar's segments open the panel straight onto a
// sub-panel, so what is showing has to be readable from up there.
//
// They are also the names of the pages in the `Gtk.Stack` below, which is what
// slides one into the next — and the stack slides on the order they are added
// in, so `main` has to be the first page for a sub-panel to come in from the
// right and go back out to it.
export type View = "main" | "power" | "audio"

export default function ControlCenter(props: {
  gdkmonitor: Gdk.Monitor
  open: Accessor<boolean>
  view: Accessor<View>
  setView: (view: View) => void
  close: () => void
}) {
  const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor

  // Two states where the window used to take `open` straight: `mounted` is
  // whether there is a window at all, `revealed` is whether what is in it is on
  // screen. Opening sets both, a turn of the loop apart, since a revealer needs
  // to be mapped with its child still hidden to have anything to animate from;
  // closing clears `revealed` first and only takes the window away once the
  // animation it started has run.
  const [mounted, setMounted] = createState(false)
  const [revealed, setRevealed] = createState(false)
  let pending: Timer | null = null

  props.open.subscribe(() => {
    pending?.cancel()

    if (props.open.get()) {
      // The night light is not the bar's to keep: a keybind or hyprsunset's own
      // schedule can have moved it since the panel was last up, so it is asked
      // again every time the panel comes back.
      readNightLight()
      setMounted(true)
      pending = idle(() => setRevealed(true))
    } else {
      setRevealed(false)
      pending = timeout(REVEAL_MS, () => {
        setMounted(false)
        // Back to the main view only once it is out of sight: reset it on the
        // way out and the panel slides back through it as it fades.
        props.setView("main")
      })
    }
  })

  return (
    <window
      visible={mounted}
      name="struntuz-control-center"
      namespace="struntuz-control-center"
      gdkmonitor={props.gdkmonitor}
      // Over the whole output, not beside the bar: the empty part of the window
      // is what catches the click that dismisses it, the way the design's
      // full-screen layer does.
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.ON_DEMAND}
      anchor={TOP | BOTTOM | LEFT | RIGHT}
      application={app}
    >
      <Gtk.EventControllerKey
        onKeyPressed={(_self, keyval) => {
          if (keyval !== Gdk.KEY_Escape) return false
          props.close()
          return true
        }}
      />
      <overlay>
        <box>
          <Gtk.GestureClick onPressed={props.close} />
        </box>
        {/* The panel comes in from the right and leaves the same way, rather
            than down from under the bar: the bar is a row of floating pills
            with gaps between them, so there is nothing up there for a panel to
            come out of, and most of a drop happened over bare wallpaper. The
            revealer is what carries it — pinned to the right by `halign`, so
            what its transition grows and shrinks is the left edge. */}
        <revealer
          $type="overlay"
          revealChild={revealed}
          transitionType={Gtk.RevealerTransitionType.SLIDE_LEFT}
          transitionDuration={REVEAL_MS}
          halign={Gtk.Align.END}
          valign={Gtk.Align.START}
          marginTop={PANEL_TOP}
          marginEnd={PANEL_SIDE}
        >
          {/* One page per view rather than three panels taking turns at being
              visible. `interpolateSize` is what makes the swap a move and not a
              jump: the pages are different heights, and without it the column
              snaps to the new one on the first frame. */}
          <stack
            // Nothing to click while it is on its way out: `can-target` takes a
            // widget's children with it, so the whole panel goes at once.
            canTarget={revealed}
            // Not `visibleChildName={props.view}`: gnim peeks an accessor into
            // the constructor, and a stack with no pages yet warns that the
            // name is not one of them. `$` runs once everything is in.
            $={(self) => {
              const apply = () => self.set_visible_child_name(props.view.get())
              apply()
              onCleanup(props.view.subscribe(apply))
            }}
            transitionType={Gtk.StackTransitionType.SLIDE_LEFT_RIGHT}
            transitionDuration={SWITCH_MS}
            vhomogeneous={false}
            interpolateSize
            widthRequest={PANEL_WIDTH}
          >
            {/* Every page holds its natural height: while the stack is
                interpolating from one to the other it is taller than one of
                them, and a page that filled would stretch on the way. */}
            <box
              $type="named"
              name="main"
              orientation={Gtk.Orientation.VERTICAL}
              spacing={8}
              valign={Gtk.Align.START}
            >
              <UserPill onPower={() => props.setView("power")} />
              {/* The design's tile grid, between the user pill and the
                  notifications: two columns of equal width, which is what
                  `homogeneous` gives whatever the labels measure. */}
              <box spacing={8} homogeneous>
                <DoNotDisturb />
                <NightLight />
              </box>
              <Volume onOpen={() => props.setView("audio")} />
              {/* Closing on a notification's own click: what it invoked is
                  coming to the front, and this window covers the whole
                  output. */}
              <Notifications close={props.close} />
            </box>
            <AudioMenu onBack={() => props.setView("main")} />
            <PowerMenu onBack={() => props.setView("main")} onRun={props.close} />
          </stack>
        </revealer>
      </overlay>
    </window>
  )
}
