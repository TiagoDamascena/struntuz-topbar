import { Gdk, Gtk } from "ags/gtk4"
import { For, onCleanup } from "ags"
import {
  aboutToShowMenu,
  activateItem,
  itemIcon,
  itemTooltip,
  needsAttention,
  opensMenu,
  secondaryActivateItem,
  trayItems,
  type Item,
} from "../lib/tray"
import { PANEL_GAP } from "../lib/layout"

// `pixelSize` counts the box and not the glyph, and this is the one place in the
// bar where the box is not the bar's own: the set in `icons/` fills 22–24 units
// of its 24 and is drawn at 15, while an application's icon fills its box the
// way its theme does — most of it. So the number is stepped off the ink instead,
// to land near the ~14px the bar's other glyphs draw rather than 2px over them.
const ICON_SIZE = 16

// The item's menu and the clicks that reach it, both by hand.
//
// The menu because a `Gtk.PopoverMenu` is not a child of the widget it belongs
// to: it is parented to it and has to be unparented again, and its model is the
// application's to replace at any point. The clicks because the tray answers
// three buttons and a `Gtk.Button` handles the primary one itself and claims the
// gesture sequence, so the other two would never arrive.
function install(anchor: Gtk.Widget, item: Item): void {
  const menu = Gtk.PopoverMenu.new_from_model(null)
  menu.set_parent(anchor)
  // Under the glyph rather than pointing at it: there is nothing above the bar
  // for an arrow to come out of, and the pill is the shape the menu hangs from.
  menu.set_position(Gtk.PositionType.BOTTOM)
  menu.set_has_arrow(false)
  // The same gap the control centre leaves under the bar, so the two land on one
  // line however they were opened. GTK hangs a popover off its anchor's own
  // bottom edge, which is why the box below fills the pill's height rather than
  // the glyph's: the distance is then the bar's and not the icon size's.
  menu.set_offset(0, PANEL_GAP)
  menu.add_css_class("tray-menu")

  // The actions carry a `dbusmenu` prefix and have to be inserted on a parent of
  // the menu, which the popover is of its own contents.
  const sync = () => {
    menu.set_menu_model(item.menuModel)
    menu.insert_action_group("dbusmenu", item.actionGroup)
  }

  sync()
  const handlers = [
    item.connect("notify::menu-model", sync),
    item.connect("notify::action-group", sync),
  ]

  const popup = () => {
    aboutToShowMenu(item)
    menu.popup()
  }

  const click = new Gtk.GestureClick({ button: 0 })
  click.connect("pressed", () => {
    switch (click.get_current_button()) {
      case Gdk.BUTTON_PRIMARY:
        // An application that says it has only a menu gets the menu; one that
        // has an action gets the action, which is what raises its window.
        if (opensMenu(item)) popup()
        else activateItem(item)
        break
      case Gdk.BUTTON_MIDDLE:
        secondaryActivateItem(item)
        break
      case Gdk.BUTTON_SECONDARY:
        // The menu is the right click's everywhere else in the desktop, so an
        // item without one falls back to the spec's other action rather than to
        // nothing at all.
        if (menu.get_menu_model()) popup()
        else secondaryActivateItem(item)
        break
    }
  })
  anchor.add_controller(click)

  // `For` disposes the item's scope when the application goes away, and leaves
  // the widget itself to be dropped — so this is where the popover comes off,
  // GTK having nothing else to tell it that its anchor is on the way out.
  onCleanup(() => {
    for (const id of handlers) item.disconnect(id)
    menu.unparent()
  })
}

// A box and not a button, per the design: the tray is bare glyphs in a pill,
// with no disc under them for a click to light up (see style.scss).
function TrayIcon(item: Item) {
  return (
    <box
      class={needsAttention(item).as((loud) => (loud ? "tray-item attention" : "tray-item"))}
      tooltipText={itemTooltip(item)}
      // The pill's whole height, not the glyph's: it is what the menu hangs off
      // (see `install`), and a taller press target for a 16px icon besides.
      valign={Gtk.Align.FILL}
      $={(self) => install(self, item)}
    >
      <image gicon={itemIcon(item)} pixelSize={ICON_SIZE} valign={Gtk.Align.CENTER} />
    </box>
  )
}

// The design's tray: one pill holding a glyph per application, wider apart than
// anything else in the bar.
export default function Tray() {
  const items = trayItems()

  return (
    <box
      class="pill tray"
      // An empty capsule beside the full ones would read as something that
      // failed to load. The design says the same thing with an opacity over the
      // whole strip.
      visible={items.as((list) => list.length > 0)}
      // The gap between two glyphs, which comes out 14 of ink either way — as
      // wide as what the padding leaves at the ends.
      spacing={12}
      valign={Gtk.Align.CENTER}
    >
      {/* Keyed by bus name and object path, so a glyph survives everything but
          the application behind it quitting. */}
      <For each={items} id={(item) => item.itemId}>
        {(item) => TrayIcon(item)}
      </For>
    </box>
  )
}
