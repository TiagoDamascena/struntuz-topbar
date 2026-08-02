# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Wayland top bar built with AGS 3.x (TypeScript + GTK4), replacing waybar on
Hyprland. Same stack as its sibling `struntuz-greet`. It ships as a Nix flake
exposing the package and `homeModules.default`.

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

- **`lib/layout.ts`** — where the bar sits and where everything hanging off it
  starts. The control centre and the toasts are in windows that ignore the
  exclusive zone, so they are placed from the top of the *output* and their
  offset is only ever the bar's margin plus its height plus a gap — three
  numbers that used to be written out per window and drifted the moment the bar
  moved. The side margin is the compositor's own `gaps_out` (10 here): Hyprland
  draws a window's border outside the box it reports, so a tiled window's
  visible edge is at `gaps_out` from the output, and a pill has no border
  outside its box to make up a difference. Not in `lib/config.ts` yet, so a
  setup with other gaps has to edit this.
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
- **`lib/notifications.ts`** — the daemon side of the notifications. `AstalNotifd`
  owns `org.freedesktop.Notifications`, so running this bar means no swaync/dunst
  beside it (notifd falls back to proxying a foreign daemon and receives
  nothing). It sets `ignoreTimeout` at startup — otherwise the daemon resolves
  each notification when its sender's timeout runs out and the control centre's
  list empties itself seconds after every arrival. The toasts therefore keep
  their own timers and their own list: a card that times out only stops being
  shown, and only `dismiss()` takes the notification out of the list. The
  daemon's list is a hash table with second-resolution timestamps, so sorting it
  needs the id as a tie-break. Do-not-disturb is the daemon's `dontDisturb`
  rather than a state of this module's, so a notification that arrives with
  nothing on screen is silenced by the same value the tile reads. Clicking a
  card or a row invokes the spec's `default` action, which is the whole of what
  a daemon can do about "go to the application": invoking only tells the sender,
  and raising the window or opening the tab is the sender's. The daemon resolves
  an invoked notification itself unless it is `resident` (astal's
  `notifd/src/daemon.vala`), so only a click with nothing to invoke has to
  dismiss by hand — and only an invoked one closes the control centre, since
  only then is something coming to the front of it. Invoking is not enough on
  its own, though: see the activation token below.
- **`lib/nightlight.ts`** — the blue light filter, as shell commands from the
  config rather than calls, for the same reason `lib/power.ts` is: hyprsunset
  answers by default and gammastep would do as well. What it keeps is the
  temperature the display is believed to be at, not an on/off of its own — the
  tile writes that number under its label, which is only worth doing if it is
  the real one. So the `status` command is read at startup and every time the
  control centre opens, and the toggle moves the state before the command
  answers and lets the read back correct it. Which is also why `off` sets
  `neutral` instead of hyprsunset's `identity`: `identity` is the exact off, but
  `hyprctl hyprsunset temperature` keeps reporting the temperature from before
  it (verified — 3400 after an `identity`), so the read back would turn every
  off straight back into an on. `%d` is the temperature the command has to leave
  the display at, which is what lets both commands be the same one.
- **`lib/audio.ts`** — the bar's audio segment, the volume bar and its menu, over
  `AstalWp`. It holds no endpoint: the default speaker is replaced when headphones go in and when the
  menu picks another one, so every reading goes through whichever is default at
  the time (`fromSpeaker`, a computed that re-subscribes when the default
  changes). The level it reports is 0 while muted — what is drawn is what you
  would hear — but muting never writes the volume, which is why the widget
  listens on `change-value` and not on the value itself. Volume is wireplumber's
  cubic scale, not linear amplitude. Wireplumber may be absent altogether, so
  `hasAudio()` is what the widgets check before rendering anything, and
  `volumeIcon` is what picks the glyph, since the speaker is a ramp (below).
  Which panel the control centre comes down on lives in `widget/Bar.tsx`, not in
  the window: `widget/Segments.tsx` is the design's one round button per source,
  and a segment both opens the panel onto its own sub-panel and stays lit while
  that one is showing, which it cannot do from below. The toggle beside it is
  lit only on the main view for the same reason — two lit buttons would read as
  two things being open. Both live in one capsule, `widget/Controls.tsx`: the
  design draws them as two pills and the user asked for one, since everything in
  there opens the same panel and two capsules said they were two places to go.
  That file owns the badge as well, because the toggle is the last thing in the
  pill and so the pill's own top-right corner is the toggle's.
