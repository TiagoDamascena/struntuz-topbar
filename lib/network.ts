import { Accessor, createBinding, createComputed, createState } from "ags"
import { timeout } from "ags/time"
import AstalNetwork from "gi://AstalNetwork"
import { WifiIcons } from "./icons"
import { t } from "./i18n"

const { DeviceState } = AstalNetwork

// How long a join is given before it is called a failure. NetworkManager gives
// an association about 45s of its own; this is shorter because what is waiting
// on it is a panel with a spinner in it, and a minute of that reads as a hang.
const CONNECT_TIMEOUT = 30_000

// A network as everything above this module knows it: plain data, copied out of
// NetworkManager at the one moment it was safe to read.
//
// It is plain because an `AstalNetwork.AccessPoint` cannot be held. Astal's
// wrapper delegates every property straight to the `NM.AccessPoint` behind it
// with no liveness check (`accesspoint.vala`), and libnm invalidates that object
// the moment the access point goes away — so a getter on a stale wrapper trips
// an `NM_IS_ACCESS_POINT` assertion, and `ssid` in particular then calls
// `.get_data()` on the NULL it was handed and takes the process with it.
//
// Which is not a rare case: astal keys its table by *BSSID*, so a network whose
// strongest radio changes is a remove and an add, and turning the radio off
// removes every access point at once. Hence the rule this module keeps —
// nothing outside it ever sees an access point, and nothing inside it holds one
// across a turn of the loop. It is the rule `lib/audio.ts` keeps for endpoints
// and `lib/mpris.ts` for players, for the same reason each time.
export interface Network {
  ssid: string
  // Astal's own key for an access point, so it is the identity here too — and
  // what a click resolves back to a live object through.
  bssid: string
  strength: number
  secured: boolean
  // Whether NetworkManager already holds a profile for it.
  saved: boolean
}

// NetworkManager is not a given, and unlike the notification daemon this bar
// does not bring one: `AstalNetwork.get_default()` builds an `NM.Client` in its
// constructor and there is nothing to fall back on when the daemon is not
// running. A machine with no wireless card answers the same way — a null
// `wifi` — so absence of a radio and absence of the daemon come out here as one
// thing, which is all the widgets need to know.
//
// Read once, as `lib/audio.ts` reads its endpoint: the widget tree is built at
// startup and `hasWifi()` is what decides whether the tile and the segment
// exist at all, so a card plugged in later needs the process restarted, the way
// a hotplugged monitor does.
let manager: AstalNetwork.Network | null | undefined
let device: AstalNetwork.Wifi | null | undefined

function network(): AstalNetwork.Network | null {
  if (manager === undefined) {
    try {
      manager = AstalNetwork.get_default()
    } catch (err) {
      console.warn(`struntuz-topbar: no NetworkManager, the Wi-Fi menu stays out (${err})`)
      manager = null
    }
  }
  return manager
}

function wifi(): AstalNetwork.Wifi | null {
  if (device === undefined) device = network()?.wifi ?? null
  return device
}

export function hasWifi(): boolean {
  return wifi() !== null
}

function constant<T>(value: T): Accessor<T> {
  const [state] = createState(value)
  return state
}

// The radio, which is not the connection: NetworkManager keeps the two apart
// and so does the panel — the switch turns this, and a network in the list
// turns the other.
export function enabled(): Accessor<boolean> {
  const radio = wifi()
  return radio ? createBinding(radio, "enabled") : constant(false)
}

export function setEnabled(on: boolean): void {
  const radio = wifi()
  if (radio) radio.enabled = on
}

export function toggleWifi(): void {
  const radio = wifi()
  if (radio) radio.enabled = !radio.enabled
}

// The name of the network the machine is actually on. Astal's own `ssid` and
// not `activeAccessPoint.ssid` — a plain string it caches, where the second is
// a read through a wrapper that may already be stale. It follows the device
// through every state it passes through, so only ACTIVATED counts as connected.
export function networkName(): Accessor<string> {
  const radio = wifi()
  if (!radio) return constant("")

  return createComputed(
    [createBinding(radio, "ssid"), createBinding(radio, "state")],
    (name, state) => (state === DeviceState.ACTIVATED ? (name ?? "") : ""),
  )
}

// The line under the tile's label and the sub-panel's subtitle. Three readings
// and not two: a radio that is on but on no network is neither of the others,
// and it is the one a person does something about.
export function wifiStatus(): Accessor<string> {
  const [on, name] = [enabled(), networkName()]
  return createComputed(() => (!on() ? t.wifiOff : name() || t.wifiDisconnected))
}

// How strong the link is, 0–100, and 0 whenever there is no link — the same
// rule `level()` follows in `lib/audio.ts`: what is drawn is what is true now,
// not the last value the property held.
export function strength(): Accessor<number> {
  const radio = wifi()
  if (!radio) return constant(0)

  return createComputed(
    [createBinding(radio, "strength"), createBinding(radio, "state")],
    (value, state) => (state === DeviceState.ACTIVATED ? value : 0),
  )
}

