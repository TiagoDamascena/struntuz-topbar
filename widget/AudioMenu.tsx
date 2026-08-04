import { Gtk } from "ags/gtk4"
import { For } from "ags"
import Pango from "gi://Pango"
import { Icons, VolumeIcons } from "../lib/icons"
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
const NAME_CHARS = 26

// The speaker at the top of the ramp, not the bare one. A row is a device
// rather than a level, so it carries no level of its own — and read that way
// the bare cone is the glyph for something silent, which is the one thing a
// device in this list never is.
//
// The design draws a different glyph per kind of output; this one stands for
// all of them. Wireplumber does name an icon for every endpoint, but it names
// the icon theme's — an Adwaita glyph filling its box beside an SF Symbols one
// that does not, in the same column of a list. What tells the devices apart is
// their names, until there are exports to tell them apart with.
const ICON = VolumeIcons.outline.high

function Row(speaker: Speaker) {
  const current = isDefaultSpeaker(speaker)

  return (
    <button
      class={current.as((on) => (on ? "menu-row current" : "menu-row"))}
      onClicked={() => selectSpeaker(speaker)}
    >
      <box spacing={11}>
        {/* 18 rather than the 17 the power rows take, for the same reason the
            mute disc is 20: the cone is 17.1 units tall of the 24 its box
            counts, and it is the cone that has to line up down the column —
            what `high` adds reaches past it on both axes. */}
        <image class="menu-row-icon" iconName={ICON} pixelSize={18} valign={Gtk.Align.CENTER} />
        <label
          class="menu-row-name"
          label={speakerName(speaker)}
          xalign={0}
          hexpand
          maxWidthChars={NAME_CHARS}
          ellipsize={Pango.EllipsizeMode.END}
          valign={Gtk.Align.CENTER}
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

// The volume menu, in the design's sub-panel shape: the bar again, and under it
// everything that can play the sound it is setting the level of. Picking one
// leaves the menu open — the point of coming here is usually to hear the
// difference, and the volume bar is right above the list.
// The page it is in the control centre's stack goes here rather than at the
// call site: `$type` reaches the parent from the widget it made, and the name
// beside it is what the stack adds it under.
export default function AudioMenu(props: { onBack: () => void }) {
  return (
    <box
      $type="named"
      name="audio"
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
        <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER}>
          <label class="submenu-title" label={t.audio} xalign={0} />
          <label class="submenu-subtitle" label={volumeStatus()} xalign={0} />
        </box>
      </box>

      <Volume inset />

      <box class="audio-section" spacing={9}>
        <label class="audio-section-label" label={t.audioOutput} />
        {/* The same rule the panel heads carry — one `@include rule` in the
            stylesheet, so there is no second line to drift from the first. */}
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
