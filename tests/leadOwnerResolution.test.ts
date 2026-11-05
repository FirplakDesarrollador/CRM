import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  FALLBACK_OWNER_ID,
  normalizeAdvisorEmail,
  resolveLeadOwnerId,
} from '../supabase/functions/wordpress-lead-intake/ownerResolution';

const users = [
  { id: 'claudia', email: 'claudia.granada@firplak.com', is_active: true, is_deleted: false },
  { id: 'stiven', email: 'brian.rua@firplak.com', is_active: true, is_deleted: false },
  { id: 'katherine', email: 'comercial2@firplak.com', is_active: false, is_deleted: false },
  { id: 'hernando', email: 'comercialcali@behome.com.co', is_active: true, is_deleted: false },
  { id: 'gabriel', email: 'gabriel.molina@firplak.com', is_active: true, is_deleted: false },
];

describe('wordpress-lead-intake: asesor del lead web', () => {
  it('asigna al asesor que reporta WordPress aunque no esté en un mapa fijo', () => {
    expect(resolveLeadOwnerId('gabriel.molina@firplak.com', users)).toBe('gabriel');
    expect(resolveLeadOwnerId(' Claudia.Granada@firplak.com ', users)).toBe('claudia');
  });

  it('única reasignación válida: comercial2@ -> Stiven Rua', () => {
    expect(normalizeAdvisorEmail('comercial2@firplak.com')).toBe('brian.rua@firplak.com');
    expect(resolveLeadOwnerId('comercial2@firplak.com', users)).toBe('stiven');
  });

  it('Hernando Tovar: comercialcali@firplak.com es alias de su usuario CRM', () => {
    expect(resolveLeadOwnerId('comercialcali@firplak.com', users)).toBe('hernando');
  });

  it('correo vacío, desconocido o de usuario inactivo cae en Canal Propio', () => {
    expect(resolveLeadOwnerId('', users)).toBe(FALLBACK_OWNER_ID);
    expect(resolveLeadOwnerId('esteban.montoya@firplak.com', users)).toBe(FALLBACK_OWNER_ID);
    expect(resolveLeadOwnerId('x@firplak.com', [{ id: 'x', email: 'x@firplak.com', is_active: false }])).toBe(FALLBACK_OWNER_ID);
  });

  it('la Edge Function usa el resolver y no el mapa fijo de 5 correos', () => {
    const edge = readFileSync(
      path.join(process.cwd(), 'supabase', 'functions', 'wordpress-lead-intake', 'index.ts'),
      'utf8',
    );
    expect(edge).toContain('resolveLeadOwnerId');
    expect(edge).not.toContain('ASESORES_POR_CORREO');
  });
});
