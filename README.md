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
- **Notifications** — the bar is the session's notification daemon. Cards appear
  in the corner and stay in the control centre's list until cleared. Clicking a
  card or a row hands the click back to the application that sent it, which is
  what raises its window or opens the tab it was about; one from an application
  that offers nothing to open is only taken off the list.
- **Do not disturb** — one switch in the control centre. Cards stop appearing and
  the badge comes off the bar; what arrives still goes to the list, so nothing is
  lost. The switch is remembered across restarts.
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

The bar puts its three windows on layer namespaces you can match against:

| Namespace | Window |
| --- | --- |
| `struntuz-topbar` | the bar itself |
| `struntuz-control-center` | the control centre panel |
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
  name=struntuz-toasts-blur
  blur=on
  ignore_alpha=0
  match:namespace=struntuz-toasts
}
```

Keep `ignore_alpha` at `0`: anything higher starts skipping the panels
themselves. With home-manager, the same rules go in
`wayland.windowManager.hyprland.settings.layerrule` as a list of attribute sets.

To try one before writing it into your config,
`hyprctl keyword layerrule blur,struntuz-topbar` applies until the next reload.

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
