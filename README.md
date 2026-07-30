# struntuz-topbar

A Wayland top bar built with [AGS/Astal](https://aylur.github.io/ags/) (TypeScript
+ GTK4), meant to replace waybar on Hyprland. Same stack as
[struntuz-greet](https://github.com/tiagodamascena/struntuz-greet) and it ships as
a flake.

At this point it is the stack scaffold only: one layer-shell window per monitor
with a clock in the middle.

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
