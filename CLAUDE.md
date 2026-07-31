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
- **`lib/icons.ts`** — the bar's own symbolic SVGs, `inline:`-bundled from `icons/`
  and written back to `$XDG_CACHE_HOME/struntuz-topbar/icons` at startup, then
  registered with `Gtk.IconTheme.add_search_path`. Widgets only ever see a name.
- **`lib/session.ts`** / **`lib/power.ts`** — who is logged in and what the power
  menu can do to that session. The actions are shell commands from the config,
  not calls: what "lock" means belongs to the session, not to a bar.

The design is a Claude Design project ("Interface Linux minimalista roxa",
`Desktop Nocturne v3.dc.html`), read through the DesignSync tool. Its top bar is a
transparent 44px strip of independent floating pills, not one continuous bar —
hence the shared `.pill` class in `style.scss`.

The bar it replaces is the user's waybar (`~/.config/waybar/`), and that is the
other source: `widget/Workspaces.tsx` takes its shape from the design (a dot per
workspace, the focused one stretched to 26px) and its state colours from waybar's
Catppuccin palette, since those are the ones already learned. Check waybar's
`config` and `style.css` before inventing behaviour for a new item — but check
the pair's contrast too: waybar's own occupied/empty colours are 1.73:1, which
carries on a numeral and disappears on an 8px dot.

**GTK4 does animate `min-width`**, so the focused dot grows into its bar through
a CSS `transition` rather than any widget code (measured: 19 → 26px across the
frames after a switch). Worth remembering for the items still to come.

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
- **GTK recolours a symbolic icon by forcing `fill` on `rect`, `circle` and
  `path` — nothing else.** So an icon in `icons/` has to be filled shapes: a
  stroked outline fills into a blob, and a `line`/`polygon`/`ellipse` keeps the
  colour it was drawn with. It also only recolours what it loaded itself from a
  file ending in `-symbolic.svg`, which is why the SVGs cannot stay strings —
  hence the write-to-cache in `lib/icons.ts`. A search path is scanned for loose
  icons as well as for themes, so that flat directory needs no `index.theme`.
- **The icons are SF Symbols on a shared 24×24 viewBox, and `pixelSize` counts the
  box, not the glyph.** They were on 28×28 first, with each trimmed export centred
  by moving the viewBox, because the widest one (the logout arrow) measured 27.3
  units. That padding is a hidden downscale: `pixelSize=19` drew the lock at
  15.6px and the chevron at 13.8px. Re-exported into 24 the whole set gained ~17%
  at the same `pixelSize` — measured in fully opaque pixels at 19px, the lock went
  6 → 29, the moon 8 → 24, the switches 65 → 93. The three that had to be rescaled
  to fit (power, restart, logout) gained less, and the logout arrow lost (29 → 22)
  since it was the one the 28 box was sized for. Keep them centred on 12,12 and
  never rescale one alone: the set is drawn with its own size relationships.
  They are also Apple's and not redistributable, which is worth raising before
  this repo goes anywhere public.
- **A soft-looking icon here is sub-pixel geometry, not a rendering fault.** Cairo
  already antialiases by exact coverage — GTK's raster at 19px is within 2/255 of
  a 152px render downsampled 8×8, so there is nothing for a PNG (or for
  `gtk-encode-symbolic-svg`, which rasterizes the same SVG) to recover, and no
  hinting or antialiasing setting applies to icon rasterization. What decides
  legibility is how much clear space a stroke has, not how thick it is: the power
  ring reads well on a 1.07px stroke because it has 3.56px of space around it,
  while `switch.2` mushes because its capsule wall and knob sit 0.57px apart and
  merge. So a heavier SF Symbols weight helps the isolated-stroke glyphs and
  *hurts* the dense ones. The only other lever is physical pixels — the artwork
  assumes @2x, and at `scale 1` on 1080p there are half the pixels it expects.
- **`border-radius` clips a widget's background, not its content.** The avatar's
  picture is round because the `Gtk.Image` carries `overflow: HIDDEN`, which is
  what makes GTK4 clip a widget to its own rounded box. And a `Gtk.Image` scales
  a paintable to *fit*, so the texture has to arrive square or it letterboxes
  inside the circle — `lib/session.ts` crops it before it reaches a widget.
  `Gtk.Picture` with `contentFit: COVER` crops on its own but reports the image's
  intrinsic size as its natural size, which drags the pill out to the width of
  the photo; `pixelSize` on a `Gtk.Image` pins the measurement instead.
- **The control centre's window covers the whole output.** The empty part of it
  is the click-away target (`Gtk.Overlay`: scrim below, panel above, and GTK4
  picks the overlay child first, so a click on the panel never reaches the
  scrim). It also means a second Hyprland `layerrule`, on its own namespace.
  Keep that rule's `ignore_alpha` at `0`: Hyprland skips the pixels *at or
  below* it, so `0` already spares the transparent scrim (verified — the desktop
  behind the open panel stays sharp), while anything higher eats into the panels
  and `1` kills the blur outright, since nothing here is fully opaque.
- **A new source file must be `git add`ed before `nix build` sees it.** `src = ./.`
  on a flake only picks up files git knows about; an untracked widget fails the
  bundle with `Could not resolve`. The same goes for anything under `icons/`.
- Monitors are enumerated once in `main()`, so hotplugged outputs get no bar
  until the process restarts.
- `node_modules/` and `@girs/` are gitignored and reconstructed by the dev shell.

## Code style

Minimal comments — only when essential, and in English. Docs (README) in English and
lean. UI strings are separate from comments; don't translate them unless asked.
