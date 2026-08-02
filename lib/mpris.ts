import { Accessor, createBinding, createComputed, createState } from "ags"
import AstalMpris from "gi://AstalMpris"
import { PlayIcons, type PlayWeight } from "./icons"
import { t } from "./i18n"

export type Player = AstalMpris.Player

const { Loop, PlaybackStatus, Shuffle } = AstalMpris

// Unlike `AstalWp`, this one is always there: the manager is a watcher on the
// session bus and answers with an empty list when nothing is playing. What can
// be missing is a player, which is what everything below falls back on.
function manager(): AstalMpris.Mpris {
  return AstalMpris.get_default()
}

// Both of these are memoized rather than built per call, unlike `lib/audio.ts`:
// `active` re-subscribes to every player's status on every change, and a fresh
// copy per accessor would put that machinery behind each of the fifteen readings
// the panel takes instead of behind one.
let list: Accessor<Player[]> | null = null
let active: Accessor<Player | null> | null = null

// Players that are not players. `playerctld` takes an mpris name of its own and
// mirrors whichever real one was last active, so a bar that counts it lists
// every track twice and can end up controlling the proxy instead of the thing
// making the sound. It exists to give a single-player client the "whatever is
// playing" this module already works out for itself, and the panel's list is
// the other half of that — so it is dropped rather than made configurable.
const PROXIES = ["org.mpris.MediaPlayer2.playerctld"]

// Arrival order, which astal keeps in a list rather than the hash table the tray
// and the notifications come out of — so unlike those two this needs no sort to
// stay put.
export function players(): Accessor<Player[]> {
  if (!list) {
    list = createBinding(manager(), "players").as((current) =>
      (current ?? []).filter((player) => !PROXIES.includes(player.busName)),
    )
  }
  return list
}

// The player the bar is showing, as a bus name and not as an object: a player
// that quits and comes back is a new `Player`, and what was picked was the
// application. Empty means nothing was picked and the rule below decides.
const [chosen, setChosen] = createState("")

export function selectPlayer(player: Player): void {
  setChosen(player.busName)
}

// Whichever one the panel is about. The pick survives only as long as the
// application does — a bus name that is no longer in the list falls straight
// through to the rule, so a player quitting hands the pill to the next one
// rather than emptying it.
export function activePlayer(): Accessor<Player | null> {
  if (active) return active

  const all = players()
  active = createComputed(() => {
    const current = all()
    if (current.length === 0) return null

    const picked = current.find((player) => player.busName === chosen())
    if (picked) return picked

    // Whatever is making sound, else whatever turned up first. Reading each
    // player's status through a binding is what re-runs this when one of them
    // starts playing — the list itself only notifies on arrival and departure.
    const playing = current.find(
      (player) => createBinding(player, "playbackStatus")() === PlaybackStatus.PLAYING,
    )
    return playing ?? current[0]
  })

  return active
}

export function isActivePlayer(player: Player): Accessor<boolean> {
  return activePlayer().as((current) => current === player)
}

// Same shape as `fromSpeaker` in lib/audio.ts, and for the same reason: nothing
// here holds a player, since the one being shown is replaced when another one
// starts playing and when the list picks a different one.
function fromPlayer<T>(read: (player: Player) => Accessor<T>, fallback: T): Accessor<T> {
  const current = activePlayer()
  return createComputed(() => {
    const player = current()
    return player ? read(player)() : fallback
  })
}

export function hasPlayer(): Accessor<boolean> {
  return activePlayer().as((player) => player !== null)
}

// The application, which is what the panel's first line and the player rows are
// set in. An identity is optional in the spec, so the bus name's own tail is
// what a player that declared none is called.
export function playerName(player: Player): string {
  return player.identity || player.busName.replace("org.mpris.MediaPlayer2.", "")
}

export function activePlayerName(): Accessor<string> {
  return fromPlayer((player) => createBinding(player, "identity").as(() => playerName(player)), "")
}

// What one row of the player list has under the application's name. It is that
// list's whole reason to exist: two players are told apart by what they are
// playing far sooner than by which of them is called what.
export function playerTrack(player: Player): Accessor<string> {
  const [title, artist] = [createBinding(player, "title"), createBinding(player, "artist")]
  return createComputed(() => [title(), artist()].filter(Boolean).join(" · "))
}

export function trackTitle(): Accessor<string> {
  return fromPlayer((player) => createBinding(player, "title"), "")
}

export function trackArtist(): Accessor<string> {
  return fromPlayer((player) => createBinding(player, "artist"), "")
}

export function trackAlbum(): Accessor<string> {
  return fromPlayer((player) => createBinding(player, "album"), "")
}

// A local path, always: astal downloads an `art_url` that points at a web server
// — which is what Spotify's is — into its own cache and reports where it put it.
export function trackCover(): Accessor<string> {
  return fromPlayer((player) => createBinding(player, "coverArt"), "")
}

// What the pill is set in. A title is what a player is expected to publish and
// not what it is held to, so the fallbacks run all the way down to the
// application's own name — the pill is on screen either way, and a blank one
// would read as broken rather than as a stream with no metadata.
export function trackLabel(): Accessor<string> {
  const [title, artist, name] = [trackTitle(), trackArtist(), activePlayerName()]
  return createComputed(() => title() || artist() || name() || t.mediaUnknown)
}

export function playing(): Accessor<boolean> {
  return fromPlayer(
    (player) =>
      createBinding(player, "playbackStatus").as((status) => status === PlaybackStatus.PLAYING),
    false,
  )
}

