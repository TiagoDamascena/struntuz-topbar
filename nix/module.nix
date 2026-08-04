self:
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.programs.struntuz-topbar;

  format = pkgs.formats.json { };

  configFile = format.generate "struntuz-topbar-config.json" cfg.settings;

  # Other notification daemons in this home. astal-notifd only owns
  # org.freedesktop.Notifications if nothing else took it first; when it loses
  # the race it proxies the winner and the bar's list stays empty forever.
  rivals = lib.filter (name: config.services.${name}.enable or false) [
    "dunst"
    "mako"
    "swaync"
    "fnott"
  ];
in
{
  options.programs.struntuz-topbar = {
    enable = lib.mkEnableOption "the struntuz-topbar Wayland top bar";

    package = lib.mkOption {
      type = lib.types.package;
      default = self.packages.${pkgs.stdenv.hostPlatform.system}.default;
      defaultText = lib.literalExpression "struntuz-topbar.packages.\${system}.default";
      description = "The bar package to use.";
    };

    settings = lib.mkOption {
      default = { };
      description = ''
        Bar configuration, written to
        {file}`$XDG_CONFIG_HOME/struntuz-topbar/config.json`. Unknown keys are
        passed through, so options newer than this module can still be set.
      '';
      type = lib.types.submodule {
        freeformType = format.type;

        options = {
          language = lib.mkOption {
            type = lib.types.enum [
              ""
              "en"
              "pt-BR"
            ];
            default = "";
            example = "pt-BR";
            description = ''
              Language of the bar's own strings and date patterns. Empty (the
              default) follows the session's locale, read from `LC_ALL`, then
              `LC_TIME`, then `LANG` — dates are formatted under `LC_TIME`,
              which is why it outranks `LANG` here.
            '';
          };

          dateFormat = lib.mkOption {
            type = lib.types.str;
            default = "";
            example = "%A, %-d de %B";
            description = ''
              Date beside the clock, as accepted by `g_date_time_format`. Empty
              takes the pattern `language` carries, since the locale translates
              the month and weekday names but not the order they go in:
              `%a, %b %-d` for English, `%a, %-d de %b` for pt-BR.
            '';
          };

          clockFormat = lib.mkOption {
            type = lib.types.str;
            default = "%H:%M";
            example = "%I:%M %p";
            description = "Time on the clock, same format strings.";
          };

          userName = lib.mkOption {
            type = lib.types.str;
            default = "";
            example = "Tiago";
            description = ''
              Name on the control centre's user pill, and the initial its avatar
              falls back to. Empty takes the account's real name, then its login.
            '';
          };

          userAvatar = lib.mkOption {
            type = lib.types.str;
            default = "";
            example = "~/Pictures/me.png";
            description = ''
              Picture on that avatar, in any format GdkPixbuf reads. Empty is
              `~/.face`; a leading `~/` is expanded. A missing file is not an
              error — the avatar falls back to the initial.
            '';
          };

          toastTimeout = lib.mkOption {
            type = lib.types.ints.unsigned;
            default = 6800;
            description = ''
              How long a notification card stays up, in milliseconds, when its
              sender asked for no timeout of its own. A sender that asked for one
              gets it; a critical notification ignores both and stays.
            '';
          };

          toastLimit = lib.mkOption {
            type = lib.types.ints.unsigned;
            default = 3;
            description = ''
              How many cards may stack up before the oldest leaves. It only
              leaves the screen: it is still in the control centre's list.
            '';
          };

          volumeStep = lib.mkOption {
            type = lib.types.ints.unsigned;
            default = 5;
            description = ''
              How far a scroll or an arrow key moves the volume bar, in percent.
              Held to 1–100: anything outside that is not a step.
            '';
          };

          batteryLow = lib.mkOption {
            type = lib.types.ints.unsigned;
            default = 20;
            description = ''
              Below this, in percent, the battery on the bar stops being a
              readout and starts being a warning. Only while it is discharging:
              the same level with a cable in it is on its way up. Held to 1–100.
            '';
          };

          powerCommands = lib.mkOption {
            default = { };
            description = ''
              One shell command per entry of the power menu, each merged on its
              own. They are commands rather than built-in calls because the right
              one is the session's, not the bar's.
            '';
            type = lib.types.submodule {
              options = {
                lock = lib.mkOption {
                  type = lib.types.str;
                  default = "loginctl lock-session";
                  description = ''
                    Through logind, so whatever holds the session's lock handle
                    (hypridle here) is what answers.
                  '';
                };

                suspend = lib.mkOption {
                  type = lib.types.str;
                  default = "systemctl suspend";
                  description = "Suspend the machine.";
                };

                logout = lib.mkOption {
                  type = lib.types.str;
                  default = "hyprctl dispatch exit";
                  example = "uwsm stop";
                  description = ''
                    Hyprland's own exit, so whatever supervises the session tears
                    down after it rather than under it. Under uwsm, `uwsm stop` is
                    the tidier one.
                  '';
                };

                restart = lib.mkOption {
                  type = lib.types.str;
                  default = "systemctl reboot";
                  description = "Reboot the machine.";
                };

                shutdown = lib.mkOption {
                  type = lib.types.str;
                  default = "systemctl poweroff";
                  description = "Power the machine off.";
                };
              };
            };
          };

          nightLight = lib.mkOption {
            default = { };
            description = ''
              The blue light filter's tile. Commands rather than built-in calls
              for the same reason the power menu's are: hyprsunset answers by
              default, wlsunset and gammastep do the same job, and which of them
              runs is the session's business.
            '';
            type = lib.types.submodule {
              options = {
                temperature = lib.mkOption {
                  type = lib.types.ints.unsigned;
                  default = 3400;
                  description = ''
                    Colour temperature the filter runs at, in kelvin, and what
                    `%d` in `on` becomes. The tile writes it under its label.
                  '';
                };

                neutral = lib.mkOption {
                  type = lib.types.ints.unsigned;
                  default = 6000;
                  example = 6500;
                  description = ''
                    Colour temperature the display reads at with nothing
                    filtering it, and what `%d` in `off` becomes. 6000 is
                    hyprsunset's own default. What `status` reports is measured
                    against it: below is on, at or above is off.
                  '';
                };

                on = lib.mkOption {
                  type = lib.types.str;
                  default = "hyprctl hyprsunset temperature %d";
                  example = "gammastep -P -O %d";
                  description = ''
                    Turn the filter on. Every `%d` becomes `temperature`, so the
                    warmth is one setting rather than a number repeated in a
                    string.
                  '';
                };

                off = lib.mkOption {
                  type = lib.types.str;
                  default = "hyprctl hyprsunset temperature %d";
                  example = "gammastep -x";
                  description = ''
                    Turn it off, every `%d` becoming `neutral` this time. Not
                    hyprsunset's `identity`, which is the exact off but leaves
                    `status` reporting the temperature from before it — the tile
                    would then read every off as an on.
                  '';
                };

                status = lib.mkOption {
                  type = lib.types.str;
                  default = "hyprctl hyprsunset temperature";
                  description = ''
                    Print the temperature the display is at now, in kelvin. It
                    is read when the bar starts and every time the control
                    centre opens, which is what keeps the tile honest across a
                    restart of the bar and a keybind that went round it. Empty
                    leaves the tile trusting its own last click.
                  '';
                };
              };
            };
          };
        };
      };
    };

    systemd = {
      enable = lib.mkOption {
        type = lib.types.bool;
        default = true;
        description = ''
          Run the bar as a systemd user service bound to `target`, instead of
          leaving it to the compositor's `exec-once`.
        '';
      };

      target = lib.mkOption {
        type = lib.types.str;
        default = "graphical-session.target";
        example = "hyprland-session.target";
        description = ''
          Target the service is bound to. `graphical-session.target` is the
          portable one and is what uwsm and home-manager's Hyprland systemd
          integration both activate.

          Whichever it is, the compositor has to hand its environment to the
          systemd user manager for the unit to start — the service carries a
          `ConditionEnvironment=WAYLAND_DISPLAY`, and a compositor that never
          imported it leaves the bar silently unstarted.
        '';
      };
    };

    installFont = lib.mkOption {
      type = lib.types.bool;
      default = true;
      description = ''
        Install Inter and enable fontconfig. The stylesheet asks for Inter by
        name and fontconfig is the only way GTK can find it; without it the bar
        renders in the default sans and the pills measure differently.
      '';
    };
  };

  config = lib.mkIf cfg.enable {
    assertions = [
      {
        assertion = rivals == [ ];
        message =
          "programs.struntuz-topbar: the bar is the session's notification daemon, but "
          + lib.concatStringsSep " and " (map (n: "services.${n}") rivals)
          + " also claims org.freedesktop.Notifications. Whichever takes the name first"
          + " wins, and if it is not the bar its notification list stays empty forever."
          + " Disable the other daemon.";
      }
    ];

    home.packages = [ cfg.package ] ++ lib.optional cfg.installFont pkgs.inter;

    fonts.fontconfig.enable = lib.mkIf cfg.installFont true;

    xdg.configFile."struntuz-topbar/config.json".source = configFile;

    systemd.user.services.struntuz-topbar = lib.mkIf cfg.systemd.enable {
      Unit = {
        Description = "struntuz-topbar Wayland top bar";
        Documentation = "https://github.com/tiagodamascena/struntuz-topbar";
        PartOf = [ cfg.systemd.target ];
        After = [ cfg.systemd.target ];
        ConditionEnvironment = "WAYLAND_DISPLAY";
        # So editing `settings` restarts the bar rather than leaving the running
        # one on the old config until the next logout.
        X-Restart-Triggers = [ "${configFile}" ];
      };

      Service = {
        ExecStart = lib.getExe cfg.package;
        Restart = "on-failure";
        RestartSec = 3;
      };

      Install.WantedBy = [ cfg.systemd.target ];
    };
  };
}
