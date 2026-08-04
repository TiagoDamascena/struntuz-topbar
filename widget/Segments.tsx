import { Gtk } from "ags/gtk4"
import { Accessor, createComputed } from "ags"
import { hasAudio, muted, outputName, volumeIcon } from "../lib/audio"
import { batteryIcon, batteryStatus, isLow, present } from "../lib/battery"
import { hasWifi, wifiIcon, wifiStatus } from "../lib/network"
import { t } from "../lib/i18n"
import type { View } from "./ControlCenter"

// The design's segments: one round button per source the control centre has a
// sub-panel for — audio, Wi-Fi, Bluetooth, battery — each opening the panel
// straight onto its own, and in that order. Audio, Wi-Fi and battery have a
// source in this bar; Bluetooth joins them here when it arrives. The capsule
// around them is `widget/Controls.tsx`, which they share with the
// control-centre toggle.
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

// Wi-Fi, whose glyph is the same ramp the tile's disc wears — how many arcs is
// how strong, and the slash when there is nothing joined. The tooltip is what
// carries the network's name: the segment is a 30px circle, and the design puts
// no type in one.
function Wifi(props: {
  active: Accessor<boolean>
  onToggle: () => void
}) {
  const status = wifiStatus()

  return (
    <button
      class={props.active.as((open) => (open ? "icon-button open" : "icon-button"))}
      tooltipText={status.as((where) => t.wifiTooltip.replace("%s", where.toLowerCase()))}
      valign={Gtk.Align.CENTER}
      onClicked={props.onToggle}
    >
      {/* 17, the speaker's number rather than the sliders' 15: both glyphs are
          wide and short where the rest of the set fills its box in height. The
          arcs measure 18.0 units of 24, so 17 draws them 12.75px tall — between
          the battery's 11.8 and the sliders' 13.9, and on the speaker's 12.1. */}
      <image iconName={wifiIcon()} pixelSize={17} />
    </button>
  )
}

// The battery, which is a readout and not yet a segment. The design's own
// battery segment opens a Power profile sub-panel, and there is none here to
// open — so it is a glyph with a tooltip rather than a button promising a click
// that goes nowhere. It carries a segment's footprint all the same, so the
// row's spacing and the concentricity with the pill's cap already hold when the
// sub-panel arrives and this becomes an `.icon-button` like its neighbour.
//
// `visible` and not an early return, unlike audio's: a battery can be absent as
// a reading rather than as a missing library, and an invisible child takes its
// spacing with it, so a desktop pays nothing for this being here.
function Battery() {
  return (
    <image
      class={isLow().as((low) => (low ? "segment-readout low" : "segment-readout"))}
      iconName={batteryIcon()}
      tooltipText={batteryStatus()}
      visible={present()}
      valign={Gtk.Align.CENTER}
      // The largest `pixelSize` in the bar, and measured rather than picked.
      // The battery is the set's most extreme wide-and-short glyph — 23.3 units
      // across by 10.9 tall, where the speaker's cone is 17.1 — and `pixelSize`
      // counts the box, so the number has to climb for the ink to arrive at all.
      // It is set from the ink *height* and not the width, which is the whole
      // difficulty with a glyph this flat: matched on width the battery sits a
      // third shorter than everything beside it and reads as the runt of the
      // pill, which is what 22 did. 26 draws 25.2×11.8px, putting its height on
      // the speaker cone's 12.1 and the sliders' 13.9 — so it stops reading as
      // low — while staying inside the 30px box. 28 is the ceiling: past it the
      // casing reaches the box edge and the battery takes the row over.
      pixelSize={26}
    />
  )
}

export default function Segments(props: {
  open: Accessor<boolean>
  view: Accessor<View>
  onOpen: (view: View) => void
  onClose: () => void
}) {
  const showing = (view: View) =>
    createComputed(() => props.open() && props.view() === view)

  const audio = showing("audio")
  // The password panel is the Wi-Fi menu one step further in, so the segment
  // stays lit across it: what it opened is still what is on screen.
  const wifi = createComputed(
    () => props.open() && (props.view() === "wifi" || props.view() === "wifi-join"),
  )

  return (
    <box spacing={2} valign={Gtk.Align.CENTER}>
      {/* Nothing to segment without a sound server, and nothing without a
          wireless card either. The pill stays either way now that the toggle is
          in it, so what goes is only the segment. */}
      {hasAudio() ? (
        <Audio
          active={audio}
          // A second press on a lit segment closes the panel, as in the design:
          // the segment is the panel's own switch, not just a way in.
          onToggle={() => (audio.get() ? props.onClose() : props.onOpen("audio"))}
        />
      ) : (
        <box visible={false} />
      )}
      {hasWifi() ? (
        <Wifi
          active={wifi}
          onToggle={() => (wifi.get() ? props.onClose() : props.onOpen("wifi"))}
        />
      ) : (
        <box visible={false} />
      )}
      <Battery />
    </box>
  )
}
