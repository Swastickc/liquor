export function openNow(settings, date = new Date()) {
  if (!settings?.is_open) return false;
  const current = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  const start = settings.opens_at.slice(0, 5),
    end = settings.closes_at.slice(0, 5);
  if (start === end) return true;
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}