- **`lib/tray.ts`** — the system tray, over `AstalTray`. Not the exclusive claim
  the notification daemon is: astal takes `org.kde.StatusNotifierWatcher` when the
  name is free and proxies whoever holds it otherwise, so another bar's tray runs
  beside this one. What the module owes the widget is an order and a status: the
  items come out of a hash table, as notifd's notifications do, so they are sorted
  by `itemId` (bus name plus object path) or the icons reshuffle on every arrival,
  and `PASSIVE` is filtered out because that is what the status means. The status
  is read through a binding of its own per item, since the tray notifies `items`
  on arrival and departure and never when one of them changes its mind — the same
  re-subscribing computed `fromSpeaker` is in `lib/audio.ts`. The widget is
  `widget/Tray.tsx`, and the three buttons it answers are the spec's:
  `Activate`, the menu, `SecondaryActivate`.
- **`lib/image.ts`** — one crop, shared by every round picture in the bar: the
  centred square a `Gtk.Image` needs before a `border-radius` can read as a
  circle.
- **`lib/session.ts`** / **`lib/power.ts`** — who is logged in and what the power
  menu can do to that session. The actions are shell commands from the config,
  not calls: what "lock" means belongs to the session, not to a bar.
- **`nix/module.nix`** — the home-manager module, mirroring the greeter's
  `nix/module.nix` in shape (an option per config key over a `freeformType`, so
  a key this module has not caught up with still reaches the JSON). It is
  home-manager's and not NixOS's because everything the bar touches is the
  user's: `$XDG_CONFIG_HOME` for the config, `~/.face` for the avatar, and a
  *user* unit under the compositor. The greeter is a NixOS module for the
  mirror reason — greetd runs before anyone has logged in. Every option added
  to `lib/config.ts` wants one here and a paragraph in the README.

The design is a Claude Design project ("Interface Linux minimalista roxa",
`Desktop Nocturne v3.dc.html`), read through the DesignSync tool. Its top bar is a
transparent 44px strip of independent floating pills, not one continuous bar —
hence the shared `.pill` class in `style.scss`.

**The bar is drawn a step below the design's own scale.** `$pill-height` is 40
where the design says 44, and every size in the stylesheet was moved with it —
44px of bar on a 1080p output reads as a band rather than as something to glance
at. So a number taken from the design has to be brought down before it is used,
and the ratios are what to preserve, not the values: the panel column is 400 and
not 452, a tile is 56 and not 72, the type runs 12–15 where the design runs
13–17. `lib/layout.ts` carries `$pill-height` a second time, since the windows
that hang under the bar are placed from the top of the output.

The height went to 36 first and came back up, which is worth knowing before
taking it down again: 36 is small enough that a round button in the pill has no
room left around its glyph, and no amount of padding gives it back (see the
concentricity note below). 40 is where the ends of the pill and the gap between
two glyphs measure the same, at 12–14px.

The panel rules are one `@mixin rule` in `style.scss` and not a gradient per
head. They were written out three times and the audio menu's had drifted into a
different line — solid at one end where the heads fade at both, and stopping
10px short of where a head's does, because it sat inside a padding the heads
did not have.

The bar it replaces is the user's waybar (`~/.config/waybar/`), and that is the
other source: `widget/Workspaces.tsx` takes its shape from the design (a dot per
workspace, the focused one stretched into a bar) and its state colours from waybar's
Catppuccin palette, since those are the ones already learned. Check waybar's
`config` and `style.css` before inventing behaviour for a new item — but check
the pair's contrast too: waybar's own occupied/empty colours are 1.73:1, which
carries on a numeral and disappears on an 8px dot.

**GTK4 does animate `min-width`**, so the focused dot grows into its bar through
a CSS `transition` rather than any widget code (measured: 19 → 26px across the
frames after a switch). Worth remembering for the items still to come.

`flake.nix`'s `astalLibsFor` is the single list of Astal libraries, feeding both
the package build and the dev shell. It currently carries `io`, `astal4`,
`hyprland`, `notifd`, `tray`, `mpris`, `network`, `wireplumber` and `battery` —
the sources behind the waybar setup this replaces, plus the notification daemon. Adding one there also means regenerating
`@girs`.

### Non-obvious constraints

- **AGS 3.x API, not Astal v2.** Import from `ags`, `ags/gtk4`, `ags/gtk4/app`,
  `ags/time`, `ags/file`. Reactivity is `createState`/`createPoll`/`Accessor.as(...)`
  — **not** `Variable`/`bind`.
