import { Gtk } from "ags/gtk4"
import { Accessor, createComputed } from "ags"
import { hasAudio, muted, outputName, volumeIcon } from "../lib/audio"
import { t } from "../lib/i18n"
import type { View } from "./ControlCenter"

// The design's segments: one round button per source the control centre has a
// sub-panel for — audio, Wi-Fi, Bluetooth, battery — each opening the panel
// straight onto its own. Only audio has a source in this bar, so there is one;
// the others join it here when they arrive. The capsule around them is
// `widget/Controls.tsx`, which they share with the control-centre toggle.
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
      {/* 17 and not the bar's usual 15: the speaker's cone is 17.1 units tall
          of the 24 `pixelSize` counts, where the sliders glyph beside it fills
          22.2. At 17 it draws 12.1px tall, the same share of the 26px button
          that the sliders take at 15. */}
      <image iconName={volumeIcon("fill")} pixelSize={17} />
    </button>
  )
}

export default function Segments(props: {
  open: Accessor<boolean>
  view: Accessor<View>
  onOpen: (view: View) => void
  onClose: () => void
}) {
  // Nothing to segment without a sound server. The pill stays either way now
  // that the toggle is in it, so what goes is only this.
  if (!hasAudio()) return <box visible={false} />

  const showing = (view: View) =>
    createComputed(() => props.open() && props.view() === view)

  const audio = showing("audio")

  return (
    <box spacing={2} valign={Gtk.Align.CENTER}>
      <Audio
        active={audio}
        // A second press on a lit segment closes the panel, as in the design:
        // the segment is the panel's own switch, not just a way in.
        onToggle={() => (audio.get() ? props.onClose() : props.onOpen("audio"))}
      />
    </box>
  )
}
