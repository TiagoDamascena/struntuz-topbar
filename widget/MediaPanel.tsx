import app from "ags/gtk4/app"
import { Astal, Gdk, Gtk } from "ags/gtk4"
import { Accessor, createComputed, createState, For, onCleanup } from "ags"
import { idle, timeout, Timer } from "ags/time"
import Pango from "gi://Pango"
import { Icons } from "../lib/icons"
import { squareTexture } from "../lib/image"
import {
  activePlayerName,
  canGoNext,
  canGoPrevious,
  canRaise,
  canSeek,
  cycleLoop,
  hasProgress,
  isActivePlayer,
  loopLabel,
  loopOn,
  loopSupported,
  nextTrack,
  playIcon,
  playLabel,
  playPause,
  playerName,
  playerTrack,
  players,
  positionLabel,
  previousTrack,
  raisePlayer,
  remainingLabel,
  seek,
  selectPlayer,
  shuffleOn,
  shuffleSupported,
  toggleShuffle,
  trackAlbum,
  trackArtist,
  trackCover,
  trackLabel,
  trackLength,
  trackPosition,
  type Player,
} from "../lib/mpris"
import { t } from "../lib/i18n"
import { PANEL_SIDE, PANEL_TOP } from "../lib/layout"

// The design's 438 at the control centre's own step down from 452, so the two
// panels keep the width relationship the design drew them with.
const PANEL_WIDTH = 388
const ART = 84

// The same reveal the control centre runs, mirrored: this one hangs off the
// left of the bar, so what its transition moves is the right edge.
const REVEAL_MS = 220

// How far a scroll or an arrow key moves the playhead, in seconds. Not in the
// config: it is a gesture on a line whose length is the track's, where the
// volume's step is a share of a fixed scale.
const SEEK_STEP = 5

// A track's name is as long as the album it came off, and a GTK label asks for
// the whole of it — which the panel's column would then follow.
const LINE_CHARS = 30

// The album art, cropped square before it reaches the widget: a `Gtk.Image`
// scales a paintable to *fit*, so a rectangular cover would letterbox inside
// the rounded square rather than fill it. `createComputed` and not `as` — the
// transform behind an `as` runs on every read, and this one decodes a file.
function Cover() {
  const path = trackCover()
  const cover = createComputed(() => (path() ? squareTexture(path(), ART) : null))

  return (
    // The tint under it is what a track with no art wears, so the head keeps
    // its shape whether or not the player published a cover. `overflow` is what
    // rounds the picture off: in GTK4 a border-radius clips the background and
    // not the content until the widget is told to hide what falls outside it.
    <box class="media-art" overflow={Gtk.Overflow.HIDDEN} valign={Gtk.Align.START}>
      <image
        pixelSize={ART}
        visible={cover.as((texture) => texture !== null)}
        // Not the `paintable` prop: it takes no null, and a track without a
        // cover has to put the last one down rather than keep showing it.
        $={(self) => {
          const apply = () => self.set_from_paintable(cover.get())
          apply()
          onCleanup(cover.subscribe(apply))
        }}
      />
    </box>
  )
}

function Line(props: { class: string; label: Accessor<string> }) {
  return (
    <label
      class={props.class}
      label={props.label}
      xalign={0}
      maxWidthChars={LINE_CHARS}
      ellipsize={Pango.EllipsizeMode.END}
      visible={props.label.as((text) => text.length > 0)}
    />
  )
}

// The art and what is playing. Clicking it asks the player to come to the
// front, which is the same thing a notification's click does and comes with the
// same catch — see README.md. A gesture and not a button: a button would want
// to look pressable on a player that cannot be raised, and the class below only
// lights up when there is something to raise.
function Head(props: { close: () => void }) {
  const raisable = canRaise()

  return (
    <box
      class={raisable.as((can) => (can ? "media-head raisable" : "media-head"))}
      spacing={12}
    >
      <Gtk.GestureClick
        onReleased={() => {
          if (!raisable.get()) return
          // Out of the way first: the window covers the whole output, and what
          // was asked for is coming to the front of it.
          props.close()
          raisePlayer()
        }}
      />
      <Cover />
      <box orientation={Gtk.Orientation.VERTICAL} hexpand valign={Gtk.Align.CENTER}>
        <Line class="media-source" label={activePlayerName()} />
        <Line class="media-track" label={trackLabel()} />
        <Line class="media-artist" label={trackArtist()} />
        <Line class="media-album" label={trackAlbum()} />
      </box>
    </box>
  )
}

