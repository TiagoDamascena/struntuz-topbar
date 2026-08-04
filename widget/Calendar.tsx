import app from "ags/gtk4/app"
import { Astal, Gdk, Gtk } from "ags/gtk4"
import { Accessor, createState } from "ags"
import { idle, timeout, Timer } from "ags/time"
import { Icons } from "../lib/icons"
import {
  COLUMNS,
  ROWS,
  atToday,
  days,
  goToday,
  monthLabel,
  nextMonth,
  previousMonth,
  resetCalendar,
  weekdays,
  yearLabel,
  type Day,
} from "../lib/calendar"
import { t } from "../lib/i18n"
import { PANEL_TOP } from "../lib/layout"

// The design's 434 at the control centre's own step down from 452, so the three
// panels keep the width relationship the design drew them with.
const PANEL_WIDTH = 384

// The same reveal the other two panels run.
const REVEAL_MS = 220

// Between two cells, and between two rows. The design's own 4, which survives
// the step down because a gap that small is already at its floor.
const CELL_GAP = 4

// The month, the year set back from it, and the three ways of moving. The two
// labels are one size for the reason the clock's two runs are: each centres its
// own line box, so a size step between them lands their baselines a pixel apart
// and reads as crooked. What separates them here is weight and colour.
function Head() {
  return (
    <box class="calendar-head" spacing={6}>
      <label class="calendar-month" label={monthLabel()} valign={Gtk.Align.CENTER} />
      <label
        class="calendar-year"
        label={yearLabel()}
        xalign={0}
        hexpand
        valign={Gtk.Align.CENTER}
      />
      {/* Dimmed rather than hidden when there is nowhere to go back to: the head
          is a fixed row of controls, and one of them leaving would slide the two
          arrows sideways every time the month changed. */}
      <button
        class="panel-action primary small"
        sensitive={atToday().as((here) => !here)}
        valign={Gtk.Align.CENTER}
        onClicked={goToday}
      >
        <label label={t.calendarToday} />
      </button>
      {/* The sub-panels' own chevrons at the sub-panels' own size — this head is
          set in the same 15px theirs are. */}
      <button
        class="icon-button"
        tooltipText={t.calendarPreviousMonth}
        valign={Gtk.Align.CENTER}
        onClicked={previousMonth}
      >
        <image iconName={Icons.back} pixelSize={16} />
      </button>
      <button
        class="icon-button"
        tooltipText={t.calendarNextMonth}
        valign={Gtk.Align.CENTER}
        onClicked={nextMonth}
      >
        <image iconName={Icons.forward} pixelSize={16} />
      </button>
    </box>
  )
}

function dayClass(day: Day): string {
  if (day.today) return "calendar-day today"
  return day.inMonth ? "calendar-day" : "calendar-day outside"
}

// A label and not a button, which is the one place this panel departs from the
// design: a cell there is picked, and what picking one does is fill the column
// beside it with that day's events. There are none yet, so a cell has nothing to
// answer a click with — and a button that does nothing is worse than a number,
// since it offers something the panel cannot do. Same call as the media panel's
// queue and the Wi-Fi menu's hidden network.
function Grid() {
  // Called once, and the cells read it by index. The accessor rebuilds the whole
  // forty-two on every move of the cursor, so one per cell would rebuild it
  // forty-two times a click — and the widgets themselves never change, since the
  // grid is 6×7 whatever month is on show.
  const grid = days()

  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={CELL_GAP}>
      <box class="calendar-weekdays" spacing={CELL_GAP} homogeneous>
        {weekdays().map((name) => (
          <label class="calendar-weekday" label={name} />
        ))}
      </box>
      {/* `homogeneous` is what makes the columns equal: a label asks for the
          width of its own digits, and a 31 beside a 1 would otherwise walk the
          grid out of line. */}
      {Array.from({ length: ROWS }, (_, row) => (
        <box spacing={CELL_GAP} homogeneous>
          {Array.from({ length: COLUMNS }, (_, column) => {
            const cell = grid.as((list) => list[row * COLUMNS + column])
            return (
              <label class={cell.as(dayClass)} label={cell.as((day) => String(day.day))} />
            )
          })}
        </box>
      ))}
    </box>
  )
}

// The calendar, hanging under the clock. The same full-output window the other
// two panels are, with the same click-away scrim and the same mount/reveal pair
// so the window outlives the transition that takes it off screen.
export default function Calendar(props: {
  gdkmonitor: Gdk.Monitor
  open: Accessor<boolean>
  close: () => void
}) {
  const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor

  const [mounted, setMounted] = createState(false)
  const [revealed, setRevealed] = createState(false)
  let pending: Timer | null = null

  props.open.subscribe(() => {
    pending?.cancel()

    if (props.open.get()) {
      // What today is, and the month to come up on. Read here rather than kept
      // by a timer behind a closed window — see `lib/calendar.ts`.
      resetCalendar()
      setMounted(true)
      pending = idle(() => setRevealed(true))
    } else {
      setRevealed(false)
      pending = timeout(REVEAL_MS, () => setMounted(false))
    }
  })

  return (
    <window
      visible={mounted}
      name="struntuz-calendar"
      namespace="struntuz-calendar"
      gdkmonitor={props.gdkmonitor}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.ON_DEMAND}
      anchor={TOP | BOTTOM | LEFT | RIGHT}
      application={app}
    >
      <Gtk.EventControllerKey
        onKeyPressed={(_self, keyval) => {
          if (keyval !== Gdk.KEY_Escape) return false
          props.close()
          return true
        }}
      />
      <overlay>
        <box>
          <Gtk.GestureClick onPressed={props.close} />
        </box>
        {/* Down, where the other two panels come in from the side. Not a change
            of mind about the drop the control centre was talked out of: what was
            wrong there is that the panel is pinned to the right end of a strip of
            floating pills, so most of the movement happened over bare wallpaper
            with nothing above it to come out of. This one is centred on the
            clock and its top edge starts directly under it, which is the case
            the movement was wanted for. */}
        <revealer
          $type="overlay"
          revealChild={revealed}
          transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}
          transitionDuration={REVEAL_MS}
          halign={Gtk.Align.CENTER}
          valign={Gtk.Align.START}
          marginTop={PANEL_TOP}
        >
          <box
            class="panel calendar"
            // Nothing to click while it is on its way out: `can-target` takes a
            // widget's children with it, so the whole panel goes at once.
            canTarget={revealed}
            orientation={Gtk.Orientation.VERTICAL}
            valign={Gtk.Align.START}
            widthRequest={PANEL_WIDTH}
          >
            <Head />
            <Grid />
          </box>
        </revealer>
      </overlay>
    </window>
  )
}
