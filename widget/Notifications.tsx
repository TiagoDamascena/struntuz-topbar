import { Gtk } from "ags/gtk4"
import { Accessor, For } from "ags"
import Pango from "gi://Pango"
import { Icons } from "../lib/icons"
import { activate, dismissAll, notifications, timeAgo, type Notification } from "../lib/notifications"
import { t } from "../lib/i18n"
import NotificationIcon from "./NotificationIcon"

// The list scrolls rather than growing: the panel hangs from the top of the
// screen, and a day of notifications would otherwise run off the bottom of it.
const MAX_HEIGHT = 420

// Long enough for a title to read as a title, short enough that its natural
// width never widens the panel — a GTK label asks for the whole string
// otherwise, and the column would follow it.
const TITLE_CHARS = 30

function Row(n: Notification, close: () => void) {
  return (
    <box class="notification-row" spacing={12}>
      {/* On the whole row, buttons and all: a GTK4 button claims the sequence,
          which stops it before it bubbles up to here, so the ✕ still only
          dismisses. */}
      <Gtk.GestureClick
        onReleased={() => {
          if (activate(n)) close()
        }}
      />
      <NotificationIcon notification={n} />
      <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER} hexpand>
        <label
          class="notification-title"
          label={n.summary}
          xalign={0}
          maxWidthChars={TITLE_CHARS}
          ellipsize={Pango.EllipsizeMode.END}
        />
        <label
          class="notification-body"
          label={n.body}
          xalign={0}
          maxWidthChars={TITLE_CHARS}
          ellipsize={Pango.EllipsizeMode.END}
          visible={n.body.length > 0}
        />
      </box>
      <label class="notification-time" label={timeAgo(n.time)} valign={Gtk.Align.CENTER} />
      <button
        class="icon-button tiny"
        tooltipText={t.notificationDismiss}
        valign={Gtk.Align.CENTER}
        onClicked={() => n.dismiss()}
      >
        <image iconName={Icons.close} pixelSize={13} />
      </button>
    </box>
  )
}

export default function Notifications(props: { visible: Accessor<boolean>; close: () => void }) {
  const list = notifications()
  const any = list.as((current) => current.length > 0)

  return (
    <box class="panel notifications" orientation={Gtk.Orientation.VERTICAL} visible={props.visible}>
      <box class="notifications-head" spacing={9}>
        <image class="notifications-head-icon" iconName={Icons.notification} pixelSize={16} />
        <label class="notifications-head-label" label={t.notifications} />
        <label
          class="notifications-count"
          label={list.as((current) => String(current.length))}
          hexpand
          xalign={0}
          visible={any}
        />
        <button class="notifications-clear" visible={any} onClicked={dismissAll}>
          <label label={t.notificationsClear} />
        </button>
      </box>

      {/* The list goes in through the `child` property, not as a JSX child: a
          scrolled window is not a container, and the generic child path parents
          the box to it without telling it, which leaves the whole column
          unallocated and invisible. */}
      <scrolledwindow
        hscrollbarPolicy={Gtk.PolicyType.NEVER}
        propagateNaturalHeight
        maxContentHeight={MAX_HEIGHT}
        visible={any}
        child={
          (
            <box orientation={Gtk.Orientation.VERTICAL}>
              {/* Keyed by the daemon's own id, so a row is rebuilt only when
                  the notification behind it is. */}
              <For each={list} id={(n) => n.id}>
                {(n) => Row(n, props.close)}
              </For>
            </box>
          ) as Gtk.Widget
        }
      />

      <box
        class="notifications-empty"
        spacing={10}
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}
        visible={any.as((some) => !some)}
        vexpand
      >
        <image iconName={Icons.notification} pixelSize={19} />
        <label label={t.notificationsEmpty} />
      </box>
    </box>
  )
}
