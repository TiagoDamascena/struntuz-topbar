import { Gtk } from "ags/gtk4"
import { createComputed, createState } from "ags"
import Pango from "gi://Pango"
import { Icons, WifiIcons } from "../lib/icons"
import {
  PASSWORD_MIN,
  connect,
  endJoin,
  joinError,
  joinTarget,
  joining,
  signalIcon,
  type Network,
} from "../lib/network"
import { t } from "../lib/i18n"

const NAME_CHARS = 22

// The password panel: the one place in the bar that takes typing. It is a page
// of the control centre's stack like the menu it comes off, so joining a
// network is one more step to the right and the back arrow is the way out of it.
//
// The design's two other fields are not here. "Connect automatically" is what
// NetworkManager does with a new profile anyway and astal exposes no way to say
// otherwise, and a hidden network is joined by describing a connection rather
// than by picking an access point — which astal's access points cannot do. Both
// are left out rather than drawn and ignored, as the media panel's queue is.
export default function WifiJoin(props: { onBack: () => void }) {
  const target = joinTarget()
  const busy = joining()
  const failure = joinError()

  // The entry's own text, mirrored so the Connect button can read it: a
  // `Gtk.Editable` has no accessor of its own to bind against. The widget is
  // held too, since the mirror only runs one way — what a new network needs is
  // the field emptied, not the copy of it.
  const [typed, setTyped] = createState("")
  let field: Gtk.PasswordEntry | null = null

  const name = target.as((ap) => ap?.ssid ?? t.wifi)
  const ready = createComputed(() => typed().length >= PASSWORD_MIN && !busy())

  const submit = () => {
    const ap = target.get()
    if (ap && ready.get()) connect(ap, typed())
  }

  // The join is the module's and it is what says the join is done, so this is
  // where the panel finds out: `connect` clears the target on success and the
  // back arrow clears it by hand, and both come back here as the same
  // transition. Guarded on the previous value, since a network joined straight
  // from a row clears a target that was already empty.
  let held: Network | null = null
  target.subscribe(() => {
    const current = target.get()
    const left = held !== null && current === null
    held = current
    if (field) field.text = ""
    setTyped("")
    if (left) props.onBack()
  })

  return (
    <box
      $type="named"
      name="wifi-join"
      class="panel submenu"
      orientation={Gtk.Orientation.VERTICAL}
      valign={Gtk.Align.START}
    >
      <box class="submenu-head" spacing={9}>
        <button
          class="icon-button"
          tooltipText={t.back}
          valign={Gtk.Align.CENTER}
          onClicked={endJoin}
        >
          <image iconName={Icons.back} pixelSize={16} />
        </button>
        <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER} hexpand>
          <label
            class="submenu-title"
            label={name}
            xalign={0}
            maxWidthChars={NAME_CHARS}
            ellipsize={Pango.EllipsizeMode.END}
          />
          <label class="submenu-subtitle" label={t.wifiSecured} xalign={0} />
        </box>
        {/* What the row said, carried over: the panel replaced the list, so
            without these two the network being joined has only its name left. */}
        <image class="menu-row-lock" iconName={Icons.lock} pixelSize={14} valign={Gtk.Align.CENTER} />
        <image
          class="menu-row-icon"
          // Off the snapshot the row handed over, which is the strength the
          // network was last seen at — this panel is up for seconds, and the
          // live access point behind it may not outlive the join.
          iconName={target.as((net) => (net ? signalIcon(net.strength) : WifiIcons.off))}
          pixelSize={17}
          valign={Gtk.Align.CENTER}
        />
      </box>

      <box class="join" orientation={Gtk.Orientation.VERTICAL} spacing={7}>
        <label class="join-label" label={t.wifiPassword} xalign={0} />

        {/* `Gtk.PasswordEntry` rather than an entry with `visibility` off: it
            brings the peek button, the caps-lock warning and the paste
            behaviour a password field is expected to have. The peek glyph is
            the icon theme's and so the one themed glyph in the panel — it sits
            inside the field rather than in a row beside the bar's own set,
            which is what makes it worth two exports not spent. */}
        <Gtk.PasswordEntry
          class="join-entry"
          $={(self) => (field = self)}
          showPeekIcon
          // No placeholder: the design's is the word above the field, and set
          // in both places it read as the label having been typed in already.
          sensitive={busy.as((waiting) => !waiting)}
          onNotifyText={(self) => setTyped(self.text)}
          onActivate={submit}
          // The page is unmapped while the stack is showing another one, so
          // this runs on the way in every time rather than once at build.
          onMap={(self) => self.grab_focus()}
        />

        {/* One line, saying the more urgent of the two things: why the last
            attempt failed, or what a key has to be before there is any point
            trying. */}
        <label
          class={failure.as((why) => (why ? "join-hint failed" : "join-hint"))}
          label={createComputed(() =>
            failure() ? failure() : t.wifiPasswordHint.replace("%d", String(PASSWORD_MIN)),
          )}
          xalign={0}
          wrap
          maxWidthChars={NAME_CHARS + 12}
        />

        <box class="join-actions" spacing={8}>
          <box spacing={9} valign={Gtk.Align.CENTER} visible={busy} hexpand>
            <Gtk.Spinner class="join-spinner" spinning valign={Gtk.Align.CENTER} />
            <label
              class="join-progress"
              label={name.as((who) => t.wifiJoining.replace("%s", who))}
              xalign={0}
              maxWidthChars={NAME_CHARS}
              ellipsize={Pango.EllipsizeMode.END}
            />
          </box>
          <box
            spacing={8}
            halign={Gtk.Align.END}
            visible={busy.as((waiting) => !waiting)}
            hexpand
          >
            <button class="join-action" onClicked={endJoin}>
              <label label={t.wifiCancel} />
            </button>
            <button class="join-action primary" sensitive={ready} onClicked={submit}>
              <label label={t.wifiConnect} />
            </button>
          </box>
        </box>
      </box>
    </box>
  )
}
