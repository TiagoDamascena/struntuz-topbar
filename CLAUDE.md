# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Wayland top bar built with AGS 3.x (TypeScript + GTK4), replacing waybar on
Hyprland. Same stack as its sibling `struntuz-greet`. It ships as a Nix flake
exposing the package; there is no NixOS/home-manager module yet.

## Commands

```bash
nix develop        # dev shell; shellHook repoints node_modules/{ags,gnim} symlinks and generates @girs on first entry
ags run app.ts     # run against the live compositor
ags quit -i struntuz-topbar   # stop it — the window is undecorated, so there is nothing to click
nix build          # build the package (bundles via `ags bundle app.ts ... --gtk 4`)
nix fmt flake.nix  # format Nix (nixfmt-rfc-style; it takes paths — bare `nix fmt` reads stdin and errors)
rm -rf @girs && ags types -d .   # regenerate stale GObject-introspection types after `nix flake update`
```

There is no test suite. Validation is manual (`ags run`) plus a typecheck, which
needs its own typescript since none is vendored:

```bash
nix run nixpkgs#typescript -- --noEmit -p .
```

Only errors in this repo's own files count — AGS ships its `lib/` and gnim as
`.ts` sources, so `skipLibCheck` does not silence them and they report missing
`gi://Astal*` modules for every Astal library not in `astalLibsFor`.

## Architecture

Entry is `app.ts` → `app.start` renders one `Bar` window per monitor.
`widget/Bar.tsx` is the bar itself; anything that talks to a data source belongs
in a `lib/` module with no UI, as in the greeter.

`flake.nix`'s `astalLibsFor` is the single list of Astal libraries, feeding both
the package build and the dev shell. It currently carries `io`, `astal4`,
`hyprland`, `tray`, `mpris`, `network`, `wireplumber` and `battery` — the sources
behind the waybar setup this replaces. Adding one there also means regenerating
`@girs`.

### Non-obvious constraints

- **AGS 3.x API, not Astal v2.** Import from `ags`, `ags/gtk4`, `ags/gtk4/app`,
  `ags/time`, `ags/file`. Reactivity is `createState`/`createPoll`/`Accessor.as(...)`
  — **not** `Variable`/`bind`.
- **Do not enable `experimentalDecorators`** in tsconfig. gnim uses TC39 decorators
  with metadata; the legacy mode breaks AGS's D-Bus (`TypeError: meta is undefined`).
  `skipLibCheck: true` is required to silence gtk3-vs-gtk4 duplicate types in `@girs`.
- **The frost glass is `backdrop-filter: blur()`**, which GTK4 only gained in
  4.20 — on an older GTK the bar silently falls back to flat transparency.
- Monitors are enumerated once in `main()`, so hotplugged outputs get no bar
  until the process restarts.
- `node_modules/` and `@girs/` are gitignored and reconstructed by the dev shell.

## Code style

Minimal comments — only when essential, and in English. Docs (README) in English and
lean. UI strings are separate from comments; don't translate them unless asked.
