import GLib from "gi://GLib"
import { getConfig } from "./config"

export interface Strings {
  // Not a label but a `g_date_time_format` pattern: the locale translates the
  // weekday and month names, never the order they go in. `config.dateFormat`
  // overrides it.
  dateFormat: string

  // Which day the calendar's first column is, 0 = Sunday … 6 = Saturday. It is
  // the language's for the same reason `dateFormat` is: the locale translates
  // the weekday names and never says which of them a week starts on.
  // `config.weekStart` overrides it.
  weekStart: number

  calendar: string
  calendarToday: string
  calendarPreviousMonth: string
  calendarNextMonth: string

  controlCenter: string
  back: string

  doNotDisturb: string
  doNotDisturbOn: string
  doNotDisturbOff: string

  nightLight: string
  nightLightOff: string
  // `%d` is the colour temperature the display is at, in kelvin.
  nightLightKelvin: string

  volume: string
  volumeMuted: string
  // `%d` is how loud the default output is, in percent.
  volumePercent: string
  volumeMute: string
  volumeUnmute: string

  audio: string
  audioOutput: string
  // The bar segment's tooltip. `%s` is where the sound is going, or that there
  // is none.
  audioTooltip: string

  wifi: string
  // The radio is off, against `wifiDisconnected` — on with nothing joined.
  wifiOff: string
  wifiDisconnected: string
  wifiEnable: string
  wifiDisable: string
  // The bar segment's tooltip. `%s` is the network, or that there is none.
  wifiTooltip: string
  wifiScanning: string
  wifiEmpty: string
  // What a row says under its name.
  wifiConnected: string
  wifiSaved: string
  wifiSecured: string
  wifiOpenNetwork: string
  wifiPassword: string
  // `%d` is how many characters a WPA key takes at the least.
  wifiPasswordHint: string
  wifiConnect: string
  wifiCancel: string
  // `%s` is the network being joined, in all three.
  wifiJoining: string
  wifiWrongPassword: string
  wifiFailed: string

  // The bar pill's tooltip. `%s` is what is playing, as "title · artist".
  mediaTooltipPlaying: string
  mediaTooltipPaused: string
  mediaUnknown: string
  mediaPlay: string
  mediaPause: string
  mediaPrevious: string
  mediaNext: string
  mediaShuffle: string
  mediaRepeat: string
  mediaRepeatOff: string
  mediaRepeatTrack: string
  mediaRepeatAll: string

  notifications: string
  notificationsClear: string
  notificationsEmpty: string
  notificationDismiss: string
  // How long ago a notification arrived. `%d` is the count of the unit.
  notificationNow: string
  notificationMinutes: string
  notificationHours: string
  notificationDays: string

  battery: string
  batteryLeft: string
  batteryCharging: string
  // On AC with nothing left to put in, which upower reports as neither charging
  // nor discharging.
  batteryFull: string
  // Follows an estimate, as `batteryLeft` does: "2h 10m until full".
  batteryUntilFull: string
  // Cable in and the level held — a charge threshold, which upower calls
  // PENDING_CHARGE. Neither clock runs, so this stands in for an estimate.
  batteryPlugged: string
  uptime: string

  power: string
  powerLock: string
  powerLockMeta: string
  powerSuspend: string
  powerSuspendMeta: string
  powerLogout: string
  // `%d` is the number of open windows the session takes with it.
  powerLogoutMeta: string
  powerLogoutMetaOne: string
  powerRestart: string
  powerRestartMeta: string
  powerShutdown: string
  powerShutdownMeta: string
}

// The base every other language falls back to, key by key.
const EN: Strings = {
  dateFormat: "%a, %b %-d",

  weekStart: 0,

  calendar: "Calendar",
  calendarToday: "Today",
  calendarPreviousMonth: "Previous month",
  calendarNextMonth: "Next month",

  controlCenter: "Control Center",
  back: "Back",

  doNotDisturb: "Do Not Disturb",
  doNotDisturbOn: "On",
  doNotDisturbOff: "Off",

  nightLight: "Night Light",
  nightLightOff: "Off",
  nightLightKelvin: "%d K",

  volume: "Volume",
  volumeMuted: "Muted",
  volumePercent: "%d%",
  volumeMute: "Mute",
  volumeUnmute: "Unmute",

  audio: "Audio",
  audioOutput: "Output device",
  audioTooltip: "Sound — %s",

  wifi: "Wi-Fi",
  wifiOff: "Off",
  wifiDisconnected: "Not connected",
  wifiEnable: "Turn Wi-Fi on",
  wifiDisable: "Turn Wi-Fi off",
  wifiTooltip: "Wi-Fi — %s",
  wifiScanning: "Looking for networks",
  wifiEmpty: "No networks nearby",
  wifiConnected: "Connected",
  wifiSaved: "Saved",
  wifiSecured: "Secured",
  wifiOpenNetwork: "Open network",
  wifiPassword: "Password",
  wifiPasswordHint: "At least %d characters",
  wifiConnect: "Connect",
  wifiCancel: "Cancel",
  wifiJoining: "Connecting to %s",
  wifiWrongPassword: "Wrong password for %s",
  wifiFailed: "Could not connect to %s",

  mediaTooltipPlaying: "Playing — %s",
  mediaTooltipPaused: "Paused — %s",
  mediaUnknown: "Unknown track",
  mediaPlay: "Play",
  mediaPause: "Pause",
  mediaPrevious: "Previous",
  mediaNext: "Next",
  mediaShuffle: "Shuffle",
  mediaRepeat: "Repeat",
  mediaRepeatOff: "Off",
  mediaRepeatTrack: "This track",
  mediaRepeatAll: "Playlist",

  notifications: "Notifications",
  notificationsClear: "Clear all",
  notificationsEmpty: "Nothing new",
  notificationDismiss: "Dismiss",
  notificationNow: "now",
  notificationMinutes: "%dm",
  notificationHours: "%dh",
  notificationDays: "%dd",

  battery: "Battery",
  batteryLeft: "left",
  batteryCharging: "charging",
  batteryFull: "full",
  batteryUntilFull: "until full",
  batteryPlugged: "plugged in",
  uptime: "Uptime",

  power: "Power",
  powerLock: "Lock",
  powerLockMeta: "Screen locks now",
  powerSuspend: "Suspend",
  powerSuspendMeta: "Sleep to RAM",
  powerLogout: "Log out",
  powerLogoutMeta: "%d windows will close",
  powerLogoutMetaOne: "1 window will close",
  powerRestart: "Restart",
  powerRestartMeta: "Closes everything",
  powerShutdown: "Shut down",
  powerShutdownMeta: "Powers off the machine",
}

