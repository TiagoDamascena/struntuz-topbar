# struntuz-topbar

A Wayland top bar built with [AGS/Astal](https://aylur.github.io/ags/) (TypeScript
+ GTK4), meant to replace waybar on Hyprland. Same stack as
[struntuz-greet](https://github.com/tiagodamascena/struntuz-greet) and it ships as
a flake.

At this point the bar carries the clock only; the rest of the design follows one
item at a time.

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

## Configuration

The bar reads `$XDG_CONFIG_HOME/struntuz-topbar/config.json` (usually
`~/.config/struntuz-topbar/config.json`). Every key is optional and falls back to
the default below; unknown keys are ignored. An unreadable or invalid file is
never fatal — the bar warns on stderr and uses the defaults.

```json
{
  "language": "",
  "dateFormat": "",
  "clockFormat": "%H:%M"
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

## Astal modules

`flake.nix` seeds `astalLibsFor` with the libraries behind the current waybar
setup: `io`, `astal4`, `hyprland`, `tray`, `mpris`, `network`, `wireplumber` and
`battery`. Adding or removing one there covers both the package build and the dev
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
