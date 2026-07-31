# struntuz-topbar

A Wayland top bar built with [AGS/Astal](https://aylur.github.io/ags/) (TypeScript
+ GTK4), meant to replace waybar on Hyprland. Same stack as
[struntuz-greet](https://github.com/tiagodamascena/struntuz-greet) and it ships as
a flake.

At this point the bar carries the workspace selector, the clock, the control
centre and the notifications; the rest of the design follows one item at a time.

Workspaces are a fixed 1–9, as the waybar this replaces shows them, and keep that
bar's Catppuccin colours per state: mauve for the focused one, subtext0 where
windows are open, surface1 for the empty ones and pink on hover. The focused dot
stretches into a bar, and the change is animated.

## Control centre

The button at the right end of the bar drops a panel below it. It carries the
user pill for now — avatar, name, and the battery, or `user@host` on a machine
without one — and the power button on it opens the power menu: lock, suspend,
log out, restart, shut down.

The avatar is the picture at `~/.face`, cropped to a centred square and rounded
off. Without one it falls back to the initial of the name, as the design draws
it; a file that is missing or unreadable is never an error.

The panel is a window of its own, covering the whole output: the empty part of
it is what catches the click that dismisses it, so anywhere outside the panel
closes it, as does <kbd>Esc</kbd> once the window has the keyboard. Each monitor
gets its own, opened by its own bar.

Each entry runs a shell command from `powerCommands` (see below), so what
"lock" means is the session's business and not the bar's.

Under the user pill is the notification list, described next.

## Notifications

The bar is the session's notification daemon. It takes
`org.freedesktop.Notifications` on startup, which means **swaync, dunst, mako
and the rest cannot run beside it** — whoever gets the name first keeps it, and
the other one sits there receiving nothing. On NixOS that usually means turning
the old one off in the same commit:

```nix
services.swaync.enable = false;
```

A D-Bus-activated daemon is also worth checking: with a `.service` file naming
`org.freedesktop.Notifications`, stopping the unit is not enough, since the next
notification starts it again. The bar holding the name is what keeps that from
happening, so start it before anything sends one.

What arrives shows up twice. A card slides into the top right corner for as long
as its sender asked for, or `toastTimeout` when it asked for nothing; a critical
one stays until it is dealt with. At most `toastLimit` cards stack up, newest on
top, and the oldest leaves early to make room. The buttons on a card are the
actions the sender offered, the first one marked as the one it expects; the
cross closes the notification for good.

A card that simply runs out of time is not the same as one that was dismissed:
the first only stops being shown, and the notification stays in the control
centre's list — newest first, with the app's own icon where it sent one and the
bar's bell where it did not. `Clear all` empties it, and the count rides on the
control centre's button in the bar. Nothing expires on its own, so the list is
what was missed rather than what happened to be on screen recently.

Do-not-disturb (Astal's `dont-disturb`, shared with any other astal-notifd
front end) silences the cards only; those notifications still land in the list.
There is no toggle for it in the bar yet.

The cards live in a third window with a namespace of its own, so blurring them
takes a third layerrule (see below).

## Blur

The pills are meant to sit on a blurred backdrop, and that blur is the
compositor's job: the bar's window is transparent, so GTK's own
`backdrop-filter` would have nothing beneath it to blur. On Hyprland, match the
layer namespace:

```
layerrule {
  name=struntuz-topbar-blur
  blur=on
  ignore_alpha=0
  match:namespace=struntuz-topbar
}
```

Or, with home-manager's `wayland.windowManager.hyprland.settings`:

```nix
layerrule = [
  {
    name = "struntuz-topbar-blur";
    blur = "on";
    ignore_alpha = 0;
    "match:namespace" = "struntuz-topbar";
  }
];
```

Either way it matches the window's `namespace`, so changing that in
`widget/Bar.tsx` means changing it here too. Without the rule the pills still
render, just flat over the wallpaper. To try it before committing to a rebuild,
`hyprctl keyword layerrule blur,struntuz-topbar` applies it until the next
`hyprctl reload`.

The control centre is a second window with its own namespace, and it needs its
own rule — the same shape as the one above:

```
layerrule {
  name=struntuz-control-center-blur
  blur=on
  ignore_alpha=0
  match:namespace=struntuz-control-center
}
```

The toasts are a third window, and take the same rule again on
`struntuz-toasts`:

```
layerrule {
  name=struntuz-toasts-blur
  blur=on
  ignore_alpha=0
  match:namespace=struntuz-toasts
}
```

`ignore_alpha` matters more on the control centre than it does on the bar, and
it has to stay at `0`. Hyprland reads it as "skip the pixels at or below this alpha", so `0` is
already what keeps the blur to the panels: this window covers the whole output,
and everything outside the panels is fully transparent (verified — the desktop
behind it stays sharp). Anything higher starts eating the panels themselves,
and at `1` nothing is opaque enough to survive, so the blur disappears
entirely.

## Configuration

The bar reads `$XDG_CONFIG_HOME/struntuz-topbar/config.json` (usually
`~/.config/struntuz-topbar/config.json`). Every key is optional and falls back to
the default below; unknown keys are ignored. An unreadable or invalid file is
never fatal — the bar warns on stderr and uses the defaults.

```json
{
  "language": "",
  "dateFormat": "",
  "clockFormat": "%H:%M",
  "userName": "",
  "userAvatar": "",
  "toastTimeout": 6800,
  "toastLimit": 3,
  "powerCommands": {
    "lock": "loginctl lock-session",
    "suspend": "systemctl suspend",
    "logout": "hyprctl dispatch exit",
    "restart": "systemctl reboot",
    "shutdown": "systemctl poweroff"
  }
}
```

- `language` — language of the bar's own patterns and strings: `en`, `pt-BR`, or
  empty (the default) to follow the session's locale, read from `LC_ALL`, then
  `LC_TIME`, then `LANG`. An unknown value falls back to English with a warning.
- `dateFormat` — the date beside the clock, as accepted by `g_date_time_format`.
  Empty (the default) takes the pattern `language` carries: the locale translates
  the month and weekday names, but not the order they go in, so English gets
  `%a, %b %-d` ("Thu, Jul 30") and pt-BR `%a, %-d de %b` ("qui, 30 de jul").
- `clockFormat` — the time, same format strings.
- `userName` — the name on the control centre's user pill, and the initial its
  avatar falls back to. Empty (the default) takes the account's real name, then
  its login.
- `userAvatar` — the picture on that avatar, any format GdkPixbuf reads. Empty
  (the default) is `~/.face`; `~/` is expanded. Point it anywhere, or at nothing
  at all to keep the initial.
- `toastTimeout` — how long a notification card stays up, in milliseconds, when
  its sender asked for no timeout of its own. A sender that asked for one gets
  it; a critical notification ignores both and stays.
- `toastLimit` — how many cards may stack up before the oldest one leaves. It
  only leaves the screen: it is still in the control centre's list.
- `powerCommands` — one shell command per entry of the power menu, each merged on
  its own. `lock` goes through logind so whatever holds the session's lock handle
  answers it; `logout` is Hyprland's own exit, which leaves the teardown to
  whatever supervises the session. Under uwsm, `uwsm stop` is the tidier logout.

Set `STRUNTUZ_TOPBAR_CONFIG` to read a config from somewhere else — handy for
iterating without touching `~/.config`:

```bash
STRUNTUZ_TOPBAR_CONFIG=./config.json ags run app.ts
```

## Development

Enter the dev shell. Its `shellHook` creates the `node_modules/ags` and
`node_modules/gnim` symlinks (so the editor resolves imports) and generates
`@girs` on first run:

```bash
nix develop
```

Run it against the live compositor — it takes an exclusive zone at the top, next
to whatever bar is already there:

```bash
ags run app.ts
```

Quit it by name (it has no decorations):

```bash
ags quit -i struntuz-topbar
```

Build the package:

```bash
nix build
```

After `nix flake update`, re-enter the dev shell to repoint the symlinks; refresh
stale types with `rm -rf @girs && ags types -d .`.

## Icons

`icons/` holds the bar's symbolic SVGs — Apple's SF Symbols, matching the rest of
the desktop, plus the bell and the cross, which are drawn to the same canvas and
stroke because the set has no equivalent that could be exported. They are
bundled into the binary and written back out to
`$XDG_CACHE_HOME/struntuz-topbar/icons` at startup, because GTK only recolours an
icon it loaded itself from a file whose name ends in `-symbolic.svg`. Nothing
else has to change to replace one: overwrite the file and restart.

SF Symbols are Apple's, licensed for use on their platforms and not for
redistribution, so they are a poor fit for a public repository however well they
suit the design.

Two things have to hold for a file in there:

- **Filled shapes only** — `path`, `rect` or `circle`. GTK recolours a symbolic
  icon by forcing `fill` on exactly those three, so a stroked outline comes out
  as a solid blob and anything else (`line`, `polygon`, `ellipse`) keeps whatever
  colour it was drawn with. SF Symbols exports are outlines already; strip the
  guide and note layers the app adds.
- **A shared 24×24 viewBox**, with each symbol's own scale kept and its ink
  centred on 12,12. An SF Symbols export is trimmed to its own bounds, and those
  differ per symbol — a chevron is 11×20 where a power glyph is 24×25.
  Normalising each to its own square would render them all at the same size and
  undo the size relationships the set is drawn with; a common canvas keeps them.
  `pixelSize` counts that box and not the glyph, so padding inside it is a
  silent downscale of everything drawn there.

## Astal modules

`flake.nix` seeds `astalLibsFor` with the libraries behind the current waybar
setup, plus `notifd` for the notifications: `io`, `astal4`, `hyprland`,
`notifd`, `tray`, `mpris`, `network`, `wireplumber` and `battery`. Adding or removing one there covers both the package build and the dev
shell; regenerate `@girs` afterwards so the types follow.

## Install on NixOS

There is no NixOS/home-manager module yet. The flake exposes the package, so it
can be added to `home.packages` (or `environment.systemPackages`) and started by
the compositor:

```nix
{
  inputs.struntuz-topbar.url = "github:tiagodamascena/struntuz-topbar";
}
```

```
exec-once = struntuz-topbar
```
