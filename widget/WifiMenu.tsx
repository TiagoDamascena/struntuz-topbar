import { Gtk } from "ags/gtk4"
import { Accessor, For, createComputed } from "ags"
import Pango from "gi://Pango"
import { Icons, WifiIcons } from "../lib/icons"
import {
  beginJoin,
  connect,
  enabled,
  isActive,
  isKnown,
  networkStatus,
  networks,
  scanning,
  setEnabled,
  signalIcon,
  wifiStatus,
  type Network,
} from "../lib/network"
import { t } from "../lib/i18n"

const NAME_CHARS = 24

// Six rows and a half, which is where the panel stops growing and starts
// scrolling. A list of networks has no length of its own — a flat in a city
// sees thirty — and the window under this one is the whole output, so nothing
// else would stop it.
const MAX_HEIGHT = 320

// A network. The same row the audio menu's devices are, plus a second line and
// a padlock: what tells two networks apart is not only their names.
//
// It takes the name and reads the rest back out of the list, rather than
// closing over the network it was built from. `For` keeps a row for as long as
// its key is in the list and never re-renders it, so a captured record would be
// the one this row was first built with — the strength frozen at whatever it
// was when the panel opened, and the padlock still there on a network that has
// since been saved.
function Row(ssid: string, list: Accessor<Network[]>, onJoin: () => void) {
  const net = list.as((all) => all.find((n) => n.ssid === ssid) ?? null)
  const current = isActive(ssid)

  return (
    <button
      class={current.as((on) => (on ? "menu-row current" : "menu-row"))}
      onClicked={() => {
        const target = net.get()
        if (!target) return
        // Already on it: the row is where the tick is, not a way to join the
        // network twice. Leaving is the switch above, as in the design.
        if (current.get()) return
        // An open network and a saved one need nothing typed, so the click is
        // the whole of it; anything else is a password panel.
        if (isKnown(target)) connect(target, null)
        else {
          beginJoin(target)
          onJoin()
        }
      }}
    >
      <box spacing={11}>
        {/* 17 against the audio rows' 18, which lands both at the same ink:
            the arcs fill 18.0 units of 24 where the speaker's cone fills 17.1,
            so 17 here draws 12.75px tall against 12.8 there. It is the glyph
            and not the box that has to line up down a column. */}
        <image
          class="menu-row-icon"
          iconName={net.as((n) => (n ? signalIcon(n.strength) : WifiIcons.off))}
          pixelSize={17}
          valign={Gtk.Align.CENTER}
        />
        <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER} hexpand>
          <label
            class="menu-row-name"
            label={ssid}
            xalign={0}
            maxWidthChars={NAME_CHARS}
            ellipsize={Pango.EllipsizeMode.END}
          />
          <label
            class="menu-row-meta"
            label={createComputed(() => {
              const n = net()
              return n ? networkStatus(n, current()) : ""
            })}
            xalign={0}
          />
        </box>
        {/* Off the connected row: it has the tick, and the two shapes side by
            side read as two states rather than as one network. */}
        <image
          class="menu-row-lock"
          iconName={Icons.lock}
          pixelSize={13}
          valign={Gtk.Align.CENTER}
          visible={createComputed(() => {
            const n = net()
            return n !== null && n.secured && !current()
          })}
        />
        <image
          class="menu-row-check"
          iconName={Icons.check}
          pixelSize={15}
          valign={Gtk.Align.CENTER}
          visible={current}
        />
      </box>
    </button>
  )
}

// The Wi-Fi menu, in the design's sub-panel shape: the head carries the switch
// for the radio, and under it is everything the card can hear. Picking one
// leaves the menu open, as the audio menu's rows do — a join takes a few
// seconds to land, and the row is where it says it has.
export default function WifiMenu(props: { onBack: () => void; onJoin: () => void }) {
  const on = enabled()
  const list = networks()
  const looking = scanning()
  const empty = list.as((current) => current.length === 0)

  return (
    <box
      $type="named"
      name="wifi"
      class="panel submenu"
      orientation={Gtk.Orientation.VERTICAL}
      valign={Gtk.Align.START}
    >
      <box class="submenu-head" spacing={9}>
        <button
          class="icon-button"
          tooltipText={t.back}
          valign={Gtk.Align.CENTER}
          onClicked={props.onBack}
        >
          <image iconName={Icons.back} pixelSize={16} />
        </button>
        <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER} hexpand>
          <label class="submenu-title" label={t.wifi} xalign={0} />
          <label
            class="submenu-subtitle"
            label={wifiStatus()}
            xalign={0}
            maxWidthChars={NAME_CHARS}
            ellipsize={Pango.EllipsizeMode.END}
          />
        </box>
        {/* The design's own switch, and the one control in the bar that is a
            GTK widget rather than a shape of ours. `notify::active` fires for a
            programmatic move as well as for a click — the same trap
            `change-value` avoids on the volume bar — so the write only happens
            when the switch and the radio actually disagree. */}
        <switch
          class="wifi-switch"
          active={on}
          valign={Gtk.Align.CENTER}
          tooltipText={on.as((up) => (up ? t.wifiDisable : t.wifiEnable))}
          onNotifyActive={(self) => {
            if (self.active !== on.get()) setEnabled(self.active)
          }}
        />
      </box>

      {/* Through `child` and not as a JSX child: a scrolled window is a bin,
          and the generic path parents the box without telling it — the column
          then measures as nothing and the list is invisible. */}
      <scrolledwindow
        hscrollbarPolicy={Gtk.PolicyType.NEVER}
        propagateNaturalHeight
        maxContentHeight={MAX_HEIGHT}
        visible={empty.as((none) => !none)}
        child={
          (
            <box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
              {/* Keyed by name, which is what the list holds one of each. Safe
                  to keep a row across a change now that a row is built on plain
                  data: it was not while rows held access points, since astal
                  keys those by BSSID and a network whose strongest radio
                  changes is a remove and an add. */}
              <For each={list} id={(net) => net.ssid}>
                {(net) => Row(net.ssid, list, props.onJoin)}
              </For>
            </box>
          ) as Gtk.Widget
        }
      />

      {/* Three things an empty list can mean, and the radio being off is the
          one with something to do about it — so it wears the slash the tile
          does rather than the ramp. */}
      <box
        class="menu-empty"
        spacing={9}
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}
        visible={empty}
      >
        <image iconName={on.as((up) => (up ? WifiIcons.high : WifiIcons.off))} pixelSize={17} />
        <label
          label={createComputed(() => {
            if (!on()) return t.wifiOff
            return looking() ? t.wifiScanning : t.wifiEmpty
          })}
        />
      </box>
    </box>
  )
}
