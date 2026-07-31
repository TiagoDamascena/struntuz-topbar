import app from "ags/gtk4/app"
import style from "./style.scss"
import { installIcons } from "./lib/icons"
import Bar from "./widget/Bar"

app.start({
  css: style,
  instanceName: "struntuz-topbar",
  main() {
    // Before any widget asks for one by name.
    installIcons()

    for (const monitor of app.get_monitors()) {
      Bar(monitor)
    }
  },
})