// The bar's tooltip: what the pill's glyph says, in words, with what it is
// playing after it.
export function trackTooltip(): Accessor<string> {
  const [live, title, artist] = [playing(), trackLabel(), trackArtist()]
  return createComputed(() => {
    const track = artist() && artist() !== title() ? `${title()} · ${artist()}` : title()
    return (live() ? t.mediaTooltipPlaying : t.mediaTooltipPaused).replace("%s", track)
  })
}

export function playIcon(weight: PlayWeight): Accessor<string> {
  const glyphs = PlayIcons[weight]
  // What the button does next, not what the player is doing — the design draws
  // a pause on something that is playing.
  return playing().as((live) => (live ? glyphs.pause : glyphs.play))
}

export function playLabel(): Accessor<string> {
  return playing().as((live) => (live ? t.mediaPause : t.mediaPlay))
}

export function canGoNext(): Accessor<boolean> {
  return fromPlayer((player) => createBinding(player, "canGoNext"), false)
}

export function canGoPrevious(): Accessor<boolean> {
  return fromPlayer((player) => createBinding(player, "canGoPrevious"), false)
}

export function canPlay(): Accessor<boolean> {
  return fromPlayer((player) => createBinding(player, "canControl"), false)
}

export function canRaise(): Accessor<boolean> {
  return fromPlayer((player) => createBinding(player, "canRaise"), false)
}

// Seconds, both of them. `position` is astal's own second-by-second poll of the
// player — mpris never announces it, since a position that advances on its own
// would be a property changing every frame.
export function trackLength(): Accessor<number> {
  return fromPlayer((player) => createBinding(player, "length"), 0)
}

export function trackPosition(): Accessor<number> {
  return fromPlayer((player) => createBinding(player, "position"), 0)
}

export function canSeek(): Accessor<boolean> {
  return fromPlayer((player) => createBinding(player, "canSeek"), false)
}

// Whether there is a line to draw at all. A stream has no end to measure
// against, and a player that reports neither a length nor a position — a
// browser tab, most of the time — has nothing for the row to say.
export function hasProgress(): Accessor<boolean> {
  return trackLength().as((seconds) => seconds > 0)
}

// `m:ss` under the hour and `h:mm:ss` over it, since an audiobook chapter is as
// likely here as a track.
function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const pad = (value: number) => (value < 10 ? `0${value}` : String(value))
  const [hours, minutes] = [Math.floor(total / 3600), Math.floor(total / 60) % 60]
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(total % 60)}` : `${minutes}:${pad(total % 60)}`
}

export function positionLabel(): Accessor<string> {
  return trackPosition().as(clock)
}

// What is left, as the design writes it: a minus and the distance to the end,
// rather than the length, which the bar already draws.
export function remainingLabel(): Accessor<string> {
  const [length, position] = [trackLength(), trackPosition()]
  return createComputed(() => `-${clock(Math.max(0, length() - position()))}`)
}

export function shuffleSupported(): Accessor<boolean> {
  return fromPlayer(
    (player) =>
      createBinding(player, "shuffleStatus").as((status) => status !== Shuffle.UNSUPPORTED),
    false,
  )
}

export function shuffleOn(): Accessor<boolean> {
  return fromPlayer(
    (player) => createBinding(player, "shuffleStatus").as((status) => status === Shuffle.ON),
    false,
  )
}

export function loopSupported(): Accessor<boolean> {
  return fromPlayer(
    (player) => createBinding(player, "loopStatus").as((status) => status !== Loop.UNSUPPORTED),
    false,
  )
}

export function loopOn(): Accessor<boolean> {
  return fromPlayer(
    (player) => createBinding(player, "loopStatus").as((status) => status !== Loop.NONE),
    false,
  )
}

// Which of the three the button is currently on, for its tooltip. The glyph
// cannot say it on its own: the set has one repeat symbol, so looping a track
// and looping a playlist light the same shape.
export function loopLabel(): Accessor<string> {
  return fromPlayer(
    (player) =>
      createBinding(player, "loopStatus").as((status) => {
        if (status === Loop.TRACK) return t.mediaRepeatTrack
        if (status === Loop.PLAYLIST) return t.mediaRepeatAll
        return t.mediaRepeatOff
      }),
    t.mediaRepeatOff,
  )
}

function withPlayer(run: (player: Player) => void): void {
  const player = activePlayer().get()
  if (player) run(player)
}

export function playPause(): void {
  withPlayer((player) => player.play_pause())
}

export function nextTrack(): void {
  withPlayer((player) => player.next())
}

export function previousTrack(): void {
  withPlayer((player) => player.previous())
}

// Seconds from the start. Astal sets it through mpris's `SetPosition`, which
// takes the track's own id — so a player that seeks but publishes no id logs
// rather than moving, and `canSeek` is what the widget gates on.
export function seek(seconds: number): void {
  withPlayer((player) => {
    if (player.canSeek) player.position = Math.max(0, seconds)
  })
}

// Astal's own cycles: shuffle flips, loop runs none → track → playlist → none.
export function toggleShuffle(): void {
  withPlayer((player) => player.shuffle())
}

export function cycleLoop(): void {
  withPlayer((player) => player.loop())
}

// Everything a media panel can do about "go to the application", and no more of
// it than the notifications get: on Wayland a window is raised, it does not
// raise itself, and whether the compositor lets a player that asks come to the
// front is the compositor's call (README.md). Mpris has no activation token to
// hand over either — `Raise` is the whole of the protocol here.
export function raisePlayer(): void {
  withPlayer((player) => {
    if (player.canRaise) player.raise()
  })
}
