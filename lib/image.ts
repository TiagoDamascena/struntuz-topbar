import { Gdk } from "ags/gtk4"
import GdkPixbuf from "gi://GdkPixbuf"

// The crop every round picture in the bar needs. A `Gtk.Image` scales a
// paintable to *fit*, so anything but a square letterboxes inside the circle the
// radius cuts: the disc comes out a band of picture across an empty round box,
// which reads as anything but round. Cutting the centred square here is what
// makes the clip a circle, whatever shape the file arrived in.
//
// `size` is in logical pixels; the texture is cut at twice that, so it still has
// pixels to give on a scaled display without carrying a whole portrait around.
export function squareTexture(path: string, size: number): Gdk.Texture | null {
  try {
    const picture = GdkPixbuf.Pixbuf.new_from_file(path)
    const side = Math.min(picture.get_width(), picture.get_height())
    const square = picture.new_subpixbuf(
      Math.floor((picture.get_width() - side) / 2),
      Math.floor((picture.get_height() - side) / 2),
      side,
      side,
    )
    // Never upscale past the source: an app icon arrives at 32px or less and
    // bilinear only smears it, where GTK's own draw-time scaling costs nothing.
    const to = Math.min(size * 2, side)
    const scaled = square.scale_simple(to, to, GdkPixbuf.InterpType.BILINEAR)
    return scaled && Gdk.Texture.new_for_pixbuf(scaled)
  } catch (err) {
    // Never worth losing the widget over: both callers have a fallback.
    console.warn(`struntuz-topbar: ignoring image at ${path}: ${err}`)
    return null
  }
}