// Where the track is. Only drawn when the player published a length to measure
// against — a browser tab playing a stream has none — and only draggable when
// it says it can seek, since mpris moves a playhead by the track's own id and a
// player that publishes no id logs rather than moving.
function Seek() {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={3} visible={hasProgress()}>
      <slider
        class="media-seek"
        hexpand
        value={trackPosition()}
        min={0}
        max={trackLength()}
        step={SEEK_STEP}
        page={SEEK_STEP * 6}
        sensitive={canSeek()}
        // The user's own move, as on the volume bar: `value-changed` also fires
        // for the second-by-second poll behind the value, so seeking from there
        // would write the playhead back at the player once a second.
        onChangeValue={(_self, _scroll, value) => {
          seek(value)
          return false
        }}
      />
      <box class="media-times">
        <label class="media-time" label={positionLabel()} xalign={0} hexpand />
        <label class="media-time" label={remainingLabel()} />
      </box>
    </box>
  )
}

// The design's five: the two that hold a state at the ends, the two that move a
// track beside them, and what it is doing in the middle. Shuffle and repeat are
// optional in mpris — a player that does not answer them says so, and the row
// closes up rather than offering a switch that cannot flip.
//
// The `pixelSize`s are three different numbers for one row because the glyphs
// are: measured on the shared 24 canvas, the transport symbols fill 18.0 units
// of height, play fills 19.8 and repeat 20.2, where the rest of the set fills
// 22–24. Stepped off the ink, they land 13–18px of it — the design's own
// proportion to the button each one sits in.
function Transport() {
  return (
    <box class="media-transport" spacing={8} halign={Gtk.Align.CENTER}>
      <button
        class={shuffleOn().as((on) => (on ? "media-button on" : "media-button"))}
        visible={shuffleSupported()}
        tooltipText={t.mediaShuffle}
        onClicked={toggleShuffle}
      >
        <image iconName={Icons.shuffle} pixelSize={17} />
      </button>

      <button
        class="media-button step"
        sensitive={canGoPrevious()}
        tooltipText={t.mediaPrevious}
        onClicked={previousTrack}
      >
        <image iconName={Icons.trackPrevious} pixelSize={22} />
      </button>

      <button class="media-play" tooltipText={playLabel()} onClicked={playPause}>
        <image iconName={playIcon("outline")} pixelSize={22} />
      </button>

      <button
        class="media-button step"
        sensitive={canGoNext()}
        tooltipText={t.mediaNext}
        onClicked={nextTrack}
      >
        <image iconName={Icons.trackNext} pixelSize={22} />
      </button>

      <button
        class={loopOn().as((on) => (on ? "media-button on" : "media-button"))}
        visible={loopSupported()}
        // The label carries which of the three it is on, since the set has one
        // repeat symbol and a looped track lights the same shape as a looped
        // playlist.
        tooltipText={loopLabel().as((mode) => `${t.mediaRepeat} · ${mode}`)}
        onClicked={cycleLoop}
      >
        <image iconName={Icons.repeat} pixelSize={16} />
      </button>
    </box>
  )
}

