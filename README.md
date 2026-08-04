# struntuz-topbar

A Wayland top bar built with [AGS/Astal](https://aylur.github.io/ags/)
(TypeScript + GTK4).

It is not one continuous bar but a strip of floating pills, meant to sit on a
blurred backdrop. It ships as a Nix flake with a home-manager module, so on
NixOS the whole thing is one `enable = true`.

## Features

- **Workspaces** — a dot per workspace, the focused one stretched into a bar.
- **Clock** — time and date, with configurable formats and localized names.
- **Control centre** — a panel with the user's avatar, name and battery, and a
  power menu: lock, suspend, log out, restart, shut down.
- **Media** — a pill beside the workspaces showing what is playing, with three
  bars that move while it does. It opens a panel with the cover art, the track,
  a draggable position line, and play, previous, next, shuffle and repeat —
  each of which is drawn only when the player says it answers it. Clicking the
  cover asks the player to come to the front. Anything speaking
  [MPRIS](https://specifications.freedesktop.org/mpris-spec/latest/) is a
  player, so when more than one is running the panel grows a row of tabs across
  the top — one per source, a dot on whichever is making sound — and you pick.
  With one player there are no tabs and it just follows what is playing.
- **Notifications** — the bar is the session's notification daemon. Cards appear
  in the corner and stay in the control centre's list until cleared. Clicking a
  card or a row hands the click back to the application that sent it, which is
  what raises its window or opens the tab it was about; one from an application
  that offers nothing to open is only taken off the list.
- **Do not disturb** — one switch in the control centre. Cards stop appearing and
  the badge comes off the bar; what arrives still goes to the list, so nothing is
  lost. The switch is remembered across restarts.
- **Volume** — a bar across the control centre, filled to where the volume is.
  Drag it, click along it or scroll it; the disc on the left mutes, and the
  caret at the far end opens the output menu, which lists everything that can
  play sound and switches to the one you pick. The speaker on the bar itself
  says where the sound is going and opens that menu in one click, and its waves
  are how loud it is — none at 0%, three at the top, a slash when muted.
- **Wi-Fi** — a tile across the control centre saying which network you are on,
  with a disc that turns the radio on and off and a way into the list of
  everything the card can hear: one row per network, strongest first, the one
  you are on at the top. Picking an open or a saved network joins it on the
  click; anything else asks for the password on a panel of its own and tells
  you when it was the wrong one. The arcs on the bar's own glyph are how strong
  the link is, and it opens the list in one click. See [Wi-Fi](#wi-fi) below.
- **System tray** — a pill of application icons, hidden entirely while nothing is
  in it. A left click opens the application's own menu, or sends it the click when
  it has an action instead; a right click always goes for the menu, a middle click
  for the application's secondary action. An icon asking for attention stops being
  dimmed.
- **Battery** — a glyph in the same pill as the speaker, on a laptop: how full
  the casing is drawn is how much is left, and a bolt rides that same level
  while it charges rather than replacing it, so plugging in never costs you the
  reading. The percentage and an estimate — time to empty, or time to full —
  are in its tooltip. It turns amber under `batteryLow`, and only while
  discharging: the same level with a cable in it is on its way up. A machine
  without a battery never shows it, so the desktop bar is unchanged.
- **Night light** — the tile beside it, warming the display through
  [hyprsunset](https://github.com/hyprwm/hyprsunset) by default. It runs
  commands, so any other filter does as well, and it reads the temperature back
  rather than assuming its own clicks are the whole story.

Localized in English and Brazilian Portuguese, following the session's locale by
default.

## Requirements

- A Wayland compositor with `wlr-layer-shell`. **Hyprland** for the workspaces
  widget, which reads its state from Hyprland's IPC; everything else is
  compositor-agnostic.
- The **Inter** font, installed and visible to fontconfig.
- **hyprsunset**, running, for the night light tile as configured out of the box.
  Point `nightLight` at another filter if you use one; the tile stays either way
  and only says the command failed.
- **PipeWire** with **WirePlumber**, for the volume bar. Without it the bar
  leaves the row out rather than showing one that cannot move.
- **UPower**, on a laptop, for the battery. It is read through the daemon and
  never from `/sys` directly, so without it running there is nothing to read and
  the bar leaves the battery out — the same as on a desktop. It logs a line
  saying so when the kernel can see a battery and UPower cannot. On NixOS:
  `services.upower.enable = true`.
- **NetworkManager**, for the Wi-Fi tile and its menu. It is the only backend —
  a machine on `iwd` alone, `systemd-networkd` or `wpa_supplicant` by hand gets
  no tile rather than a broken one. On NixOS: `networking.networkmanager.enable
  = true`. A desktop with no wireless card leaves it out the same way.
- No other notification daemon running, since only one process can own
  `org.freedesktop.Notifications`.

## Install on NixOS

The bar is a session program — its config lives in your XDG config dir, its
avatar in your home, and its service under your compositor — so the module is a
**home-manager** one. It is exposed as `homeModules.default`.

### 1. Add the flake input

```nix
{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";

    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    struntuz-topbar = {
      url = "github:tiagodamascena/struntuz-topbar";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    { nixpkgs, home-manager, struntuz-topbar, ... }:
    {
      nixosConfigurations.myhost = nixpkgs.lib.nixosSystem {
        system = "x86_64-linux";
        modules = [
          ./configuration.nix
          home-manager.nixosModules.home-manager
          {
            home-manager.users.alice = import ./home.nix;
            home-manager.extraSpecialArgs = { inherit struntuz-topbar; };
          }
        ];
      };
    };
}
```

With standalone home-manager, pass the input to
`homeManagerConfiguration`'s `extraSpecialArgs` instead; the module import below
is the same either way.

### 2. Import the module

In `home.nix`:

```nix
{ struntuz-topbar, ... }:
{
  imports = [ struntuz-topbar.homeModules.default ];

  programs.struntuz-topbar.enable = true;
}
```

That is the whole install. It puts the bar in `home.packages`, writes the config
file, installs Inter, and runs the bar as a systemd user service — no
`exec-once`.

Blurring the bar's layers is your compositor's configuration and stays yours to
write; see [Blur](#blur).

### 3. Configure it

Everything from [Configuration](#configuration) is available under `settings`,
one option per key and checked when your config evaluates:

```nix
programs.struntuz-topbar = {
  enable = true;

  settings = {
    language = "pt-BR";
    clockFormat = "%H:%M";
    dateFormat = "%A, %-d de %B";
    userName = "Alice";
    userAvatar = "~/Pictures/me.png";
    toastTimeout = 6800;
    toastLimit = 3;
    volumeStep = 5;
    batteryLow = 20;

    powerCommands = {
      lock = "loginctl lock-session";
      logout = "uwsm stop";
    };

    nightLight.temperature = 3000;
  };
};
```

`settings` is freeform, so a key newer than the module still reaches the config
file.

### Module options

| Option | Default | What it does |
| --- | --- | --- |
| `enable` | `false` | Install and run the bar. |
| `package` | this flake's | The bar package to use. |
| `settings` | `{ }` | The config file. See [Configuration](#configuration). |
| `systemd.enable` | `true` | Run as a user service. `false` leaves starting it to your compositor. |
| `systemd.target` | `graphical-session.target` | What the service is bound to. |
| `installFont` | `true` | Install Inter and enable fontconfig. |

The module refuses to evaluate if another notification daemon is enabled in the
same home, since the bar cannot own `org.freedesktop.Notifications` alongside
one.

### The service

```bash
systemctl --user status struntuz-topbar
```

The unit only starts once the compositor has handed its environment to the
systemd user manager. Home-manager's Hyprland module and uwsm both do this; a
hand-rolled session needs
`dbus-update-activation-environment --systemd WAYLAND_DISPLAY …`, or the unit
waits without reporting an error.

Changing `settings` restarts the bar on the next `home-manager switch`. Monitors
are enumerated at startup, so a newly plugged-in one takes a
`systemctl --user restart struntuz-topbar`.

## Install elsewhere

Without Nix, build it with [AGS](https://aylur.github.io/ags/) 3.x and the Astal
libraries listed in `flake.nix`:

```bash
ags bundle app.ts struntuz-topbar --gtk 4
```

Then start it from your compositor's autostart and write the config file
yourself.

## Configuration

The bar reads `$XDG_CONFIG_HOME/struntuz-topbar/config.json` (usually
`~/.config/struntuz-topbar/config.json`). On NixOS this file is written for you
from the module's `settings`.

Every key is optional. An unreadable or invalid file is never fatal — the bar
warns and uses the defaults.

```json
{
  "language": "",
  "dateFormat": "",
  "clockFormat": "%H:%M",
  "userName": "",
  "userAvatar": "",
  "toastTimeout": 6800,
  "toastLimit": 3,
  "volumeStep": 5,
  "batteryLow": 20,
  "powerCommands": {
    "lock": "loginctl lock-session",
    "suspend": "systemctl suspend",
    "logout": "hyprctl dispatch exit",
    "restart": "systemctl reboot",
    "shutdown": "systemctl poweroff"
  },
  "nightLight": {
    "temperature": 3400,
    "neutral": 6000,
    "on": "hyprctl hyprsunset temperature %d",
    "off": "hyprctl hyprsunset temperature %d",
    "status": "hyprctl hyprsunset temperature"
  }
}
```

| Key | Default | Meaning |
| --- | --- | --- |
| `language` | `""` | `en`, `pt-BR`, or empty to follow the session's locale. |
| `dateFormat` | `""` | Date beside the clock, as accepted by `g_date_time_format`. Empty uses the language's own pattern. |
| `clockFormat` | `"%H:%M"` | Time, same format strings. |
| `userName` | `""` | Name on the user pill. Empty uses the account's. |
| `userAvatar` | `""` | Picture on the avatar; `~/` is expanded. Empty uses `~/.face`, and no file at all falls back to the name's initial. |
| `toastTimeout` | `6800` | How long a notification card stays up, in ms, when its sender asked for no timeout. |
| `toastLimit` | `3` | How many cards stack up before the oldest leaves the screen. It stays in the list. |
| `volumeStep` | `5` | How far a scroll or an arrow key moves the volume bar, in percent. Held to 1–100. |
| `batteryLow` | `20` | Below this, in percent, the battery on the bar turns amber. Only while discharging. Held to 1–100. |
| `powerCommands` | see above | One shell command per entry of the power menu, each overridable on its own. |
| `nightLight` | see above | The blue light filter. `%d` in `on` and `off` is the temperature the command has to leave the display at: `temperature` turning on, `neutral` turning off. `status` prints where it is now, and is read against `neutral` — below it is on. |

The power menu runs commands rather than calling logind directly, so what "lock"
or "log out" means on your system stays yours to decide. The night light is the
same idea: `hyprsunset` has to be running for the defaults to answer, and any
other filter fits by rewriting the three commands —

```json
{
  "nightLight": {
    "neutral": 6500,
    "on": "gammastep -P -O %d",
    "off": "gammastep -x",
    "status": ""
  }
}
```

An empty `status` is allowed and costs only the read back: the tile then trusts
its own last click, and shows nothing of a filter turned on from elsewhere.

The default `off` sets `neutral` rather than using hyprsunset's `identity`, which
is the exact off but leaves `hyprctl hyprsunset temperature` reporting the
temperature from before it — the tile would read every off as an on. Whatever
`off` does, `status` has to agree with it.

Set `STRUNTUZ_TOPBAR_CONFIG` to read the config from somewhere else, which is
useful while iterating:

```bash
STRUNTUZ_TOPBAR_CONFIG=./config.json ags run app.ts
```

## Blur

The pills are drawn to sit on a blurred backdrop, but the bar cannot produce that
blur itself — its windows are transparent, so there is nothing beneath them for
GTK to blur. **Blurring is your compositor's job, and configuring it is up to
you.** Without it everything still renders, just flat over the wallpaper.

The bar puts its four windows on layer namespaces you can match against:

| Namespace | Window |
| --- | --- |
| `struntuz-topbar` | the bar itself |
| `struntuz-control-center` | the control centre panel |
| `struntuz-media` | the media panel |
| `struntuz-toasts` | the notification cards |

On Hyprland, one `layerrule` per namespace in `hyprland.conf`:

```
layerrule {
  name=struntuz-topbar-blur
  blur=on
  ignore_alpha=0
  match:namespace=struntuz-topbar
}

layerrule {
  name=struntuz-control-center-blur
  blur=on
  ignore_alpha=0
  match:namespace=struntuz-control-center
}

layerrule {
  name=struntuz-media-blur
  blur=on
  ignore_alpha=0
  match:namespace=struntuz-media
}

layerrule {
  name=struntuz-toasts-blur
  blur=on
  ignore_alpha=0
  match:namespace=struntuz-toasts
}
```

Keep `ignore_alpha` at `0`: anything higher starts skipping the panels
themselves. With home-manager, the same rules go in
`wayland.windowManager.hyprland.settings.layerrule` as a list of attribute sets.

Layer rules take effect on `hyprctl reload`. They cannot be tried with
`hyprctl keyword layerrule …`: on 0.56 that parses and answers `ok` while
registering nothing, since the dynamic path window rules have was never added for
layer rules.

A tray item's menu is not one of those windows. A popover is its own Wayland
surface, hanging off the bar's rather than drawn in it, so `blur` above does not
reach it — `blur_popups` on the same rule is what does:

```
layerrule {
  name=struntuz-topbar-blur
  blur=on
  blur_popups=on
  ignore_alpha=0
  match:namespace=struntuz-topbar
}
```

The menu is a tint like the panels are, so it wants that line the way they want
theirs — without it you get the window behind it rather than a blur of it. Note
that `decoration:blur:popups` is a different setting and will not do: that one
governs the popups of ordinary windows, not of a layer surface.

## Wi-Fi

Everything here goes through **NetworkManager**, and what the bar can do is
what a NetworkManager client can do. The tile's disc is the radio — the same
thing `nmcli radio wifi off` does — and the list under it is the access points
the card can currently hear.

A network is joined by clicking its row. One that is **open**, or one you have
**saved** before, connects straight away, since NetworkManager already holds
everything it needs; anything else opens a password panel first. A profile is
created on the first successful join and is used from then on, so a network is
only asked about once.

**A wrong password takes a few seconds to come back as one.** NetworkManager
answers the moment it has *started* the association, not when it has worked, so
the panel waits on the device afterwards and reports what it lands on. Thirty
seconds without an answer either way is reported as a failure too.

Two things are **not** here, and are left out rather than drawn and ignored:

- **Hidden networks.** Joining one means describing a connection rather than
  picking an access point — the SSID is typed in because nothing is
  broadcasting it — and `AstalNetwork` only models access points. Networks
  broadcasting an empty name are dropped from the list for the same reason.
- **"Connect automatically."** NetworkManager sets `autoconnect` on a new
  profile anyway, which is what the checkbox would be asking for, and there is
  no binding to say otherwise. Change it with `nmcli connection modify <name>
  connection.autoconnect no`.

**One row per name.** NetworkManager lists an access point per radio, so a mesh
or a dual-band router turns up two or five times over; the list keeps the
strongest one carrying each name. Which also means a band is only pickable
separately when the router names the two differently — `Savio` and `Savio_5G`
are two networks, one router advertising both bands under one name is one row.

**A saved network is never asked about again**, which cuts both ways: if its
stored password stops being right — the router changed it — its row keeps
connecting and failing, and there is nothing here to type a new one into.
Forget it first and the row asks again:

```bash
nmcli connection delete "<name>"
```

Forgetting, renaming and everything else about a profile is `nmcli` or
`nm-connection-editor`: the bar is a way onto a network, not a place to
administer them.

## Media

The pill and its panel are MPRIS, and MPRIS is only what a player chose to
publish — so the panel draws a control when the player says it answers it and
leaves it out when it does not. A browser tab usually offers play, previous and
next and nothing else; a desktop player usually offers the lot. There is
nothing to configure: no player means no pill at all.

Two things the design sketches are **not possible over MPRIS**, and are left
out rather than faked:

- **Liking or saving a track.** There is no such method or writable property in
  the spec. `xesam:userRating` is metadata a player publishes about a track,
  not a switch a client can throw, and no mainstream player exposes its own
  library as MPRIS.
- **The queue, or "up next".** The spec does have optional `TrackList` and
  `Playlists` interfaces, but `AstalMpris` does not bind them, so a client
  built on it cannot read a queue. The space goes to the choice of *player*
  instead, which is the thing that actually gets in the way.

**`playerctld` is left out of the tabs.** It registers an MPRIS name of its own
and mirrors whichever real player was last active, so counting it shows every
track twice and can leave the bar controlling the proxy rather than the
application. It exists to give a single-player client the "whatever is playing"
this bar works out for itself. **Keep running it** if your keybinds use
`playerctl` — nothing here stops it, the bar simply talks to the applications
directly rather than through it.

**Cover art needs a TLS backend, and a track to have one at all.** Astal fetches
`mpris:artUrl` into its own cache, and for Spotify — and every other streaming
player — that is an https URL. The package carries `glib-networking` for it; if
you build the bar yourself, without it the art silently never appears and the
log says `TLS support is not available`.

Plenty of tracks publish no art, and then the tile shows a note instead. That
is usually the page rather than the player: Firefox only forwards what the site
declared through the MediaSession API, and YouTube's watch pages declare none,
where SoundCloud and Bandcamp do.

Clicking the cover asks the player to raise its window, which comes with the
same catch as clicking a notification below: MPRIS's `Raise` is a request, and
whether it is honoured is your compositor's call. MPRIS has no
xdg-activation token to hand over either, so `misc:focus_on_activate` is the
whole of what makes it work on Hyprland.

## Clicking a notification

Clicking a card or a row invokes the notification's default action and hands the
application an xdg-activation token, which is everything a daemon has to give:
on Wayland a window cannot raise itself, it can only be raised, and **whether an
application that asks to be focused gets focused is your compositor's call.**

Hyprland's answer is no by default — `misc:focus_on_activate` is `false`, and an
application that asks is only marked urgent. So the click reaches the browser
and nothing comes forward until you turn it on:

```
misc {
  focus_on_activate = true
}
```

There is a window rule of the same name if you would rather allow it one
application at a time:

```
windowrule {
  name=browser-activate
  focus_on_activate=true
  match:class=^(zen|firefox)$
}
```

Applications that declared no default action — most of what `notify-send` sends
— have nothing to come forward with, and clicking those only takes them off the
list.

## Development

The dev shell links `node_modules/ags` and `node_modules/gnim` so your editor
resolves the imports, and generates the `@girs` types on first entry:

```bash
nix develop
```

Run it against the live compositor:

```bash
ags run app.ts
```

Quit it by name — the window has no decorations:

```bash
ags quit -i struntuz-topbar
```

Build the package:

```bash
nix build
```

There is no test suite; validation is a manual run plus a typecheck:

```bash
nix run nixpkgs#typescript -- --noEmit -p .
```

`app.ts` renders one `Bar` window per monitor. `widget/` holds one component per
item, `lib/` everything that talks to a data source. The Astal libraries the bar
links against are listed once in `flake.nix` as `astalLibsFor`, feeding both the
package and the dev shell; adding one there means regenerating the types with
`rm -rf @girs && ags types -d .`.
