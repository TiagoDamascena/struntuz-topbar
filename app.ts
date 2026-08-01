import app from "ags/gtk4/app"
import style from "./style.scss"
import { installIcons } from "./lib/icons"
import { readNightLight } from "./lib/nightlight"
import { startNotifications } from "./lib/notifications"
import Bar from "./widget/Bar"

app.start({
  css: style,
  instanceName: "struntuz-topbar",
  main() {
    // Before any widget asks for one by name.
    installIcons()
    // Takes org.freedesktop.Notifications, so the bar is the session's
    // notification daemon from here on (see README.md).
    startNotifications()
    // The filter may well have been on since before the bar started.
    readNightLight()

    for (const monitor of app.get_monitors()) {
      Bar(monitor)
    }
  },
})
