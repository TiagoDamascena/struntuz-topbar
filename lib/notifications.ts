import { Accessor, createBinding, createState } from "ags"
import { createPoll, timeout, type Timer } from "ags/time"
import AstalNotifd from "gi://AstalNotifd"
import GLib from "gi://GLib"
import { getConfig } from "./config"
import { t } from "./i18n"

export type Notification = AstalNotifd.Notification

// Owning `org.freedesktop.Notifications` is the point: this is the session's
// notification daemon, not a reader of one. If another daemon already holds the
// name, notifd falls back to proxying it and nothing arrives — so only one of
// the two can run (see README.md).
function notifd(): AstalNotifd.Notifd {
  return AstalNotifd.get_default()
}

let started = false

export function startNotifications(): void {
  if (started) return
  started = true

  // The list in the control centre is the reason: left to itself the daemon
  // resolves a notification when the timeout its sender asked for runs out,
  // which would empty the list a few seconds after each arrival. The toasts
  // keep that timeout themselves (`holdFor` below), so nothing is lost — a
  // notification now stays until it is dismissed.
  notifd().ignoreTimeout = true
}

// Do-not-disturb lives on the daemon rather than in a state of this module's
// own, so a notification that arrives while nothing is on screen is silenced by
// the same value the control centre's tile reads. Notifd keeps it in GSettings
// (`io.astal.notifd dont-disturb`, beside `ignore-timeout` and the notifications
// themselves), so it survives a restart of the bar — which is what you want from
// a switch you left on, and the tile is there to say it is still on.
export function dontDisturb(): Accessor<boolean> {
  return createBinding(notifd(), "dontDisturb")
}

export function toggleDontDisturb(): void {
  const daemon = notifd()
  daemon.dontDisturb = !daemon.dontDisturb

  // Turning it on clears the screen now, as in the design — the point of the
  // switch is the quiet it brings, not the quiet after the next arrival.
  if (daemon.dontDisturb) toastStack().clear()
}

// Newest first, which is the order both the toasts and the list read in. The
// daemon keeps them in a hash table, so its own order is arbitrary — and the
// timestamps are whole seconds, which a burst from one app shares, hence the id
// as the tie-break: it only ever counts up.
export function notifications(): Accessor<Notification[]> {
  return createBinding(notifd(), "notifications").as((list) =>
    [...list].sort((a, b) => b.time - a.time || b.id - a.id),
  )
}

export function notificationCount(): Accessor<number> {
  return notifications().as((list) => list.length)
}

export function dismissAll(): void {
  // A copy first: dismissing rewrites the daemon's own list.
  for (const n of [...notifd().get_notifications()]) n.dismiss()
}

// The buttons a toast offers. "default" is the click-the-body action of the
// spec, which this bar has no gesture for, so it never becomes a button.
export function notificationActions(n: Notification): AstalNotifd.Action[] {
  return n.actions.filter((action) => action.id !== "default").slice(0, 2)
}

// What goes in the disc. Neither field says which of the two it is: the spec's
// app_icon takes a name or a path, and libnotify has since moved to sending the
// icon as the `image-path` hint, which arrives here as `image` — so both are
// read as either, and whichever answers first wins.
function sources(n: Notification): string[] {
  return [n.image, n.appIcon, n.desktopEntry].filter((source) => !!source)
}

function localPath(source: string): string | null {
  if (source.startsWith("file://")) return GLib.filename_from_uri(source)[0]
  return source.startsWith("/") ? source : null
}

export function notificationImage(n: Notification): string | null {
  for (const source of sources(n)) {
    const path = localPath(source)
    if (path && GLib.file_test(path, GLib.FileTest.EXISTS)) return path
  }
  return null
}

// A name for the icon theme, which is also where the bar's own bell comes from
// when the sender named nothing it has.
export function notificationIconName(n: Notification): string | null {
  for (const source of sources(n)) {
    if (!localPath(source)) return source
  }
  return null
}

// One clock for every timestamp on screen, so the rows re-read together and the
// panel costs a single timer no matter how many notifications it holds.
const now = createPoll(unixNow(), 30_000, unixNow)

function unixNow(): number {
  return Math.floor(Date.now() / 1000)
}

function ago(seconds: number): string {
  if (seconds < 60) return t.notificationNow
  if (seconds < 3600) return t.notificationMinutes.replace("%d", String(Math.floor(seconds / 60)))
  if (seconds < 86_400) return t.notificationHours.replace("%d", String(Math.floor(seconds / 3600)))
  return t.notificationDays.replace("%d", String(Math.floor(seconds / 86_400)))
}

export function timeAgo(unix: number): Accessor<string> {
  return now.as((current) => ago(Math.max(0, current - unix)))
}

// How long a toast stays up. The sender's own timeout wins where it has one —
// it knows whether this is a chat message or a battery warning — and a critical
// notification never leaves on its own.
function holdFor(n: Notification): number {
  if (n.urgency === AstalNotifd.Urgency.CRITICAL) return 0
  return n.expireTimeout > 0 ? n.expireTimeout : getConfig().toastTimeout
}

interface ToastStack {
  list: Accessor<Notification[]>
  // Takes the cards off the screen without resolving anything: what they were
  // showing is still in the control centre's list.
  clear: () => void
}

// The toasts are their own list, not a window over the daemon's: a toast that
// times out only stops being shown, and the notification behind it stays in the
// control centre until something resolves it.
function createToasts(): ToastStack {
  const daemon = notifd()
  const [list, setList] = createState<Notification[]>([])
  const timers = new Map<number, Timer>()

  function drop(id: number) {
    timers.get(id)?.cancel()
    timers.delete(id)
  }

  function hide(id: number) {
    drop(id)
    setList((current) => current.filter((n) => n.id !== id))
  }

  function show(n: Notification) {
    setList((current) => {
      const next = [n, ...current.filter((other) => other.id !== n.id)]
      // The oldest goes when the stack is full, as in the design: three cards
      // is as far down the screen as this is allowed to reach.
      for (const gone of next.splice(getConfig().toastLimit)) drop(gone.id)
      return next
    })

    const hold = holdFor(n)
    if (hold > 0) timers.set(n.id, timeout(hold, () => hide(n.id)))
  }

  daemon.connect("notified", (_daemon, id) => {
    // Do-not-disturb silences the card, not the notification: it still arrives
    // in the list, which is where you go to find what you missed.
    if (daemon.dontDisturb) return
    const n = daemon.get_notification(id)
    if (n) show(n)
  })

  daemon.connect("resolved", (_daemon, id) => hide(id))

  return {
    list,
    clear() {
      for (const n of list.get()) drop(n.id)
      setList([])
    },
  }
}

let stack: ToastStack | null = null

// One stack for the whole session, however many monitors ask for it.
function toastStack(): ToastStack {
  if (!stack) stack = createToasts()
  return stack
}

export function toasts(): Accessor<Notification[]> {
  return toastStack().list
}