// Everything else that is playing. The design's slot here is a queue, which
// mpris keeps in an optional interface astal does not carry — and what actually
// gets in the way of a media pill is not the next track but the third player
// that turned up, so the space goes to those.
function PlayerRow(player: Player) {
  const current = isActivePlayer(player)
  const track = playerTrack(player)

  return (
    <button
      class={current.as((on) => (on ? "list-row current" : "list-row"))}
      onClicked={() => selectPlayer(player)}
    >
      <box spacing={9}>
        <box orientation={Gtk.Orientation.VERTICAL} hexpand valign={Gtk.Align.CENTER}>
          <label
            class="list-row-name"
            label={playerName(player)}
            xalign={0}
            maxWidthChars={LINE_CHARS}
            ellipsize={Pango.EllipsizeMode.END}
          />
          <label
            class="list-row-meta"
            label={track}
            xalign={0}
            maxWidthChars={LINE_CHARS}
            ellipsize={Pango.EllipsizeMode.END}
            visible={track.as((text) => text.length > 0)}
          />
        </box>
        <image
          class="list-row-check"
          iconName={Icons.check}
          pixelSize={15}
          valign={Gtk.Align.CENTER}
          visible={current}
        />
      </box>
    </button>
  )
}

function PlayerList() {
  const all = players()
  // One player is not a choice, and a list of one reads as a setting that does
  // nothing.
  const many = all.as((list) => list.length > 1)

  return (
    <box orientation={Gtk.Orientation.VERTICAL} visible={many}>
      <box class="panel-section" spacing={9}>
        <label class="panel-section-label" label={t.mediaPlayers} />
        <box class="panel-section-rule" hexpand valign={Gtk.Align.CENTER} />
      </box>
      <box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
        {/* Keyed by bus name, so a row survives everything but the application
            behind it quitting. */}
        <For each={all} id={(player) => player.busName}>
          {(player) => PlayerRow(player)}
        </For>
      </box>
    </box>
  )
}

// The media pill's panel, mirroring the control centre on the other side of the
// bar: the same full-output window with the click-away scrim under it, the same
// mount/reveal pair so the window outlives the transition that takes it off
// screen. Only the side is different, which is the design's — the pill it hangs
// from is at the left end of the strip.
export default function MediaPanel(props: {
  gdkmonitor: Gdk.Monitor
  open: Accessor<boolean>
  close: () => void
}) {
  const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor

  const [mounted, setMounted] = createState(false)
  const [revealed, setRevealed] = createState(false)
  let pending: Timer | null = null

  props.open.subscribe(() => {
    pending?.cancel()

    if (props.open.get()) {
      setMounted(true)
      pending = idle(() => setRevealed(true))
    } else {
      setRevealed(false)
      pending = timeout(REVEAL_MS, () => setMounted(false))
    }
  })

  return (
    <window
      visible={mounted}
      name="struntuz-media"
      namespace="struntuz-media"
      gdkmonitor={props.gdkmonitor}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.ON_DEMAND}
      anchor={TOP | BOTTOM | LEFT | RIGHT}
      application={app}
    >
      <Gtk.EventControllerKey
        onKeyPressed={(_self, keyval) => {
          if (keyval !== Gdk.KEY_Escape) return false
          props.close()
          return true
        }}
      />
      <overlay>
        <box>
          <Gtk.GestureClick onPressed={props.close} />
        </box>
        {/* Pinned left, so what the transition grows and shrinks is the right
            edge — the control centre's `SLIDE_LEFT` at `halign: END`, the other
            way round. */}
        <revealer
          $type="overlay"
          revealChild={revealed}
          transitionType={Gtk.RevealerTransitionType.SLIDE_RIGHT}
          transitionDuration={REVEAL_MS}
          halign={Gtk.Align.START}
          valign={Gtk.Align.START}
          marginTop={PANEL_TOP}
          marginStart={PANEL_SIDE}
        >
          <box
            class="panel media-panel"
            // Nothing to click while it is on its way out: `can-target` takes a
            // widget's children with it, so the whole panel goes at once.
            canTarget={revealed}
            orientation={Gtk.Orientation.VERTICAL}
            spacing={12}
            valign={Gtk.Align.START}
            widthRequest={PANEL_WIDTH}
          >
            <Head close={props.close} />
            <Seek />
            <Transport />
            <PlayerList />
          </box>
        </revealer>
      </overlay>
    </window>
  )
}
