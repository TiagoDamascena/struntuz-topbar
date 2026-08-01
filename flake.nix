{
  description = "struntuz-topbar — a Wayland top bar built with AGS/Astal";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";

    astal = {
      url = "github:aylur/astal";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    ags = {
      url = "github:aylur/ags";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.astal.follows = "astal";
    };
  };

  outputs =
    { self, nixpkgs, ags, astal }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems =
        f:
        nixpkgs.lib.genAttrs systems (
          system:
          f {
            inherit system;
            pkgs = nixpkgs.legacyPackages.${system};
          }
        );

      # Astal libraries the bar needs (also required on the `ags bundle` path).
      # One per source of data the bar shows; adding a module here means
      # regenerating @girs (`rm -rf @girs && ags types -d .`).
      astalLibsFor =
        system: with astal.packages.${system}; [
          io
          astal4
          hyprland
          notifd
          tray
          mpris
          network
          wireplumber
          battery
        ];
    in
    {
      packages = forAllSystems (
        { system, pkgs }:
        {
          default = pkgs.stdenv.mkDerivation {
            pname = "struntuz-topbar";
            version = "0.1.0";
            src = ./.;

            nativeBuildInputs = with pkgs; [
              wrapGAppsHook4
              gobject-introspection
              (ags.packages.${system}.default.override {
                extraPackages = astalLibsFor system;
              })
            ];

            buildInputs = [
              pkgs.glib
              pkgs.gjs
            ] ++ astalLibsFor system;

            installPhase = ''
              runHook preInstall
              mkdir -p $out/bin
              ags bundle app.ts $out/bin/struntuz-topbar --gtk 4
              runHook postInstall
            '';

            meta = {
              description = "Wayland top bar in AGS/Astal";
              mainProgram = "struntuz-topbar";
              platforms = systems;
            };
          };
        }
      );

      # A session program, so the module is home-manager's: the config goes to
      # the user's XDG dir and the service is a user unit under the compositor.
      homeModules.default = import ./nix/module.nix self;
      homeManagerModules = self.homeModules;

      devShells = forAllSystems (
        { system, pkgs }:
        let
          agsBase = ags.packages.${system}.default;
          agsDev = agsBase.override { extraPackages = astalLibsFor system; };
        in
        {
          default = pkgs.mkShell {
            packages = [ agsDev ];

            # Symlinks so tsserver resolves `ags`/`gnim`; @girs generated on first entry.
            shellHook = ''
              mkdir -p node_modules
              ln -sfn ${agsBase}/share/ags/js node_modules/ags
              ln -sfn ${agsBase}/share/ags/js/node_modules/gnim node_modules/gnim
              if [ ! -d @girs ]; then
                ags types -d .
              fi
            '';
          };
        }
      );

      formatter = forAllSystems ({ pkgs, ... }: pkgs.nixfmt-rfc-style);
    };
}
