import { Gtk } from "ags/gtk4"
import { Accessor, createState, onCleanup } from "ags"
import { interval, Timer } from "ags/time"
import Pango from "gi://Pango"
import { hasPlayer, playIcon, playing, trackLabel, trackTooltip } from "../lib/mpris"

// A track's name is as long as the album it came off, and a GTK label asks for
// the whole of it. The design holds the pill to 320px at a 44px bar — 290 at
// this one — and this is what the 14px it is set in comes to inside that, once
// the bars, the glyph and the padding have taken their share. The waybar this
// replaces allowed 40, on a bar with nothing else on that side of the clock.
const TITLE_CHARS = 28

// The design's equalizer: three bars whose heights say something is playing,
// where a static glyph would only say something is loaded.
//
// It is not a CSS animation — GTK4's stylesheet has transitions and no
// keyframes — but the transition is enough: a bar's height is a class, and a
// timer walking the wave below turns each step into a 170ms move. Which is also
// how the design's `animation-play-state: paused` comes out here, since a timer
// that is not running leaves the bars wherever the last step put them.
const EQ_BARS = 3
const EQ_STEP = 170
// Sampled off the design's own 1.1s keyframe, which runs .35 → 1 → .35: six
// steps of 170ms come to 1.02s, and the phase below is its .25s stagger.
const EQ_WAVE = [0, 1, 2, 3, 2, 1]
const EQ_PHASE = 2

function Equalizer() {
  const [step, setStep] = createState(0)
  const live = playing()
  let ticker: Timer | null = null

  // Only while there is something to animate: a bar that is paused is a bar
  // standing still, and a timer running behind a pill nobody is looking at is
  // three CSS transitions a second for nothing.
  const sync = () => {
    if (live.get() && !ticker) ticker = interval(EQ_STEP, () => setStep((n) => n + 1))
    else if (!live.get() && ticker) {
      ticker.cancel()
      ticker = null
    }
  }

  sync()
  onCleanup(live.subscribe(sync))
  onCleanup(() => ticker?.cancel())

  return (
    // The box holds the full height itself, so the pill does not breathe with
    // the tallest bar of the moment.
    <box class="eq" spacing={2} valign={Gtk.Align.CENTER}>
      {Array.from({ length: EQ_BARS }, (_, i) => (
        <box
          class={step.as((n) => `eq-bar level-${EQ_WAVE[(n + i * EQ_PHASE) % EQ_WAVE.length]}`)}
          // Off the bottom, like the design's `transform-origin: bottom`.
          valign={Gtk.Align.END}
        />
      ))}
    </box>
  )
}

// The design's media pill, on the left beside the workspaces: what is playing,
// and a way into everything that can be done to it. The whole pill is the
// button — the glyph at the end is the state and not a second control, since a
// play button that small next to a title reads as part of the label.
export default function Media(props: {
  open: Accessor<boolean>
  onToggle: () => void
}) {
  return (
    <button
      // Lit while the panel it opens is showing, the way the bar's other
      // openers are.
      class={props.open.as((open) => (open ? "media open" : "media"))}
      // Nothing playing anywhere is no pill at all, as with the tray: an empty
      // capsule beside the full ones reads as something that failed to load.
      visible={hasPlayer()}
      tooltipText={trackTooltip()}
      valign={Gtk.Align.CENTER}
      onClicked={props.onToggle}
    >
      <box spacing={9}>
        <Equalizer />
        <label
          class="media-label"
          label={trackLabel()}
          xalign={0}
          maxWidthChars={TITLE_CHARS}
          ellipsize={Pango.EllipsizeMode.END}
        />
        {/* 15, as the bar's other glyphs are: play fills 19.8 units of the 24
            `pixelSize` counts, which draws 12.4px of ink — the same as the
            sliders glyph in the controls pill. */}
        <image class="media-state" iconName={playIcon("fill")} pixelSize={15} />
      </box>
    </button>
  )
}