- **Do not enable `experimentalDecorators`** in tsconfig. gnim uses TC39 decorators
  with metadata; the legacy mode breaks AGS's D-Bus (`TypeError: meta is undefined`).
  `skipLibCheck: true` is required to silence gtk3-vs-gtk4 duplicate types in `@girs`.
- **Notifd's state outlives the process, in dconf.** `dont-disturb`,
  `ignore-timeout` and the notifications themselves are GSettings keys under
  `io.astal.notifd` — the property docs say `dont-disturb` is "merely a value
  shared between the daemon process and proxies", which reads as runtime-only and
  is not. So a `dontDisturb = true` left behind by a test run silences the *next*
  run too, with no toast, no badge and nothing in the log to say why. Read it back
  with `dconf read /io/astal/notifd/dont-disturb` before debugging anything about
  notifications not arriving, and reset with `dconf write … false`.
- **The blur behind the pills is the compositor's, not GTK's.** `backdrop-filter`
  blurs what is painted below it inside the same window; the bar's window is
  transparent, so the property is inert here (verified: it was in the CSS and
  nothing blurred). The greeter can use it because its window paints the
  wallpaper itself. On Hyprland it takes a `layerrule` matching
  `namespace=struntuz-topbar` — hence `namespace` on the window is load-bearing,
  not decoration.
- **GTK sizes `min-height` against the content box**, so a 1px border adds on top
  of it, while the design's CSS counts the border inside its height. `.pill`
  subtracts the edge; measure with `hyprctl layers -j` after changing it. Padding
  goes on top the same way, which is what turns a badge into a capsule: a
  `min-width` with 4px a side measures 8 wider and only the height stays, so
  anything that has to come out a circle carries no padding at all.
- **A round thing inside a capsule has to be concentric with the cap, not
  padded from the edge.** A capsule's end is an arc whose centre sits one radius
  in from the edge, so a disc is only evenly ringed when its own centre lands on
  that point — `padding-left = height/2 − disc/2 − border`. Pad it by eye
  instead and the ring comes out thinner top-to-bottom than it is at the far
  end, which is what "the border radius doesn't match the circle" looks like
  (the mute disc measured 3px against 5.5px, and the eye caught it before any
  measurement did). It also means **horizontal padding is not the lever for
  giving a round button more room** in a pill: padding only slides the button
  off the arc centre, and the clearance from the *glyph* to the edge works out
  to `height/2 − glyph/2` for any concentric button, whatever the padding and
  the button size are. So room comes from a smaller glyph or a taller pill, and
  nothing else — which is why fixing the disc's ring took `$pill-height` from 36
  to 40 and `.slider-pill` from 38 to 42 rather than another padding. Verified
  by measurement both times: the disc now sits at offset 0.0px with a 5px ring
  top, bottom and left. What the padding/button split *does* decide is how that
  fixed distance is divided between the inside of the lit circle and the ring
  around it — `.icon-pill` runs 4px against a 30px button, which puts 7–8px
  inside the circle and 5px outside. Growing the button also pushes the glyphs
  apart, so the gap between two of them in a pill (18px at 30) runs wider than
  the gap at the ends (11–14px); `spacing` on the box is the only trim for it.
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
- **A glyph wider than tall loses height, and the box cannot be widened to give
  it back.** Both halves measured through GTK's own path (`lookup_icon` →
  `snapshot_symbolic` → texture): a `viewBox="0 0 32 24"` renders 152×114 at
  `pixelSize` 152, because GTK loads a symbolic SVG with
  `preserve_aspect_ratio` into the square the size asks for — so a wide box is
  just the whole glyph drawn 24/32 smaller, the same hidden downscale the old
  28×28 padding was. And what sits outside the viewBox is clipped, not drawn
  (a rect from −4 to 28 came out exactly 24 wide). So a wide symbol has to be
  scaled to fit 24, and the height it loses comes back at the point of use, in
  `pixelSize`, not in the file: the speaker is 17.1 units tall of 24 where the
  bell is 24.0, so it is drawn at 20 in the mute disc, 18 in the audio rows and
  17 in the bar, against the 15–18 the rest of the set takes. Ink extents in units of 24, for
  the next one: bell 22.0×24.0, bell-slash 22.2×24.0, moon-stars 23.1×24.0,
  power 23.0×23.0, sliders 22.4×22.2, check 20.2×20.1, lock 16.0×23.0, back and
  forward 11.5×20.4 each, close 12.2×12.2. The volume ramp: speaker 12.0×17.1,
  low 16.6×17.1, medium 20.3×17.1, high 24.0×22.3, slash 18.4×18.6 — the cone is
  17.1 in the first three because it is the *same* cone at the same place on the
  shared canvas, so the ramp gains waves without the speaker moving or resizing.
  Only `high` breaks it, its outer wave reaching past the cone on both axes.
