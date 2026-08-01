import { Gtk } from "ags/gtk4"
import { Accessor } from "ags"
import { Icons } from "../lib/icons"
import {
  hasAudio,
  level,
  muted,
  setVolume,
  toggleMute,
  volumeIcon,
  volumeStatus,
  volumeStep,
} from "../lib/audio"
import { t } from "../lib/i18n"

// The design's volume bar: a capsule the width of the panel, filled to where the
// volume is, with the mute disc and the type sitting on top of the fill.
//
// The bar itself is a `Gtk.Scale` with everything the theme draws taken off it
// (see style.scss), so the drag, the click-to-position and the scroll are GTK's
// rather than a gesture of ours, and the fill is the scale's own highlight node.
// The type goes over it in an overlay that cannot be targeted — a press
// anywhere along the row still reaches the scale under it — which is also why
// the two buttons are overlay children of their own: a widget that cannot be
// targeted takes its children with it.
export default function Volume(props: {
  visible?: Accessor<boolean>
  // Inside the audio menu the bar is a well in a panel rather than a panel of
  // its own, and there is nothing left for the caret to open.
  inset?: boolean
  onOpen?: () => void
}) {
  // Nothing to show without a sound server: the panel closes the gap rather
  // than offering a bar that cannot move.
  if (!hasAudio()) return <box visible={false} />

  const silent = muted()
  // The menu's own copy is only ever up with the menu around it, so it has
  // nothing to follow — and a GObject property is not given `undefined`.
  const visible = props.visible ?? true

  return (
    <overlay class={props.inset ? "slider-pill inset" : "slider-pill"} visible={visible}>
      <slider
        hexpand
        value={level()}
        min={0}
        max={1}
        step={volumeStep()}
        page={volumeStep() * 2}
        // `change-value` is the user's own: a programmatic move of the value —
        // the one that follows every reading back from wireplumber, and the one
        // muting makes — never comes through here, so the volume behind a muted
        // bar is not written over with the 0 the bar is drawing.
        onChangeValue={(_self, _scroll, value) => {
          setVolume(value)
          return false
        }}
      />

      <box class="slider-face" $type="overlay" canTarget={false}>
        <label class="slider-label" label={t.volume} xalign={0} hexpand />
        <label class="slider-value" label={volumeStatus()} />
      </box>

      <button
        class={silent.as((quiet) => (quiet ? "slider-icon muted" : "slider-icon"))}
        $type="overlay"
        tooltipText={silent.as((quiet) => (quiet ? t.volumeUnmute : t.volumeMute))}
        halign={Gtk.Align.START}
        valign={Gtk.Align.CENTER}
        marginStart={6}
        onClicked={toggleMute}
      >
        {/* 23 and not the 19 the other discs carry: `pixelSize` counts the box
            and the speaker is a wide glyph, so its cone fills 17.1 of the 24 in
            height where the bell fills all of it (measured). At 23 it draws
            16.4px tall in a 36px disc, which is the proportion `.tile-icon`
            has at 20 in 44. */}
        <image iconName={volumeIcon("outline")} pixelSize={23} />
      </button>

      {/* Only under the pointer, as in the design. Both halves of that are the
          stylesheet's: the caret fades in and the value slides over to make
          room, since GTK animates a margin like any other CSS property. */}
      <button
        class="slider-caret"
        $type="overlay"
        visible={!props.inset}
        tooltipText={t.audioOutput}
        halign={Gtk.Align.END}
        valign={Gtk.Align.CENTER}
        marginEnd={14}
        onClicked={() => props.onOpen?.()}
      >
        <image iconName={Icons.forward} pixelSize={15} />
      </button>
    </overlay>
  )
}
