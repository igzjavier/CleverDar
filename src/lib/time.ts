// Todas las conversiones de zona horaria pasan por aquí (PLAN.md §11.5).
// Las horas se guardan en UTC y se muestran en America/Santiago.
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

export const APP_TIMEZONE = 'America/Santiago';

/** Hora local de Santiago como objeto Date "de pared" (sin desplazamiento). */
export function toLocal(utc: Date | string): Date {
  return toZonedTime(typeof utc === 'string' ? new Date(utc) : utc, APP_TIMEZONE);
}

/** Convierte una fecha y hora "de pared" en Santiago a UTC. */
export function fromLocal(localWallClock: Date): Date {
  return fromZonedTime(localWallClock, APP_TIMEZONE);
}

/** Formatea una fecha UTC en la zona de la app. Ej.: "14:30", "lun 9 nov". */
export function formatLocal(utc: Date | string, pattern: string): string {
  const d = typeof utc === 'string' ? new Date(utc) : utc;
  return formatInTimeZone(d, APP_TIMEZONE, pattern, { locale: undefined });
}

/** Día ISO de la semana: lunes = 1 … domingo = 7 (PLAN.md §4, protected_weekdays). */
export function isoWeekday(utc: Date | string): number {
  const d = toLocal(utc);
  const js = d.getDay(); // 0 = domingo
  return js === 0 ? 7 : js;
}

/** Inicio del día local (00:00 Santiago) expresado en UTC. */
export function startOfLocalDay(utc: Date | string): Date {
  const local = toLocal(utc);
  local.setHours(0, 0, 0, 0);
  return fromLocal(local);
}

/** Suma días calendario en la zona local, respetando el cambio de horario. */
export function addLocalDays(utc: Date | string, days: number): Date {
  const local = toLocal(utc);
  local.setDate(local.getDate() + days);
  return fromLocal(local);
}

/** Hora "HH:mm" de un instante en Santiago, para comparar con ajustes (day_start, etc.). */
export function localTimeOfDay(utc: Date | string): string {
  return formatLocal(utc, 'HH:mm');
}