- **Outline in the panels, fill in the bar.** The user's rule: everything in the
  control centre is an outline variant (`bell`, `moon.stars`, `switch.2`), and a
  symbol that lands in the bar itself takes the filled one. A symbol needed in
  both places is two files, not one — which is why the volume ramp is ten files
  and `VolumeIcons` in `lib/icons.ts` has two of everything.
- **The speaker is a ramp, not an icon.** How many waves is how loud
  (`volumeIcon` in `lib/audio.ts`), stepped on the rounded percentage the label
  shows so the glyph and the number never disagree. `speaker.wave.1/2/3` are
  three steps where the design's own OSD had two, and the bare `speaker` is 0%.
  An audio *row* wears `wave.3`, the top of the ramp, and not the bare one it
  started on: a row is a device rather than a level, so it carries no level to
  read — and read as one anyway, the bare cone is the glyph for something
  silent, which is the one thing a device in that list never is. It is the cone
  that has to line up down a column of rows, so a row's `pixelSize` is stepped
  off the 17.1 units the cone fills and not off what `high` adds past it.
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
  inside the circle — `lib/image.ts` crops it before it reaches a widget, for
  the avatar and for the notification disc alike. Passing a path as `file` skips
  that crop, which is how the disc lost its circle the first time.
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
- **Invoking a notification's action raises nothing by itself — the application
  needs an xdg-activation token, and notifd never sends one.** On Wayland a
  window can only be raised, not raise itself, and what it asks with is a token
  minted by the surface the click landed on. Notifd *declares* the spec's
  `ActivationToken` signal and emits it nowhere (one hit in its source, the
  declaration), so `lib/notifications.ts` emits it by hand on `Gio.DBus.session`
  before invoking — it reaches the client as the daemon's own only because the
  daemon lives in this process and therefore owns the name on that same
  connection. The token comes from `Gdk.Display.get_app_launch_context()
  .get_startup_notify_id(null, [])`: GDK's Wayland path reads neither argument
  and mints against the seat's last implicit grab, which is the click itself
  (`gdk/wayland/gdkapplaunchcontext-wayland.c`), and GJS will not marshal a null
  file list. Verified end to end with `notify-send --wait -A default=… 
  --activation-token-fd`: empty before, a real token after.
  Then the compositor still has to agree. Hyprland's `CWindow::activate` marks
  the window urgent and returns unless `misc:focus_on_activate` is on
  (`src/desktop/view/Window.cpp`), which is off by default — so a correct click
  does visibly nothing until the user turns it on. It does *not* validate the
  token's serial or origin (`src/protocols/XDGActivation.cpp`), so one minted
  from a layer surface is as good as any. The README says all this under
  "Clicking a notification"; it is the user's config, not the bar's.
- **A GTK4 button claims the gesture sequence, so an ancestor's `GestureClick`
  never sees the click.** Which is what lets the notification card carry one
  gesture over the whole of itself, buttons and all: the ✕ and the action
  buttons stop the press before it bubbles up (verified on the toast and on the
  list row — the ✕ closes with `DISMISSED_BY_USER` and emits no `ActionInvoked`
  beside it). No need to fence a click target off from the buttons inside it.
- **`can-target: false` takes a widget's children with it.** `gtk_widget_pick`
  returns nothing for a widget that cannot be targeted and never looks inside
  it, so an overlay of type with a button in it is either all clickable or none
  of it. That is the shape of the volume bar: the scale is the overlay's main
  child, the type sits over it in a box that cannot be targeted — a press
  anywhere along the row reaches the scale under it — and the mute disc and the
  caret are overlay children of their own, aligned to the two ends so each takes
  only its own width. `gtk_widget_pick` also picks the overlay child over the
  main one, which is why those two ends are not draggable.
