export const SLOT_START = 8;
export const SLOT_END = 22;

export function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function formatSlot(slot) {
  return `${String(slot).padStart(2, '0')}:00`;
}

export function formatSlotRange(start, end) {
  return `${formatSlot(start)} – ${formatSlot(end)}`;
}

export function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function startOfWeek(iso) {
  const d = new Date(iso + 'T00:00:00');
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

export const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function weekDates(startIso) {
  return Array.from({ length: 7 }, (_, i) => addDays(startIso, i));
}