const PT_BR: Partial<Strings> = {
  dateFormat: "%a, %-d de %b",

  // Brazil's week starts on Sunday, as English's does. It is written out rather
  // than left to the fallback because it is a fact about the language and not
  // an untranslated string.
  weekStart: 0,

  calendar: "Calendário",
  calendarToday: "Hoje",
  calendarPreviousMonth: "Mês anterior",
  calendarNextMonth: "Próximo mês",

  controlCenter: "Central de controle",
  back: "Voltar",

  doNotDisturb: "Não perturbe",
  doNotDisturbOn: "Ligado",
  doNotDisturbOff: "Desligado",

  nightLight: "Luz noturna",
  nightLightOff: "Desligada",
  nightLightKelvin: "%d K",

  volume: "Volume",
  volumeMuted: "Mudo",
  volumePercent: "%d%",
  volumeMute: "Silenciar",
  volumeUnmute: "Ativar o som",

  audio: "Áudio",
  audioOutput: "Dispositivo de saída",
  audioTooltip: "Som — %s",

  wifi: "Wi-Fi",
  wifiOff: "Desligado",
  wifiDisconnected: "Sem conexão",
  wifiEnable: "Ligar o Wi-Fi",
  wifiDisable: "Desligar o Wi-Fi",
  wifiTooltip: "Wi-Fi — %s",
  wifiScanning: "Procurando redes",
  wifiEmpty: "Nenhuma rede por perto",
  wifiConnected: "Conectado",
  wifiSaved: "Salva",
  wifiSecured: "Protegida",
  wifiOpenNetwork: "Rede aberta",
  wifiPassword: "Senha",
  wifiPasswordHint: "No mínimo %d caracteres",
  wifiConnect: "Conectar",
  wifiCancel: "Cancelar",
  wifiJoining: "Conectando a %s",
  wifiWrongPassword: "Senha incorreta para %s",
  wifiFailed: "Não foi possível conectar a %s",

  mediaTooltipPlaying: "Tocando — %s",
  mediaTooltipPaused: "Pausado — %s",
  mediaUnknown: "Faixa desconhecida",
  mediaPlay: "Reproduzir",
  mediaPause: "Pausar",
  mediaPrevious: "Anterior",
  mediaNext: "Próxima",
  mediaShuffle: "Aleatório",
  mediaRepeat: "Repetir",
  mediaRepeatOff: "Desligado",
  mediaRepeatTrack: "Esta faixa",
  mediaRepeatAll: "Playlist",

  notifications: "Notificações",
  notificationsClear: "Limpar tudo",
  notificationsEmpty: "Nada de novo",
  notificationDismiss: "Dispensar",
  notificationNow: "agora",
  notificationMinutes: "%d min",
  notificationHours: "%d h",
  notificationDays: "%d d",

  battery: "Bateria",
  batteryLeft: "restantes",
  batteryCharging: "carregando",
  batteryFull: "carregada",
  batteryUntilFull: "até encher",
  batteryPlugged: "na tomada",
  uptime: "Ativo há",

  power: "Energia",
  powerLock: "Bloquear",
  powerLockMeta: "A tela bloqueia agora",
  powerSuspend: "Suspender",
  powerSuspendMeta: "Dormir na memória",
  powerLogout: "Encerrar sessão",
  powerLogoutMeta: "%d janelas serão fechadas",
  powerLogoutMetaOne: "1 janela será fechada",
  powerRestart: "Reiniciar",
  powerRestartMeta: "Fecha tudo",
  powerShutdown: "Desligar",
  powerShutdownMeta: "Desliga a máquina",
}

const CATALOG: Record<string, Partial<Strings>> = {
  en: {},
  pt: PT_BR,
  "pt-br": PT_BR,
}

// What the dates are formatted under, so LC_TIME outranks LANG here — LC_ALL
// still overrides both. Empty means the locale is unset and glibc falls back
// to C, which is English.
function systemLanguage(): string {
  for (const name of ["LC_ALL", "LC_TIME", "LANG"]) {
    const value = GLib.getenv(name)
    if (value) return value
  }
  return "en"
}

// Accepts "pt", "pt-BR", "pt_BR" and "pt_BR.UTF-8" alike, then falls back to the
// primary subtag, so an unlisted region still gets its language.
function resolve(language: string): Partial<Strings> {
  const tag = language.split(".")[0].split("@")[0].replace("_", "-").toLowerCase()
  if (tag === "c" || tag === "posix") return {}
  const table = CATALOG[tag] ?? CATALOG[tag.split("-")[0]]
  if (!table) {
    console.warn(`struntuz-topbar: unknown language "${language}", using English`)
    return {}
  }
  return table
}

export const t: Strings = { ...EN, ...resolve(getConfig().language || systemLanguage()) }
