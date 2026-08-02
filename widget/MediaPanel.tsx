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
  isPlayerPlaying,
  loopIcon,
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
    // The tint and the note under it are what a track with no art wears, so
    // the head keeps its shape whether or not the player published a cover —
    // and plenty do not: Firefox publishes only what the page declared through
    // the MediaSession API, which YouTube's own watch pages do not.
    // `overflow` is what rounds the picture off: in GTK4 a border-radius clips
    // the background and not the content until the widget is told to hide what
    // falls outside it.
    <box class="media-art" overflow={Gtk.Overflow.HIDDEN} valign={Gtk.Align.START}>
      {/* 30 and not the transport's numbers: the note is the one tall glyph in
          the set, filling 23.6 units of the 24 `pixelSize` counts, so it draws
          29.5px in the 84px tile — the share `.tile-icon` has at 18 in 36. */}
      <image
        class="media-art-glyph"
        iconName={Icons.music}
        pixelSize={30}
        hexpand
        vexpand
        visible={cover.as((texture) => texture === null)}
      />
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
// `valign` on every one of them, and not by habit: a box gives its children
// FILL, so without it each button is stretched to the height of the tallest —
// the 50px play disc — and a 38px circle allocated 38x50 comes out an oval
// under the pointer, which is what a `border-radius` that large does to a box
// that is not square.
function Transport() {
  return (
    <box class="media-transport" spacing={8} halign={Gtk.Align.CENTER}>
      <button
        class={shuffleOn().as((on) => (on ? "media-button on" : "media-button"))}
        visible={shuffleSupported()}
        tooltipText={t.mediaShuffle}
        valign={Gtk.Align.CENTER}
        onClicked={toggleShuffle}
      >
        <image iconName={Icons.shuffle} pixelSize={17} />
      </button>

      <button
        class="media-button step"
        sensitive={canGoPrevious()}
        tooltipText={t.mediaPrevious}
        valign={Gtk.Align.CENTER}
        onClicked={previousTrack}
      >
        <image iconName={Icons.trackPrevious} pixelSize={22} />
      </button>

      <button
        class="media-play"
        tooltipText={playLabel()}
        valign={Gtk.Align.CENTER}
        onClicked={playPause}
      >
        <image iconName={playIcon("outline")} pixelSize={22} />
      </button>

      <button
        class="media-button step"
        sensitive={canGoNext()}
        tooltipText={t.mediaNext}
        valign={Gtk.Align.CENTER}
        onClicked={nextTrack}
      >
        <image iconName={Icons.trackNext} pixelSize={22} />
      </button>

      <button
        class={loopOn().as((on) => (on ? "media-button on" : "media-button"))}
        visible={loopSupported()}
        // The glyph separates one track from the whole list; the label is what
        // separates the list from nothing at all.
        tooltipText={loopLabel().as((mode) => `${t.mediaRepeat} · ${mode}`)}
        valign={Gtk.Align.CENTER}
        onClicked={cycleLoop}
      >
        <image iconName={loopIcon()} pixelSize={16} />
      </button>
    </box>
  )
}

// Everything else that is playing, as a row of tabs over the panel. The
// design's slot down at the bottom is a queue, which mpris keeps in an optional
// interface astal does not carry — and the first thing tried in its place, a
// list of players under a section head, read as the audio menu's list of output
// devices, since that is exactly the shape it borrowed. Tabs are the other
// answer and a better one: the row says how many sources there are before it is
// touched, where a list says it only after being read, and it puts the switch
// at the top of what it switches rather than under it.
const TAB_CHARS = 14

function PlayerTab(player: Player) {
  const current = isActivePlayer(player)
  const track = playerTrack(player)

  return (
    <button
      class={current.as((on) => (on ? "player-tab current" : "player-tab"))}
      // What the tab has no room to say. Which player it is, is the tab; what
      // it is playing is why you would switch to it.
      tooltipText={track.as((text) => text || playerName(player))}
      valign={Gtk.Align.CENTER}
      onClicked={() => selectPlayer(player)}
    >
      <box spacing={7}>
        {/* Only on the one making sound. With two players open that is the
            question, and the lit tab answers a different one — which is being
            controlled. */}
        <box
          class="player-tab-dot"
          visible={isPlayerPlaying(player)}
          valign={Gtk.Align.CENTER}
        />
        <label
          class="player-tab-name"
          label={playerName(player)}
          maxWidthChars={TAB_CHARS}
          ellipsize={Pango.EllipsizeMode.END}
        />
      </box>
    </button>
  )
}

function PlayerTabs() {
  const all = players()
  // One player is not a choice, and a single tab reads as a control that does
  // nothing.
  const many = all.as((list) => list.length > 1)

  return (
    // Scrolled, so a fifth player pushes the row sideways rather than the
    // panel wider: a `widthRequest` is a minimum, and a box asking for more
    // than the column has would simply get it. The bin takes its content
    // through `child` — a JSX child parents without telling it (CLAUDE.md).
    <Gtk.ScrolledWindow
      class="player-tabs"
      visible={many}
      hscrollbarPolicy={Gtk.PolicyType.EXTERNAL}
      vscrollbarPolicy={Gtk.PolicyType.NEVER}
      propagateNaturalHeight
      child={
        (
          <box spacing={6}>
            {/* Keyed by bus name, so a tab survives everything but the
                application behind it quitting. */}
            <For each={all} id={(player) => player.busName}>
              {(player) => PlayerTab(player)}
            </For>
          </box>
        ) as Gtk.Widget
      }
    />
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
            <PlayerTabs />
            <Head close={props.close} />
            <Seek />
            <Transport />
          </box>
        </revealer>
      </overlay>
    </window>
  )
}
