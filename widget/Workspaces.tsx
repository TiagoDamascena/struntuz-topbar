import { Gtk } from "ags/gtk4"
import { createBinding, createComputed, createConnection } from "ags"
import AstalHyprland from "gi://AstalHyprland"

// A fixed 1..9, like the waybar this replaces does with persistent-workspaces:
// the row keeps its width instead of reflowing as workspaces come and go.
const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export default function Workspaces() {
  const hypr = AstalHyprland.get_default()

  const occupied = () =>
    new Set(hypr.get_workspaces().filter((ws) => ws.clients.length > 0).map((ws) => ws.id))

  // Occupancy follows the clients rather than the workspace list: an empty
  // workspace reads the same whether Hyprland still holds it or dropped it.
  const busy = createConnection(
    occupied(),
    [hypr, "client-added", occupied],
    [hypr, "client-removed", occupied],
    [hypr, "client-moved", occupied],
  )

  const focused = createBinding(hypr, "focusedWorkspace")

  return (
    <box class="pill workspaces" spacing={7} valign={Gtk.Align.CENTER}>
      {SLOTS.map((n) => (
        <button
          class={createComputed([focused, busy], (active, filled) =>
            active?.id === n ? "dot active" : filled.has(n) ? "dot occupied" : "dot empty",
          )}
          tooltipText={`Workspace ${n}`}
          valign={Gtk.Align.CENTER}
          onClicked={() => hypr.dispatch("workspace", String(n))}
        />
      ))}
    </box>
  )
}
