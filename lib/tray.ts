import { Accessor, createBinding, createComputed } from "ags"
import AstalTray from "gi://AstalTray"
import Gio from "gi://Gio"

export type Item = AstalTray.TrayItem

// Not the exclusive claim the notification daemon is: astal takes
// `org.kde.StatusNotifierWatcher` when the name is free and proxies whoever
// holds it otherwise (`tray/src/tray.vala`), so a watcher another bar is
// running hands its items over here as well and both draw them. What a foreign
// watcher decides is whether an application registers at all — the ones that
// wait for a host to be registered are its business, not this bar's.
function tray(): AstalTray.Tray {
  return AstalTray.get_default()
}

// What is in the tray, in an order that holds still. Astal keeps the items in a
// hash table, as notifd keeps its notifications, so the list it hands back is in
// no order at all and the icons would reshuffle every time one arrived; the item
// id is the sender's bus name and object path, unique and fixed for as long as
// the application is there.
//
// `PASSIVE` is left out because that is what the status means: the application
// is registered and asking not to be shown. It is read through a binding of its
// own rather than off the item, since the tray notifies `items` when one arrives
// and departs and never when one of them changes its mind.
export function trayItems(): Accessor<Item[]> {
  const registered = createBinding(tray(), "items")

  return createComputed(() => {
    const shown = [...registered()].filter(
      (item) => createBinding(item, "status")() !== AstalTray.Status.PASSIVE,
    )
    return shown.sort((a, b) => a.itemId.localeCompare(b.itemId))
  })
}

// The application's own icon, whether it named one from a theme, shipped a
// directory to look it up in, or sent the pixels over the bus: astal unifies the
// three into this one property, and it is the only one that carries all of them.
export function itemIcon(item: Item): Accessor<Gio.Icon> {
  return createBinding(item, "gicon")
}

// An application asking to be noticed. It has an attention icon of its own in
// the spec, which astal already swaps into `gicon`, so what is left for the bar
// is to stop dimming it.
export function needsAttention(item: Item): Accessor<boolean> {
  return createBinding(item, "status").as(
    (status) => status === AstalTray.Status.NEEDS_ATTENTION,
  )
}

// Whose icon it is. The tooltip is the application's own text and often empty,
// in which case the title is what it went by when it registered; the id is the
// last resort, so an icon in the bar is never a shape with nothing to say.
export function itemTooltip(item: Item): Accessor<string> {
  const tooltip = createBinding(item, "tooltipText")
  const title = createBinding(item, "title")
  return createComputed(() => tooltip() || title() || item.id)
}

// Whether the primary click belongs to the menu. The spec's `ItemIsMenu` says
// the application has only the menu and no `Activate` worth sending, and astal
// defaults it to true rather than false — which is the appindicator reality it
// defaults to, since an appindicator item is a menu and nothing besides. So a
// bar that ignores it clicks into nothing on most of what it shows.
export function opensMenu(item: Item): boolean {
  return item.isMenu && item.menuModel !== null
}

// Telling the application it is about to be asked for its menu, so the one that
// rebuilds it per opening — a device list, a queue — has the chance to. Astal
// calls the sender synchronously and swallows what it answers.
export function aboutToShowMenu(item: Item): void {
  item.about_to_show()
}

// The spec's x and y are where on the screen the click landed, for an
// application that wants to put something there. They are 0 here: a Wayland
// client cannot place its own window anyway, and a layer surface has no screen
// coordinates of its own to hand over.
export function activateItem(item: Item): void {
  item.activate(0, 0)
}

// The spec's other click. It is what an application with only a menu tends to
// put its own primary action on, which is why a middle click reaches it here.
export function secondaryActivateItem(item: Item): void {
  item.secondary_activate(0, 0)
}