// Thirds, as the volume ramp takes them: three arcs is three steps, and a
// signal reads the same way a level does.
export function signalIcon(value: number): string {
  if (value < 34) return WifiIcons.low
  if (value < 67) return WifiIcons.medium
  return WifiIcons.high
}

// The glyph on the bar and in the tile's disc. The slash covers both a radio
// that is off and a radio that is on with nothing joined: what the ramp
// reports is a connection and how good it is, and neither state has one. Which
// of the two it is, is on the line underneath — `wifiStatus` says it in words.
// (`wifi.exclamationmark` is the export that would separate them, if the two
// ever need telling apart at a glance.)
export function wifiIcon(): Accessor<string> {
  const [on, power, name] = [enabled(), strength(), networkName()]
  return createComputed(() => (on() && name() ? signalIcon(power()) : WifiIcons.off))
}

// Which networks NetworkManager already has a profile for.
//
// **Never `AccessPoint.get_connections()`, which is the natural call for this
// and crashes the process.** Astal declares it returning a Vala
// `GenericArray<NM.RemoteConnection>`, which introspects as *transfer full*,
// while the `nm_access_point_filter_connections` behind it is documented
// `(transfer container)` — the array borrows the client's connections. So every
// call from GJS unrefs each matching profile once too often, and once the
// refcount reaches zero NetworkManager's own list holds freed objects: the next
// call walks them and dies in `g_type_check_instance_is_a` (verified from the
// core dump, under `nm_access_point_connection_valid`). The
// `nm-access-point.c:287` criticals in the log are the same profiles, already
// freed. Calling it costs nothing visible until it kills the bar minutes later.
//
// The client's own list is annotated correctly, so reading it is safe. It is
// matched on the profile's *SSID* and not its id: NetworkManager suffixes a
// duplicate name, so the profile called "Maria 1" is the one for the network
// called "Maria" (verified — this machine has both, and three profiles sharing
// one SSID).
function savedNetworks(): Set<string> {
  const names = new Set<string>()
  const client = network()?.client
  if (!client) return names

  for (const connection of client.connections ?? []) {
    if (connection.get_connection_type() !== "802-11-wireless") continue

    // Through GLib's own bytes rather than `NM.Utils.ssid_to_utf8`, which would
    // mean importing `gi://NM` for one call.
    const data = connection.get_setting_wireless()?.get_ssid()?.get_data()
    if (data) names.add(new TextDecoder().decode(data))
  }

  return names
}

// The one place access points are read, and it runs only when astal says the
// list changed — `.as` maps on that notification and nothing else, so what it
// walks is the array just handed to it, every entry of which is live by
// construction.
//
// This is load-bearing and not tidiness. The first version of this was a
// `createComputed` over the list *and* the device state, which re-runs on every
// step of a connection while holding the previously published array — and by
// then that array can name access points NetworkManager has destroyed. That is
// what segfaulted on a click to join and on the radio being switched off.
let listed: Accessor<Network[]> | null = null

function describe(): Accessor<Network[]> {
  if (listed) return listed

  const radio = wifi()
  if (!radio) return (listed = constant<Network[]>([]))

  return (listed = createBinding(radio, "accessPoints").as((list) => {
    const best = new Map<string, Network>()
    // Once per snapshot, not once per access point: it walks every profile on
    // the machine, and there are dozens of those against a handful of these.
    const saved = savedNetworks()

    for (const ap of list ?? []) {
      // A hidden network broadcasts an empty name, and there is nothing to draw
      // for one: it is joined by typing an SSID, which is a connection astal's
      // access points cannot describe (see the README).
      const ssid = ap.ssid
      if (!ssid) continue

      // NetworkManager lists an access point per radio, so a mesh or a
      // dual-band router puts the same name here two or five times over. What a
      // list of networks means is one row per name, at the strongest radio
      // carrying it.
      const held = best.get(ssid)
      if (held && held.strength >= ap.strength) continue

      best.set(ssid, {
        ssid,
        bssid: ap.bssid,
        strength: ap.strength,
        secured: ap.requiresPassword,
        saved: saved.has(ssid),
      })
    }

    return [...best.values()]
  }))
}

// What the menu lists: strongest first, whatever is joined pinned to the top.
// Pure arithmetic on the snapshot above, so the ordering can follow the device's
// state without that state ever reaching an access point.
export function networks(): Accessor<Network[]> {
  return createComputed([describe(), networkName()], (list, joined) =>
    [...list].sort((a, b) => {
      if (a.ssid === joined) return -1
      if (b.ssid === joined) return 1
      return b.strength - a.strength
    }),
  )
}

// Compared by name and not by radio: the row holds the strongest access point
// carrying a name, which is not always the one NetworkManager negotiated with.
export function isActive(ssid: string): Accessor<boolean> {
  return networkName().as((joined) => joined !== "" && joined === ssid)
}

// What a row says under its name.
export function networkStatus(net: Network, current: boolean): string {
  if (current) return t.wifiConnected
  if (!net.secured) return t.wifiOpenNetwork
  return net.saved ? t.wifiSaved : t.wifiSecured
}

// Whether NetworkManager already holds what this network needs: an open one
// asks for nothing, and a saved one has a profile with the secret in it.
// Everything else is a password panel.
export function isKnown(net: Network): boolean {
  return !net.secured || net.saved
}

