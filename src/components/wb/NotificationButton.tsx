import { useEffect, useMemo, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";

type NotificationSection = "weather" | "roads" | "news";
type PermissionState = NotificationPermission | "unsupported";

type NotificationSchedule = {
  section: NotificationSection;
  label: string;
  emoji: string;
  enabled: boolean;
  time: string;
  lastTriggeredDate?: string;
};

type NotificationSettings = Record<NotificationSection, NotificationSchedule>;

const STORAGE_KEY = "snarr.notificationSettings";
const CHECK_INTERVAL_MS = 30 * 1000;

const DEFAULT_SETTINGS: NotificationSettings = {
  weather: {
    section: "weather",
    label: "Weather",
    emoji: "🌤️",
    enabled: false,
    time: "07:00",
  },
  roads: {
    section: "roads",
    label: "Roads",
    emoji: "🛣️",
    enabled: false,
    time: "07:30",
  },
  news: {
    section: "news",
    label: "News",
    emoji: "📰",
    enabled: false,
    time: "08:00",
  },
};

function getPermissionState(): PermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function loadSettings(): NotificationSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
    return {
      weather: { ...DEFAULT_SETTINGS.weather, ...parsed.weather },
      roads: { ...DEFAULT_SETTINGS.roads, ...parsed.roads },
      news: { ...DEFAULT_SETTINGS.news, ...parsed.news },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: NotificationSettings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

function todayKey() {
  return new Date().toLocaleDateString("en-CA");
}

function currentTimeKey() {
  return new Date().toTimeString().slice(0, 5);
}

function sendLocalNotification(schedule: NotificationSchedule) {
  if (getPermissionState() !== "granted") return;

  new Notification(`Snarr ${schedule.label}`, {
    body: `${schedule.emoji} Your ${schedule.label.toLowerCase()} notification is ready. Open Snarr to view it.`,
    tag: `snarr-${schedule.section}-daily`,
  });
}

export function NotificationButton() {
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<PermissionState>(() => getPermissionState());
  const [settings, setSettings] = useState<NotificationSettings>(() => loadSettings());

  const enabledCount = useMemo(
    () => Object.values(settings).filter((schedule) => schedule.enabled).length,
    [settings],
  );

  const permissionLabel = permission === "granted"
    ? "Notifications enabled"
    : permission === "denied"
      ? "Notifications blocked"
      : permission === "unsupported"
        ? "Not supported"
        : "Permission needed";

  async function requestPermission() {
    if (permission === "unsupported" || !("Notification" in window)) return;

    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
  }

  function updateSchedule(section: NotificationSection, changes: Partial<NotificationSchedule>) {
    setSettings((prev) => {
      const next = {
        ...prev,
        [section]: {
          ...prev[section],
          ...changes,
        },
      };

      saveSettings(next);
      return next;
    });
  }

  async function toggleSection(section: NotificationSection, enabled: boolean) {
    if (enabled && permission !== "granted") {
      await requestPermission();
      const latestPermission = getPermissionState();
      setPermission(latestPermission);
      if (latestPermission !== "granted") return;
    }

    updateSchedule(section, { enabled });
  }

  function testNotification(section: NotificationSection) {
    if (permission !== "granted") return;
    sendLocalNotification(settings[section]);
  }

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (getPermissionState() !== "granted") return;

      const nowTime = currentTimeKey();
      const today = todayKey();
      let changed = false;

      const nextSettings = { ...settings };

      for (const schedule of Object.values(settings)) {
        if (!schedule.enabled) continue;
        if (schedule.time !== nowTime) continue;
        if (schedule.lastTriggeredDate === today) continue;

        sendLocalNotification(schedule);
        nextSettings[schedule.section] = {
          ...schedule,
          lastTriggeredDate: today,
        };
        changed = true;
      }

      if (changed) {
        setSettings(nextSettings);
        saveSettings(nextSettings);
      }
    }, CHECK_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [settings]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative h-8 w-8 rounded-full bg-secondary text-secondary-foreground hover:bg-accent transition-colors flex items-center justify-center"
        aria-expanded={open}
        aria-label="Notification settings"
      >
        {enabledCount > 0 ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        {enabledCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[8px] font-bold text-primary-foreground">
            {enabledCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close notification settings"
            className="fixed inset-0 z-30 cursor-default bg-transparent"
            onClick={() => setOpen(false)}
          />

          <div
            className="fixed left-4 right-4 z-40 mx-auto max-w-md animate-fade-in overflow-y-auto overscroll-contain rounded-3xl bg-card p-3 shadow-[var(--shadow-soft)] border border-border/50"
            style={{
              top: "calc(env(safe-area-inset-top) + 5.25rem)",
              maxHeight: "calc(100vh - env(safe-area-inset-top) - 6.5rem)",
            }}
          >
            <div className="flex items-center justify-between gap-2 px-0.5">
              <div>
                <div className="flex items-center gap-1.5">
                  <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                  <h2 className="text-[12px] font-semibold text-foreground">Notifications</h2>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{permissionLabel}</p>
              </div>

              {permission !== "granted" && permission !== "unsupported" && (
                <button
                  type="button"
                  onClick={requestPermission}
                  className="rounded-full bg-primary px-3 py-1 text-[10px] font-medium text-primary-foreground"
                >
                  Allow
                </button>
              )}
            </div>

            {permission === "unsupported" && (
              <p className="mt-2 rounded-xl bg-secondary/40 px-3 py-2 text-[11px] text-muted-foreground">
                Browser notifications are not supported on this device/browser.
              </p>
            )}

            {permission === "denied" && (
              <p className="mt-2 rounded-xl bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                Notifications are blocked. Enable them in your browser or phone settings to use this feature.
              </p>
            )}

            <div className="mt-2 space-y-1.5">
              {Object.values(settings).map((schedule) => (
                <div
                  key={schedule.section}
                  className="rounded-xl bg-secondary/40 px-2.5 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs">
                          {schedule.emoji}
                        </span>
                        <span className="truncate text-[12px] font-medium text-foreground">
                          {schedule.label}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                        Trigger daily at your device time.
                      </p>
                    </div>

                    <Switch
                      checked={schedule.enabled}
                      onCheckedChange={(checked) => void toggleSection(schedule.section, checked)}
                      disabled={permission === "unsupported" || permission === "denied"}
                      aria-label={`Toggle ${schedule.label} notification`}
                    />
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Time
                    </label>
                    <input
                      type="time"
                      value={schedule.time}
                      onChange={(event) => updateSchedule(schedule.section, { time: event.target.value })}
                      className="h-8 rounded-full border border-border bg-background px-3 text-[12px] text-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => testNotification(schedule.section)}
                      disabled={permission !== "granted"}
                      className="ml-auto rounded-full bg-card px-3 py-1.5 text-[10px] font-medium text-foreground shadow-[var(--shadow-card)] disabled:opacity-50"
                    >
                      Test
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2 rounded-xl bg-secondary/30 px-3 py-2 text-[10px] text-muted-foreground leading-relaxed">
              This first version schedules local browser notifications while Snarr is open or installed. Push notifications while the app is fully closed can be added later with a service worker/back-end push setup.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
