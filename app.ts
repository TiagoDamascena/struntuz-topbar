import app from "ags/gtk4/app"
import style from "./style.scss"
import Bar from "./widget/Bar"

app.start({
  css: style,
  instanceName: "struntuz-topbar",
  main() {
    for (const monitor of app.get_monitors()) {
      Bar(monitor)
    }
  },
})