// Asked for when the menu opens, the way the night light's temperature is.
// NetworkManager keeps scanning on its own while a list is up, so this is only
// what makes the first list the current one rather than the last one it took.
export function scan(): void {
  const radio = wifi()
  if (radio?.enabled) radio.scan()
}

export function scanning(): Accessor<boolean> {
  const radio = wifi()
  return radio ? createBinding(radio, "scanning") : constant(false)
}

// Back from a snapshot to the live object, at the moment of use and never
// before — which is the whole of why a `Network` carries a bssid. A network
// that went away between the click and here is simply gone.
function resolve(bssid: string): AstalNetwork.AccessPoint | null {
  const radio = wifi()
  if (!radio) return null

  for (const ap of radio.accessPoints ?? []) {
    if (ap.bssid === bssid) return ap
  }
  return null
}

// The password panel's subject, held here rather than in the window for the
// reason `lib/mpris.ts` holds a bus name: the control centre's views are the
// bar's state, and which network is being joined has to survive the panel
// sliding from one to the next. A snapshot, so holding it costs nothing.
const [target, setTarget] = createState<Network | null>(null)
const [busy, setBusy] = createState(false)
const [failure, setFailure] = createState("")

export function joinTarget(): Accessor<Network | null> {
  return target
}

export function joining(): Accessor<boolean> {
  return busy
}

export function joinError(): Accessor<string> {
  return failure
}

export function beginJoin(net: Network): void {
  setTarget(net)
  setFailure("")
}

export function endJoin(): void {
  setTarget(null)
  setFailure("")
}

// WPA-PSK's own floor. A shorter key is not a wrong password, it is not a key
// at all, so the button says so by staying off rather than by failing.
export const PASSWORD_MIN = 8

// Joining. `password` is null for a network NetworkManager already knows, and
// that is load-bearing rather than tidy: astal does not ignore the argument on a
// saved profile, it writes it in as the new psk and commits it
// (`accesspoint.vala`). So passing one on a network that already works would
// overwrite a good stored secret with whatever was typed. Which is also why
// there is no way here to re-enter the password for a saved network — that
// wants a "forget" first, and forgetting is `nmcli`'s (see the README).
export function connect(net: Network, password: string | null): void {
  const radio = wifi()
  if (!radio || busy.get()) return

  const ap = resolve(net.bssid)
  if (!ap) {
    setFailure(t.wifiFailed.replace("%s", net.ssid))
    return
  }

  setBusy(true)
  setFailure("")

  activate(ap, password)
    .then(() => settle(radio, net.ssid))
    .then(() => endJoin())
    .catch((err: unknown) => {
      const wrong = err instanceof Error && err.message === "auth"
      setFailure((wrong ? t.wifiWrongPassword : t.wifiFailed).replace("%s", net.ssid))
      if (!wrong) console.warn(`struntuz-topbar: joining ${net.ssid} failed: ${err}`)
    })
    .finally(() => setBusy(false))
}

// Driven by hand rather than awaited. GJS promisifies a GIO-style async pair on
// its own only for the naming it recognises, and astal's is a Vala `async`
// method called plain `activate` — so `activate(password)` is not the promise
// the generated types advertise, it is the callback form with its callback
// missing, and it throws "At least 2 arguments required" before anything is
// tried. The finish function is where the error comes out, so the throw has to
// be caught there and turned back into a rejection.
function activate(ap: AstalNetwork.AccessPoint, password: string | null): Promise<void> {
  return new Promise((resolve, reject) => {
    ap.activate(password, (_source, result) => {
      try {
        ap.activate_finish(result)
        resolve()
      } catch (err) {
        reject(err)
      }
    })
  })
}

// astal's `activate` answers when NetworkManager has *started* the activation
// and not when it has worked — `add_and_activate_connection_async` hands back
// the new connection object and the handshake happens after it — so a wrong
// password resolves exactly like a right one. What says which is the device's
// own state afterwards.
//
// Only three states end the wait. ACTIVATED on the network that was asked for
// is the answer; NEED_AUTH and FAILED are where NetworkManager lands when the
// secret is refused. Everything else is on the way, DISCONNECTED included —
// that is the state a machine passes through leaving the network it was on, so
// reading it as a failure would fail every switch between two networks.
function settle(radio: AstalNetwork.Wifi, ssid: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let done = false

    const finish = (err?: Error) => {
      if (done) return
      done = true
      radio.disconnect(handler)
      clock.cancel()
      if (err) reject(err)
      else resolve()
    }

    const check = () => {
      // The device's own cached name, never the access point's: by the time a
      // join settles, the radio that was clicked may be gone from the list.
      if (radio.state === DeviceState.ACTIVATED && radio.ssid === ssid) finish()
      else if (radio.state === DeviceState.NEED_AUTH) finish(new Error("auth"))
      else if (radio.state === DeviceState.FAILED) finish(new Error("failed"))
    }

    const handler = radio.connect("notify::state", check)
    const clock = timeout(CONNECT_TIMEOUT, () => finish(new Error("timeout")))
    check()
  })
}
