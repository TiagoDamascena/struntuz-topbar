import app from "ags/gtk4/app"
import { Astal, Gdk, Gtk } from "ags/gtk4"
import { Accessor, createState } from "ags"
import { Icons } from "../lib/icons"
import { batteryStatus, userAvatar, userInitial, userName } from "../lib/session"
import { t } from "../lib/i18n"
import PowerMenu from "./PowerMenu"

// The design's own geometry: the panel hangs 66px below the top of the screen,
// 14px in from the right, in a 452px column. Measured from the top of the
// output, not from under the bar — the window ignores exclusive zones.
const PANEL_TOP = 66
const PANEL_SIDE = 14
const PANEL_WIDTH = 452
const AVATAR = 42

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

function UserPill(props: { visible: Accessor<boolean>; onPower: () => void }) {
  return (
    <box class="panel user" spacing={12} visible={props.visible}>
      <Avatar />
      <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER} hexpand>
        <label class="user-name" label={userName()} xalign={0} />
        <label class="user-status" label={batteryStatus()} xalign={0} />
      </box>
      <button
        class="icon-button large"
        tooltipText={t.power}
        valign={Gtk.Align.CENTER}
        onClicked={props.onPower}
      >
        <image iconName={Icons.power} pixelSize={20} />
      </button>
    </box>
  )
}

export default function ControlCenter(props: {
  gdkmonitor: Gdk.Monitor
  open: Accessor<boolean>
  close: () => void
}) {
  const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor
  const [menu, setMenu] = createState(false)

  // The power menu replaces the main view rather than stacking under it, as in
  // the design, so the two are one choice.
  const main = menu.as((open) => !open)

  function dismiss() {
    setMenu(false)
    props.close()
  }

  return (
    <window
      visible={props.open}
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
          dismiss()
          return true
        }}
      />
      <overlay>
        <box>
          <Gtk.GestureClick onPressed={dismiss} />
        </box>
        <box
          $type="overlay"
          orientation={Gtk.Orientation.VERTICAL}
          spacing={10}
          widthRequest={PANEL_WIDTH}
          halign={Gtk.Align.END}
          valign={Gtk.Align.START}
          marginTop={PANEL_TOP}
          marginEnd={PANEL_SIDE}
        >
          <UserPill visible={main} onPower={() => setMenu(true)} />
          <PowerMenu visible={menu} onBack={() => setMenu(false)} onRun={dismiss} />
        </box>
      </overlay>
    </window>
  )
}
