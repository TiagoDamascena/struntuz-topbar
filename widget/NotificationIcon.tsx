import { Gtk } from "ags/gtk4"
import { hasIcon, Icons } from "../lib/icons"
import { squareTexture } from "../lib/image"
import { notificationIconName, notificationImage, type Notification } from "../lib/notifications"

// The design draws the disc at two sizes: 40px on a toast, which is a card of
// its own, and 34px on a list row, where it sits beside two lines of type.
const SIZE = { disc: 34, glyph: 17 }
const LARGE = { disc: 40, glyph: 19 }

// The disc a notification wears. Three sources, in the order of how much they
// say: the picture the sender sent, its own icon, then the bar's bell — every
// notification gets a shape, so the rows line up as one column whatever the
// sender offered.
export default function NotificationIcon(props: {
  notification: Notification
  large?: boolean
}) {
  const { disc, glyph } = props.large ? LARGE : SIZE
  const path = notificationImage(props.notification)
  // Cropped square before it reaches the widget, like the avatar: a sender's
  // screenshot or album art is any shape it likes, and a `Gtk.Image` fits a
  // paintable into its box rather than filling it, which leaves the disc a strip
  // of picture on nothing instead of a circle. An unreadable file falls through
  // to the icon below.
  const picture = path ? squareTexture(path, disc) : null
  // A toast is a paragraph tall, so its disc rides at the top of the card; a
  // list row is one line of type and centres.
  const align = props.large ? Gtk.Align.START : Gtk.Align.CENTER

  // Same trick as the avatar: `overflow` is what makes GTK4 clip a picture to
  // the rounded box the CSS gives it, and `pixelSize` is what keeps the image's
  // own dimensions from setting the row's width.
  if (picture) {
    return (
      <image
        class={props.large ? "notification-icon picture large" : "notification-icon picture"}
        paintable={picture}
        pixelSize={disc}
        overflow={Gtk.Overflow.HIDDEN}
        valign={align}
      />
    )
  }

  const name = notificationIconName(props.notification)

  return (
    <image
      class={props.large ? "notification-icon large" : "notification-icon"}
      iconName={name && hasIcon(name) ? name : Icons.notification}
      pixelSize={glyph}
      valign={align}
    />
  )
}
