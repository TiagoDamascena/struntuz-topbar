import { Gtk } from "ags/gtk4"
import { Accessor, createComputed } from "ags"
import { hasAudio, muted, outputName, volumeIcon } from "../lib/audio"
import { t } from "../lib/i18n"
import type { View } from "./ControlCenter"

// The design's segments pill: one round button per source the control centre
// has a sub-panel for — audio, Wi-Fi, Bluetooth, battery — each opening the
// panel straight onto its own. Only audio has a source in this bar, so the
// pill holds one; the others join it here when they arrive.
//
// Filled glyphs, unlike the panels' outlines: a bar pill is the smaller, busier
// surface of the two.
function Audio(props: {
  active: Accessor<boolean>
  onToggle: () => void
}) {
  const silent = muted()
  const output = outputName()
  const tooltip = createComputed(() =>
    t.audioTooltip.replace("%s", silent() ? t.volumeMuted.toLowerCase() : output()),
  )

  return (
    <button
      class={props.active.as((open) => (open ? "icon-button open" : "icon-button"))}
      tooltipText={tooltip}
      valign={Gtk.Align.CENTER}
      onClicked={props.onToggle}
    >
      {/* 22 and not the bar's usual 19: the speaker's cone is 17.1 units tall
          of the 24 `pixelSize` counts, where the sliders glyph beside it fills
          22.2. At 22 it draws 15.7px tall, which is what the design's own 19px
          speaker measures. */}
      <image iconName={volumeIcon("fill")} pixelSize={22} />
    </button>
  )
}

export default function Segments(props: {
  open: Accessor<boolean>
  view: Accessor<View>
  onOpen: (view: View) => void
  onClose: () => void
}) {
  // Nothing to segment without a sound server, and an empty pill is still a
  // pill: the whole thing goes rather than sitting there hollow.
  if (!hasAudio()) return <box visible={false} />

  const showing = (view: View) =>
    createComputed(() => props.open() && props.view() === view)

  const audio = showing("audio")

  return (
    <box class="pill icon-pill" spacing={2} valign={Gtk.Align.CENTER}>
      <Audio
        active={audio}
        // A second press on a lit segment closes the panel, as in the design:
        // the segment is the panel's own switch, not just a way in.
        onToggle={() => (audio.get() ? props.onClose() : props.onOpen("audio"))}
      />
    </box>
  )
}
