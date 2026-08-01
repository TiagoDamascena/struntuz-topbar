import { Accessor, createState } from "ags"
import { execAsync } from "ags/process"
import { getConfig } from "./config"
import { t } from "./i18n"

// The filter belongs to whatever runs it — hyprsunset here — and not to the bar,
// so what is kept is the temperature the display is believed to be at: read back
// from the `status` command where there is one, and otherwise whatever the last
// click set.
const [current, setCurrent] = createState(getConfig().nightLight.neutral)

export function nightLightOn(): Accessor<boolean> {
  const { neutral } = getConfig().nightLight
  return current.as((kelvin) => kelvin < neutral)
}

// The design writes the temperature under the label rather than "On", which is
// only worth doing if it is the real one — hence the read back.
export function nightLightStatus(): Accessor<string> {
  const { neutral } = getConfig().nightLight
  return current.as((kelvin) =>
    kelvin < neutral ? t.nightLightKelvin.replace("%d", String(kelvin)) : t.nightLightOff,
  )
}

// Asks what the display is at now. Failing is not an error: the command is the
// user's and the tool behind it may not be running, so the tile keeps whatever
// state its own clicks left it in.
export function readNightLight(): void {
  const { status } = getConfig().nightLight
  if (!status) return

  execAsync(["sh", "-c", status])
    .then((out) => {
      const kelvin = Number.parseInt(out.trim(), 10)
      if (Number.isFinite(kelvin) && kelvin > 0) setCurrent(kelvin)
      else console.warn(`struntuz-topbar: night light status is no temperature: "${out.trim()}"`)
    })
    .catch((err) => console.warn(`struntuz-topbar: night light status failed (${status}): ${err}`))
}

// Through a shell, as the power actions are, so a configured command can be a
// pipeline and not only a program with arguments.
export function toggleNightLight(): void {
  const { temperature, neutral, on, off } = getConfig().nightLight
  const previous = current.get()
  const turningOn = previous >= neutral
  // `%d` is the temperature the command has to leave the display at, which is
  // what makes both of them the same command with a different number. Every
  // occurrence, not the first: naming it twice is a fair thing to configure.
  const target = turningOn ? temperature : neutral
  const command = (turningOn ? on : off).replaceAll("%d", String(target))
  if (!command) return

  // Moved before the command answers, so the tile follows the click rather than
  // the round trip. The read back below is what corrects it either way.
  setCurrent(target)

  execAsync(["sh", "-c", command])
    .catch((err) => {
      console.warn(`struntuz-topbar: night light failed (${command}): ${err}`)
      setCurrent(previous)
    })
    .finally(readNightLight)
}