- **A `Gtk.Scale` is the whole capsule, not a control inside one.** The bar's
  fill is the scale's own `highlight` node with the theme's trough, handle and
  margins reset (`style.scss`), which is what buys the drag, the click-to-
  position and the scroll without a gesture of the bar's own. Two things follow:
  the handle needs `min-width: 0` or the fill stops that far short of both ends,
  and the highlight keeps the pill radius rather than the design's square right
  edge, since GTK does not clip a node to its parent's rounded box and the
  corner would sit outside the capsule at full volume. **`change-value` is the
  user's own** — `value-changed` and `notify::value` also fire for a
  programmatic move, so writing the volume from those feeds the reading back
  into the source it came from, and a bar drawing 0 because it is muted would
  write that 0 over the volume behind it.
- **A `scrolledwindow` takes its content through the `child` property, not as a
  JSX child.** gnim's generic append path ends in `vfunc_add_child`, which for a
  scrolled window parents the widget without telling it — GTK then measures a
  child it does not know it has, and the whole column it sits in comes out
  unallocated and invisible, with no warning anywhere. The `child` prop goes
  through `set_child` and works. Watch for the same on any GTK4 widget that is
  a bin rather than a container.
- **The control centre comes in from the right, and that is the user's call, not
  a default.** It slid down from under the bar first, which is what the shape
  suggests and what reads wrong: the bar is a row of floating pills with gaps
  between them, so there is nothing up there for a panel to come out of and most
  of the movement happens over bare wallpaper. A fade was tried after it and
  turned down too. `Gtk.RevealerTransitionType.SLIDE_LEFT` with `halign: END` is
  what it is now — pinned right, so what the transition moves is the left edge.
- **A CSS margin cannot carry a widget off the screen and back.** The obvious
  way to slide a panel in is a `margin-right` from minus its own width to 0, and
  GTK clamps it: the negative margin takes the widget's own measurement below
  zero ("GtkStack reported min width -84"), and the column jumps into place
  instead of travelling (verified frame by frame). Margins animate over short
  distances — `.slider-face` moves 24px — not over the width of a panel. A
  revealer is the lever for that.
- **A `Gtk.Revealer` inside a `Gtk.Revealer` does not give you two
  transitions.** A revealer keeps its child not child-visible — and so
  unmapped — until its own animation is under way, and `gtk_revealer_start_
  animation` skips straight to the end state on a widget that is not mapped. So
  the inner one is already open by the time the outer one starts (verified: an
  inner slide stood at full height while the outer one faded). The same goes for
  a CSS transition triggered on anything inside a closed revealer — if a second
  property has to animate, it belongs on the revealer's own node, which is the
  overlay's child and is mapped for as long as the window is.
- **A window that animates its way out has to outlive its own `visible`.**
  `widget/ControlCenter.tsx` splits the bar's `open` into a `mounted` (the
  window) and a `revealed` (what is in it): opening sets them a turn of the loop
  apart, so the revealer is mapped with its child still hidden and has something
  to animate from, and closing clears `revealed` first and only drops the window
  once the transition it started has run. Which view it goes back to is reset at
  the same point, or the panel slides through the main view on its way out.
- **A `Gtk.Stack` page is `$type="named"` plus `name` on the widget itself**, and
  gnim reads both off the child (`gtk4/jsx-runtime.ts`), so a sub-panel declares
  its own page rather than being wrapped at the call site. `visibleChildName`,
  though, cannot be a prop: gnim peeks an accessor into the constructor, which
  runs before any page is added, and the stack warns that the name is not one of
  its children. Set it from `$`, which runs last.
- **The tray's glyphs are not the bar's, which changes every lever.** They are
  whatever the application registered, so `icons/` gains nothing when a tray
  arrives and the numbers stepped off the set do not apply: `pixelSize` counts a
  box that our SF Symbols fill 22–24 units of 24 and that a themed icon fills
  nearly all of, hence 16 in `widget/Tray.tsx` against the bar's usual 15, which
  lands both at ~14px of ink (measured: a tray glyph at rest and an `.icon-button`
  glyph both peak at 180/255 over the pill). Dimming is `opacity` and not `color`
  for the same reason — `color` reaches a symbolic icon and nothing else, while
  0.7 of the widget puts a full-colour one at the same value `$icon-idle` gives
  the rest of the bar (verified, and a hover lifts one glyph from 161 to 206
  without touching its neighbours). And the design draws them bare, with no disc
  under them: a round button in a pill has to be concentric with the cap, which
  would pull the end glyphs in to 4px of padding and leave the tray reading as a
  second controls pill.
