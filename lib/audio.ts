import { Accessor, createBinding, createComputed, createState } from "ags"
import AstalWp from "gi://AstalWp"
import { VolumeIcons, type VolumeWeight } from "./icons"
import { getConfig } from "./config"
import { t } from "./i18n"

export type Speaker = AstalWp.Endpoint

// Wireplumber is not a given: the bar runs on a machine without a sound server
// as readily as on one, and astal answers that with a null default rather than
// an error. So everything below goes through this and has something to say when
// it is null.
function audio(): AstalWp.Audio | null {
  const wp: AstalWp.Wp | null = AstalWp.get_default()
  return wp ? wp.audio : null
}

export function hasAudio(): boolean {
  return audio() !== null
}

function constant<T>(value: T): Accessor<T> {
  const [state] = createState(value)
  return state
}

// The default speaker is not one object for the life of the session — plugging
// in headphones replaces it, and so does picking another one from the menu — so
// nothing here holds an endpoint. Every reading goes through whichever one is
// default when it is read, and the computed re-subscribes to the new one when
// that changes.
function fromSpeaker<T>(read: (speaker: Speaker) => Accessor<T>, fallback: T): Accessor<T> {
  const sound = audio()
  if (!sound) return constant(fallback)

  const speaker = createBinding(sound, "defaultSpeaker")
  return createComputed(() => {
    const current = speaker()
    return current ? read(current)() : fallback
  })
}

// 0–1 on wireplumber's cubic scale, which is the one a volume slider is meant
// to move on: linear amplitude spends half the bar on the top few decibels.
export function volume(): Accessor<number> {
  return fromSpeaker((speaker) => createBinding(speaker, "volume"), 0)
}

export function muted(): Accessor<boolean> {
  return fromSpeaker((speaker) => createBinding(speaker, "mute"), true)
}

// What the fill shows. Muting does not move the volume, but it does empty the
// bar: what is drawn is what you would hear.
export function level(): Accessor<number> {
  const [loudness, silent] = [volume(), muted()]
  return createComputed(() => (silent() ? 0 : loudness()))
}

// The line beside the label, and the menu's subtitle: the percentage, or that
// there is no sound at all.
export function volumeStatus(): Accessor<string> {
  const [loudness, silent] = [volume(), muted()]
  return createComputed(() =>
    silent() ? t.volumeMuted : t.volumePercent.replace("%d", String(Math.round(loudness() * 100))),
  )
}

// Which speaker is drawn: how many waves is how loud. The design does this in
// its OSD and the thirds are the same idea one step finer, since the set has
// three wave glyphs where the design's had two.
//
// The step is taken on the number the label shows, not on the raw fraction, so
// the two never disagree — a bar reading 0% never has a wave on it, and one
// reading 1% always does.
export function volumeIcon(weight: VolumeWeight): Accessor<string> {
  const ramp = VolumeIcons[weight]
  const [loudness, silent] = [volume(), muted()]

  return createComputed(() => {
    if (silent()) return ramp.muted

    const percent = Math.round(loudness() * 100)
    if (percent === 0) return ramp.silent
    if (percent < 34) return ramp.low
    if (percent < 67) return ramp.medium
    return ramp.high
  })
}

// Where the sound is going, for the bar's own tooltip: the description of
// whichever endpoint is default, following it when it changes.
export function outputName(): Accessor<string> {
  return fromSpeaker(
    (speaker) => createBinding(speaker, "description").as(() => speakerName(speaker)),
    t.audio,
  )
}

// How far a scroll or an arrow key moves it, as a fraction. A step outside 1–100
// is not a step, so the config's own number is held to that.
export function volumeStep(): number {
  return Math.min(Math.max(getConfig().volumeStep, 1), 100) / 100
}

// Unmuting on the way: moving a bar that is showing nothing has to make a
// sound, or the drag reads as broken.
export function setVolume(value: number): void {
  const speaker = audio()?.defaultSpeaker
  if (!speaker) return

  speaker.mute = false
  speaker.volume = Math.min(Math.max(value, 0), 1)
}

export function toggleMute(): void {
  const speaker = audio()?.defaultSpeaker
  if (!speaker) return

  speaker.mute = !speaker.mute
}

// Everything that can play sound, which is what the menu lists.
export function speakers(): Accessor<Speaker[]> {
  const sound = audio()
  if (!sound) return constant<Speaker[]>([])

  return createBinding(sound, "speakers").as((list) => list ?? [])
}

export function isDefaultSpeaker(speaker: Speaker): Accessor<boolean> {
  return createBinding(speaker, "isDefault")
}

// Wireplumber's own doing: it moves the streams over as well as the default, so
// what is playing follows rather than staying on the device that went quiet.
export function selectSpeaker(speaker: Speaker): void {
  speaker.set_is_default(true)
}

// The description is the readable one ("Built-in Audio Analog Stereo"); the name
// is the node's own (`alsa_output.pci-…`), which is only there because a device
// with neither would otherwise be a blank row.
export function speakerName(speaker: Speaker): string {
  return speaker.description || speaker.name || t.audio
}
