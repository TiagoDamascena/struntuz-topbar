import { Accessor, createConnection } from "ags"
import { execAsync } from "ags/process"
import AstalHyprland from "gi://AstalHyprland"
import { getConfig, type PowerCommands } from "./config"
import { Icons } from "./icons"
import { t } from "./i18n"

export type PowerAction = keyof PowerCommands

export interface PowerItem {
  action: PowerAction
  icon: string
  label: string
  // What the action costs, under the label. Only the one that depends on the
  // session is reactive; the rest never change.
  meta: string | Accessor<string>
}

// How many windows the session takes with it. The design says "3 apps"; windows
// are what Hyprland can actually count, and one app can hold several.
function windowCount(): Accessor<string> {
  const hypr = AstalHyprland.get_default()
  const count = () => hypr.get_clients().length

  return createConnection(
    count(),
    [hypr, "client-added", count],
    [hypr, "client-removed", count],
  ).as((n) => (n === 1 ? t.powerLogoutMetaOne : t.powerLogoutMeta.replace("%d", String(n))))
}

// Design order: least destructive first, so the reflex click at the top is the
// harmless one and shutting down takes the longest reach.
export function powerItems(): PowerItem[] {
  return [
    { action: "lock", icon: Icons.lock, label: t.powerLock, meta: t.powerLockMeta },
    { action: "suspend", icon: Icons.suspend, label: t.powerSuspend, meta: t.powerSuspendMeta },
    { action: "logout", icon: Icons.logout, label: t.powerLogout, meta: windowCount() },
    { action: "restart", icon: Icons.restart, label: t.powerRestart, meta: t.powerRestartMeta },
    { action: "shutdown", icon: Icons.power, label: t.powerShutdown, meta: t.powerShutdownMeta },
  ]
}

// Through a shell, so a configured command can be a pipeline and not only a
// program with arguments.
export function runPower(action: PowerAction): void {
  const command = getConfig().powerCommands[action]
  if (!command) return

  execAsync(["sh", "-c", command]).catch((err) => {
    console.warn(`struntuz-topbar: ${action} failed (${command}): ${err}`)
  })
}
