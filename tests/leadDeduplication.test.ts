import { describe, it, expect } from 'vitest';
import { shouldDeduplicateLead, buildAppendedLeadComments, DEDUPLICATION_WINDOW_HOURS } from '../lib/leadDeduplication';

describe('Lead Deduplication Logic', () => {
  const now = new Date('2026-10-23T12:00:00.000Z');

  it('detects duplicate lead when an open opportunity exists within the window', () => {
    // Lead created 15 seconds ago (like José)
    const existingOp = {
      id: 'opp-1',
      nombre: 'José',
      comentarios: 'Formulario web inicial',
      owner_user_id: 'user-1',
      created_at: new Date(now.getTime() - 15 * 1000).toISOString(),
      estado_id: 8 // Contacto Inicial
    };

    expect(shouldDeduplicateLead(existingOp, DEDUPLICATION_WINDOW_HOURS, now)).toBe(true);
  });

  it('detects duplicate lead when an open opportunity exists 3 minutes ago (like Alejandro / Diana)', () => {
    const existingOp = {
      id: 'opp-2',
      nombre: 'Alejandro',
      comentarios: 'Interesado en hidromasaje',
      owner_user_id: 'user-1',
      created_at: new Date(now.getTime() - 3 * 60 * 1000).toISOString(),
      estado_id: 1 // Abierta
    };

    expect(shouldDeduplicateLead(existingOp, DEDUPLICATION_WINDOW_HOURS, now)).toBe(true);
  });

  it('does NOT deduplicate if the existing opportunity is closed (e.g. Perdida or Ganada)', () => {
    const existingLostOp = {
      id: 'opp-3',
      nombre: 'Cliente',
      created_at: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
      estado_id: 3 // Perdida
    };

    expect(shouldDeduplicateLead(existingLostOp, DEDUPLICATION_WINDOW_HOURS, now)).toBe(false);
  });

  it('does NOT deduplicate if the existing opportunity was created outside the window (e.g. 30 days ago)', () => {
    const oldOp = {
      id: 'opp-4',
      nombre: 'Cliente',
      created_at: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      estado_id: 8
    };

    expect(shouldDeduplicateLead(oldOp, DEDUPLICATION_WINDOW_HOURS, now)).toBe(false);
  });

  it('appends interaction comments clearly without erasing previous comments', () => {
    const previousComments = 'Cliente solicitó asesor';
    const newLead = {
      fuente_conversion: 'Formulario WhatsApp',
      comentarios: 'Deseo cotizar tina',
      url_origen: 'https://firplak.com/tina'
    };

    const result = buildAppendedLeadComments(previousComments, newLead, '2026-10-23T12:00:15.000Z');
    expect(result).toContain('Cliente solicitó asesor');
    expect(result).toContain('[Re-contacto web: Formulario WhatsApp]');
    expect(result).toContain('Deseo cotizar tina');
    expect(result).toContain('https://firplak.com/tina');
  });
});
