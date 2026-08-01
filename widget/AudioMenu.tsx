import { Gtk } from "ags/gtk4"
import { Accessor, For } from "ags"
import Pango from "gi://Pango"
import { Icons } from "../lib/icons"
import {
  isDefaultSpeaker,
  selectSpeaker,
  speakerName,
  speakers,
  volumeStatus,
  type Speaker,
} from "../lib/audio"
import { t } from "../lib/i18n"
import Volume from "./Volume"

// A device's own name is as long as it likes ("Family 17h/19h HD Audio
// Controller Analog Stereo"), and a GTK label asks for the whole of it, which
// the panel's column would then follow.
const NAME_CHARS = 28

// The bare speaker, without the waves the volume ramp puts on the bar and on the
// mute disc: a row here is a device, not a level, and a wave on it would be
// read as one.
//
// The design draws a different glyph per kind of output; this one stands for
// all of them. Wireplumber does name an icon for every endpoint, but it names
// the icon theme's — an Adwaita glyph filling its box beside an SF Symbols one
// that does not, in the same column of a list. What tells the devices apart is
// their names, until there are exports to tell them apart with.
const ICON = Icons.output

function Row(speaker: Speaker) {
  const current = isDefaultSpeaker(speaker)

  return (
    <button
      class={current.as((on) => (on ? "audio-row current" : "audio-row"))}
      onClicked={() => selectSpeaker(speaker)}
    >
      <box spacing={13}>
        {/* 22 rather than 19, for the same reason the mute disc is 23: the
            speaker is 17.1 units tall of the 24 its box counts. */}
        <image class="audio-row-icon" iconName={ICON} pixelSize={22} valign={Gtk.Align.CENTER} />
        <label
          class="audio-row-name"
          label={speakerName(speaker)}
          xalign={0}
          hexpand
          maxWidthChars={NAME_CHARS}
          ellipsize={Pango.EllipsizeMode.END}
          valign={Gtk.Align.CENTER}
        />
        <image
          class="audio-row-check"
          iconName={Icons.check}
          pixelSize={17}
          valign={Gtk.Align.CENTER}
          visible={current}
        />
      </box>
    </button>
  )
}

// The volume menu, in the design's sub-panel shape: the bar again, and under it
// everything that can play the sound it is setting the level of. Picking one
// leaves the menu open — the point of coming here is usually to hear the
// difference, and the volume bar is right above the list.
export default function AudioMenu(props: { visible: Accessor<boolean>; onBack: () => void }) {
  return (
    <box class="panel submenu" orientation={Gtk.Orientation.VERTICAL} visible={props.visible}>
      <box class="submenu-head" spacing={10}>
        <button
          class="icon-button"
          tooltipText={t.back}
          valign={Gtk.Align.CENTER}
          onClicked={props.onBack}
        >
          <image iconName={Icons.back} pixelSize={18} />
        </button>
        <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER}>
          <label class="submenu-title" label={t.audio} xalign={0} />
          <label class="submenu-subtitle" label={volumeStatus()} xalign={0} />
        </box>
      </box>

      <Volume inset />

      <box class="audio-section" spacing={10}>
        <label class="audio-section-label" label={t.audioOutput} />
        {/* The rule runs out rather than reaching the edge, as the design's
            does. It is a background because a border cannot carry a gradient,
            the same way the panel heads above do it. */}
        <box class="audio-section-rule" hexpand valign={Gtk.Align.CENTER} />
      </box>

      <box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
        {/* Keyed by the pipewire id, so a row survives everything but the
            device behind it going away. */}
        <For each={speakers()} id={(speaker) => speaker.id}>
          {(speaker) => Row(speaker)}
        </For>
      </box>
    </box>
  )
}
