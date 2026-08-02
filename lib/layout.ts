// Where the bar sits and where everything that hangs off it starts. The panels
// and the toasts are in windows that ignore the exclusive zone, so they are
// positioned from the top of the output rather than from under the bar — which
// means their offset is only ever the bar's own margin plus its height plus a
// gap, and a change to the bar that did not reach here would leave them behind.

// The stylesheet's `$pill-height`. A pill sizes itself and the window takes
// whatever the tallest one measures, so nothing here sets it — but `PANEL_TOP`
// has to know it, and the two are the same number written twice.
const BAR_HEIGHT = 40

export const BAR_TOP = 10

// The compositor's own gap, so the pills end where the windows do. Hyprland
// draws a window's border outside the box it reports, which puts the visible
// edge of a tiled window at `gaps_out` from the output — and a pill has no
// border outside its own box to make up the difference.
export const BAR_SIDE = 10

// Tighter than the gap the compositor leaves between windows: a panel is not
// another window beside the bar, it is what the bar opened, and the distance is
// what says so.
export const PANEL_GAP = 8

export const PANEL_TOP = BAR_TOP + BAR_HEIGHT + PANEL_GAP

export const PANEL_SIDE = BAR_SIDE
