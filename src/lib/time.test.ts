import { describe, expect, it } from 'vitest';
import { addLocalDays, formatLocal, isoWeekday, localTimeOfDay, startOfLocalDay } from './time';

describe('time (America/Santiago)', () => {
  it('muestra 14:30 de Santiago cuando el UTC es 17:30 en horario de verano (UTC-3)', () => {
    // 2026-11-06 está en horario de verano (UTC-3)
    expect(formatLocal('2026-11-06T17:30:00Z', 'HH:mm')).toBe('14:30');
  });

  it('usa UTC-4 en invierno', () => {
    // 2026-07-01 está en horario de invierno (UTC-4)
    expect(formatLocal('2026-07-01T18:30:00Z', 'HH:mm')).toBe('14:30');
  });

  it('calcula el día ISO con lunes = 1 y domingo = 7', () => {
    expect(isoWeekday('2026-11-09T15:00:00Z')).toBe(1); // lunes
    expect(isoWeekday('2026-11-14T15:00:00Z')).toBe(6); // sábado
    expect(isoWeekday('2026-11-15T15:00:00Z')).toBe(7); // domingo
  });

  it('inicia el día a las 00:00 de Santiago', () => {
    // 2026-11-06 00:00 en Santiago (UTC-3) = 03:00Z
    expect(startOfLocalDay('2026-11-06T17:30:00Z').toISOString()).toBe('2026-11-06T03:00:00.000Z');
  });

  it('suma días respetando la zona local', () => {
    expect(addLocalDays('2026-11-06T17:30:00Z', 1).toISOString()).toBe('2026-11-07T17:30:00.000Z');
  });

  it('devuelve HH:mm local para comparar con ajustes', () => {
    expect(localTimeOfDay('2026-11-06T11:00:00Z')).toBe('08:00');
  });
});
