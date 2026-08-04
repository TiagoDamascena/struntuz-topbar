import { Accessor, createComputed, createState } from "ags"
import GLib from "gi://GLib"
import { getConfig } from "./config"
import { t } from "./i18n"

// Six rows, always, and not five when a month happens to fit in five: a row is
// 46px of panel, and a grid that changes height between months moves the foot
// of the panel under the pointer that is paging through it.
export const ROWS = 6
export const COLUMNS = 7
const CELLS = ROWS * COLUMNS

export interface Day {
  day: number
  // Whether it belongs to the month on show. The rows either side are filled
  // from the months around it rather than left blank — a week is seven days
  // wherever it falls, and a blank leaves a hole in a grid that has none.
  inMonth: boolean
  today: boolean
}

interface Month {
  year: number
  // 1–12, as `GLib.DateTime` counts and as nothing else in JavaScript does.
  month: number
}

interface Today extends Month {
  day: number
}

// 0 = Sunday … 6 = Saturday, which is the order `Date.getDay` counts in and the
// one `config.weekStart` is written in.
const WEEK_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

// Which day the grid's first column is. It belongs to the language for the
// reason `dateFormat` does: the locale translates the weekday names and never
// says which of them a week starts on. `config.weekStart` overrides it by name,
// since a `1` in a config file says nothing about which day it is.
function resolveWeekStart(): number {
  const name = getConfig().weekStart.trim().toLowerCase()
  if (!name) return t.weekStart

  const index = WEEK_DAYS.indexOf(name)
  if (index >= 0) return index

  console.warn(`struntuz-topbar: unknown weekStart "${name}", using the language's`)
  return t.weekStart
}

// Read once: it is a setting and a language, and neither moves while the bar is
// up.
const WEEK_START = resolveWeekStart()

// The grid's arithmetic is the civil calendar's and nothing else — no zone, no
// clock, no leap-year table — so it is done on plain dates. GLib comes in only
// where the locale does, which is the three labels below.
function firstWeekday(month: Month): number {
  return new Date(month.year, month.month - 1, 1).getDay()
}

function daysIn(month: Month): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(month.year, month.month, 0).getDate()
}

// Noon and not midnight. A `GLib.DateTime` is a civil time in the local zone,
// and a DST jump that skips 00:00 — Brazil's used to — leaves the day starting
// an hour late. Nothing here reads a time, so the middle of the day is the safe
// place to stand.
function label(month: Month, pattern: string): string {
  return GLib.DateTime.new_local(month.year, month.month, 1, 12, 0, 0)?.format(pattern) ?? ""
}

// 1 January 2023 was a Sunday, so the seven days from it are one week in the
// order `WEEK_DAYS` counts. A fixed week rather than the first row on show:
// what is wanted here is the locale's seven names, not this month's.
function weekdayName(index: number): string {
  return (
    GLib.DateTime.new_local(2023, 1, 1 + index, 12, 0, 0)
      ?.format("%a")
      // GTK's CSS has no `text-transform`, so the design's uppercase row is
      // made here.
      ?.toUpperCase() ?? ""
  )
}

function currentDay(): Today {
  const now = GLib.DateTime.new_now_local()
  return { year: now.get_year(), month: now.get_month(), day: now.get_day_of_month() }
}

function shiftMonth(month: Month, by: number): Month {
  const index = month.year * 12 + (month.month - 1) + by
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

const start = currentDay()

// What today is, and which month is on show. Two states and not one: paging
// through the year moves the second and must not move the first, or every month
// visited would draw a marked day.
const [today, setToday] = createState<Today>(start)
const [cursor, setCursor] = createState<Month>({ year: start.year, month: start.month })

// Called when the panel opens. The day is read here rather than kept by a timer
// behind a closed window: this is the only thing in the bar that asks what
// today is, and the bar runs for days between two openings. It also settles
// which month the panel comes up on — today's, and not wherever the last
// visit's paging left the cursor.
export function resetCalendar(): void {
  const now = currentDay()
  setToday(now)
  setCursor({ year: now.year, month: now.month })
}

export function previousMonth(): void {
  setCursor(shiftMonth(cursor.get(), -1))
}

export function nextMonth(): void {
  setCursor(shiftMonth(cursor.get(), 1))
}

export function goToday(): void {
  const now = today.get()
  setCursor({ year: now.year, month: now.month })
}

// Whether there is anywhere to go back to.
export function atToday(): Accessor<boolean> {
  return createComputed(
    [cursor, today],
    (view, now) => view.year === now.year && view.month === now.month,
  )
}

// `%OB` and not `%B`: what the head shows is a month standing on its own, and a
// language with cases — Russian, Greek — spells that one differently from the
// month inside a date. The two are the same word in English and Portuguese,
// which is exactly why it is worth saying.
export function monthLabel(): Accessor<string> {
  return cursor.as((month) => label(month, "%OB"))
}

export function yearLabel(): Accessor<string> {
  return cursor.as((month) => label(month, "%Y"))
}

// Not an accessor: `WEEK_START` is fixed at startup, so the seven names over the
// grid never change.
export function weekdays(): string[] {
  return Array.from({ length: COLUMNS }, (_, i) => weekdayName((WEEK_START + i) % 7))
}

export function days(): Accessor<Day[]> {
  return createComputed([cursor, today], (view, now) => {
    const lead = (firstWeekday(view) - WEEK_START + 7) % 7
    const count = daysIn(view)
    const before = daysIn(shiftMonth(view, -1))
    const showingToday = view.year === now.year && view.month === now.month

    return Array.from({ length: CELLS }, (_, i) => {
      const offset = i - lead
      if (offset < 0) return { day: before + offset + 1, inMonth: false, today: false }
      if (offset >= count) return { day: offset - count + 1, inMonth: false, today: false }

      const day = offset + 1
      return { day, inMonth: true, today: showingToday && day === now.day }
    })
  })
}
