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
`widget/Bar.tsx` only places the layer-shell window and slots items into a
`centerbox`; each item is its own component (`widget/Clock.tsx`, …). Anything
that talks to a data source belongs in a `lib/` module with no UI, as in the
greeter.

- **`lib/config.ts`** — the single source of runtime settings, read from
  `$STRUNTUZ_TOPBAR_CONFIG`, else `$XDG_CONFIG_HOME/struntuz-topbar/config.json`,
  else built-in defaults. Merged per key, so an invalid value costs only its own
  key. Everything tunable goes here — don't add env vars or new hardcoded paths.
- **`lib/i18n.ts`** — one full `Strings` table per language plus a `CATALOG` keyed
  by language tag. English is the base and every other table is a `Partial`, so a
  missing key falls back to English instead of rendering blank. Resolution
  normalizes the tag (`pt_BR.UTF-8` → `pt-br`) and retries on the primary subtag.
  It carries `dateFormat`: the locale translates the month and weekday names, but
  the order they go in is the language's, so each table brings its own pattern and
  an empty `config.dateFormat` means "use it". An empty `config.language` follows
  the session locale (`LC_ALL`, then `LC_TIME`, then `LANG`) — dates are formatted
  under `LC_TIME`, which is why it outranks `LANG` here.

The design is a Claude Design project ("Interface Linux minimalista roxa",
`Desktop Nocturne v3.dc.html`), read through the DesignSync tool. Its top bar is a
transparent 44px strip of independent floating pills, not one continuous bar —
hence the shared `.pill` class in `style.scss`.

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
- **The blur behind the pills is the compositor's, not GTK's.** `backdrop-filter`
  blurs what is painted below it inside the same window; the bar's window is
  transparent, so the property is inert here (verified: it was in the CSS and
  nothing blurred). The greeter can use it because its window paints the
  wallpaper itself. On Hyprland it takes a `layerrule` matching
  `namespace=struntuz-topbar` — hence `namespace` on the window is load-bearing,
  not decoration.
- **GTK sizes `min-height` against the content box**, so a 1px border adds on top
  of it, while the design's CSS counts the border inside its 44px. `.pill`
  subtracts the edge; measure with `hyprctl layers -j` after changing it.
- **Labels of different font sizes don't share a baseline.** Each centres its own
  line box, so 16px beside 17px lands the baselines a pixel apart and reads as
  crooked; `valign`/`baselinePosition` do not fix it (verified on all four
  combinations). Prefer one size per row and carry hierarchy with weight and
  opacity, as `.clock` does — the design's own 1px size steps buy no hierarchy at
  this scale. Check it by screenshotting with `grim` and comparing the bottom row
  of non-descending glyphs, not the ink extents — `q`, `j` and `,` descend and
  make the two runs look further apart than they are.
- **A new source file must be `git add`ed before `nix build` sees it.** `src = ./.`
  on a flake only picks up files git knows about; an untracked widget fails the
  bundle with `Could not resolve`.
- Monitors are enumerated once in `main()`, so hotplugged outputs get no bar
  until the process restarts.
- `node_modules/` and `@girs/` are gitignored and reconstructed by the dev shell.

## Code style

Minimal comments — only when essential, and in English. Docs (README) in English and
lean. UI strings are separate from comments; don't translate them unless asked.