- **`ItemIsMenu` defaults to *true* in astal, so the primary click usually opens
  the menu.** The property is optional in the spec and astal starts it true
  (`tray/src/tray-item.vala`) rather than false, which is the appindicator reality
  it defaults to — an appindicator item is a menu and nothing besides.
  nm-applet, for one, publishes no `ItemIsMenu` at all (verified over `busctl`), so
  a bar that ignores the flag clicks into nothing on most of what it shows.
  Three things follow for the menu itself. It is a `Gtk.PopoverMenu` parented by
  hand, since a popover is not a child of the widget it hangs off — and `For`
  never destroys a GTK4 child (`cleanup` defaults to null in gnim's `For.ts`), so
  it comes off in `onCleanup` rather than on a `destroy` that is not coming. Its
  actions carry a `dbusmenu` prefix and have to be inserted on a parent of the
  menu, which the popover is of its own contents. And it does work on a layer
  surface with no keyboard focus (verified end to end against nm-applet's real
  dbusmenu: sections, separators, a check item, a submenu).
  Three more things about that popover, all measured. GTK gives it the
  `background` style class and the theme paints an opaque `--window-bg-color`
  under everything — the same thing `window.background` is reset for at the top of
  `style.scss`, and until `.tray-menu` did the same the menu drew #202020 whatever
  alpha its `contents` was given. It sits at `PANEL_GAP` below the bar through
  `set_offset`, which puts its top edge on the control centre's own line (both
  measured at y=58); the anchor for that is the item's box, which is why the box
  fills the pill's height rather than the glyph's. And the theme's shadow margin
  is part of the Wayland surface, so it takes the blur with it and reads as an 8px
  haze above the menu — `margin: 0; box-shadow: none` on `contents` is what
  removes it, and nothing else in this bar has a shadow anyway.
  The blur itself is not `blur` on the namespace: a popover is its own surface,
  and Hyprland renders a layer's popups with `blur_popups` from the same layerrule
  (`src/render/Renderer.cpp`, `renderdata.blur = …blurPopups()`).
  `decoration:blur:popups` is the *window* equivalent and does nothing here. With
  that rule the menu takes `$panel-bg` and is glass like the panels — verified by
  measurement: of the 206 backdrop pixels above 90/255 under an open menu, none
  came through, where unblurred they would read ~82 against the 33–36 they do.
  Without it the fill is not a tint but a window, at 157/255 over a terminal.
  A layer rule cannot be tried with `hyprctl keyword layerrule …`, which is worth
  knowing before debugging one: `handleLayerrule` only appends to `m_keywordRules`
  and, unlike `handleWindowrule` beside it, never calls `registerRule`, so the
  keyword answers `ok` and changes nothing until a reload — which clears the
  keyword rules first. Only the config file works.
  For testing without a tray application: astal's watcher keys items by bus name
  (`RegisterStatusNotifierItem` takes either a bus name or a path, never
  `busname/path`), so a stub publishes one item per process.
- **Never draw an icon. Ask the user for it.** `icons/` is one set with its own
  size relationships (below), and a glyph invented to fill a gap sits beside
  them rather than in them — it reads as the odd one out however carefully it is
  constructed. When a new item needs an icon, name the symbol it wants and stop
  there; the user exports it. The same goes for a variant of one already here (a
  crossed-out bell for a bell), which is a second glyph and not an edit of the
  first.
- **A new source file must be `git add`ed before `nix build` sees it.** `src = ./.`
  on a flake only picks up files git knows about; an untracked widget fails the
  bundle with `Could not resolve`. The same goes for anything under `icons/`.
- **The module's systemd unit binds `graphical-session.target`, not
  `hyprland-session.target`.** Home-manager's Hyprland module generates the
  latter with `BindsTo=graphical-session.target` (verified by evaluating it), so
  binding the general one covers Hyprland *and* uwsm. What it does depend on is
  the compositor handing its environment to the systemd user manager, since the
  unit carries `ConditionEnvironment=WAYLAND_DISPLAY` — without that import the
  unit never starts and says nothing about why.
- **The module does not touch the compositor's config.** The blur layerrules are
  the user's to write, deliberately — the module's scope is the bar itself (its
  package, its config file, its unit), not the session around it. The README
  documents the three namespaces and gives the Hyprland rules; keep them in sync
  with `widget/` when a `namespace` changes.
- Monitors are enumerated once in `main()`, so hotplugged outputs get no bar
  until the process restarts.
- `node_modules/` and `@girs/` are gitignored and reconstructed by the dev shell.

## Code style

Minimal comments — only when essential, and in English. Docs (README) in English and
lean. UI strings are separate from comments; don't translate them unless asked.
