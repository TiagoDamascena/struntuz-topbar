import app from "ags/gtk4/app"
import { Astal, Gdk, Gtk } from "ags/gtk4"
import { Accessor, createComputed, createState, For } from "ags"
import { idle } from "ags/time"
import Pango from "gi://Pango"
import { Icons } from "../lib/icons"
import { notificationActions, timeAgo, toasts, type Notification } from "../lib/notifications"
import { t } from "../lib/i18n"
import NotificationIcon from "./NotificationIcon"

// The design's own geometry: the stack hangs from the same 66px as the control
// centre, 14px in from the right, in a column a little narrower than the panels
// under it.
const TOP = 66
const SIDE = 14
const WIDTH = 436

// Wrapped rather than ellipsized: the body is what a notification is for. Three
// lines is where a card stops being a card.
const BODY_LINES = 3
const BODY_CHARS = 40

function Toast(n: Notification) {
  const actions = notificationActions(n)
  // The card is built before it is shown, then revealed on the next turn of the
  // loop, which is what gives the transition something to animate from.
  const [shown, setShown] = createState(false)
  idle(() => setShown(true))

  return (
    <revealer
      revealChild={shown}
      transitionType={Gtk.RevealerTransitionType.CROSSFADE}
      transitionDuration={220}
    >
      <box class="panel toast" spacing={12}>
        <NotificationIcon notification={n} large />
        <box orientation={Gtk.Orientation.VERTICAL} hexpand>
          <box class="toast-head" spacing={8}>
            <label
              class="toast-app"
              label={n.appName || t.notifications}
              maxWidthChars={BODY_CHARS}
              ellipsize={Pango.EllipsizeMode.END}
            />
            <label class="notification-time" label={timeAgo(n.time)} hexpand xalign={0} />
            <button
              class="icon-button small"
              tooltipText={t.notificationDismiss}
              valign={Gtk.Align.CENTER}
              // Not the same as letting it time out: dismissing is the one the
              // user meant, so the notification leaves the list too.
              onClicked={() => n.dismiss()}
            >
              <image iconName={Icons.close} pixelSize={13} />
            </button>
          </box>
          <label
            class="toast-title"
            label={n.summary}
            xalign={0}
            maxWidthChars={BODY_CHARS}
            ellipsize={Pango.EllipsizeMode.END}
          />
          <label
            class="toast-body"
            label={n.body}
            xalign={0}
            wrap
            wrapMode={Pango.WrapMode.WORD_CHAR}
            lines={BODY_LINES}
            maxWidthChars={BODY_CHARS}
            ellipsize={Pango.EllipsizeMode.END}
            visible={n.body.length > 0}
          />
          <box class="toast-actions" spacing={8} visible={actions.length > 0}>
            {actions.map((action, i) => (
              <button
                class={i === 0 ? "toast-action primary" : "toast-action"}
                onClicked={() => n.invoke(action.id)}
              >
                <label label={action.label} />
              </button>
            ))}
          </box>
        </box>
      </box>
    </revealer>
  )
}

export default function Toasts(props: { gdkmonitor: Gdk.Monitor; hidden: Accessor<boolean> }) {
  const { TOP: ANCHOR_TOP, RIGHT } = Astal.WindowAnchor
  const stack = toasts()

  // The control centre lands on the same corner at the same height, so the two
  // never share the screen: what is on the toast is in the list behind it.
  const visible = createComputed(
    [stack, props.hidden],
    (current, hidden) => current.length > 0 && !hidden,
  )

  return (
    <window
      visible={visible}
      name="struntuz-toasts"
      namespace="struntuz-toasts"
      gdkmonitor={props.gdkmonitor}
      // Sized to its own content and never focused: everything outside the
      // cards belongs to whatever is under them.
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.NONE}
      anchor={ANCHOR_TOP | RIGHT}
      marginTop={TOP}
      marginRight={SIDE}
      application={app}
    >
      <box orientation={Gtk.Orientation.VERTICAL} spacing={10} widthRequest={WIDTH}>
        <For each={stack} id={(n) => n.id}>
          {(n) => Toast(n)}
        </For>
      </box>
    </window>
  )
}
