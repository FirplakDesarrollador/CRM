import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  formatQuoteAdvisorEmailLine,
  toFirplakDisplayEmail,
} from '@/lib/corporateEmail';

describe('Correo corporativo en el pie de la cotización', () => {
  it('reescribe administradormedellin@behome.com.co al dominio firplak.com', () => {
    expect(toFirplakDisplayEmail('administradormedellin@behome.com.co')).toBe(
      'administradormedellin@firplak.com',
    );
    expect(formatQuoteAdvisorEmailLine('administradormedellin@behome.com.co')).toBe(
      'Email: administradormedellin@firplak.com • www.firplak.com',
    );
  });

  it('reescribe @behome.com y conserva mayúsculas solo en la parte local', () => {
    expect(toFirplakDisplayEmail('administradormedellin@behome.com')).toBe(
      'administradormedellin@firplak.com',
    );
    expect(toFirplakDisplayEmail(' AdministradorMedellin@BeHome.COM.CO ')).toBe(
      'AdministradorMedellin@firplak.com',
    );
  });

  it('no toca correos firplak ni direcciones que solo contienen la palabra behome', () => {
    expect(toFirplakDisplayEmail('cartera@firplak.com')).toBe('cartera@firplak.com');
    expect(toFirplakDisplayEmail('behomecovi@gmail.com')).toBe('behomecovi@gmail.com');
    expect(toFirplakDisplayEmail('kabehomesas@gmail.com')).toBe('kabehomesas@gmail.com');
    expect(toFirplakDisplayEmail('alguien@behome.com.mx')).toBe('alguien@behome.com.mx');
    expect(toFirplakDisplayEmail('')).toBe('');
    expect(toFirplakDisplayEmail(null)).toBe('');
  });

  it('si no hay correo de asesor, el pie usa cartera@firplak.com', () => {
    expect(formatQuoteAdvisorEmailLine('')).toBe('Email: cartera@firplak.com • www.firplak.com');
    expect(formatQuoteAdvisorEmailLine(undefined)).toBe('Email: cartera@firplak.com • www.firplak.com');
  });

  it('el PDF de cotización imprime la línea ya normalizada', () => {
    const source = readFileSync(path.join(process.cwd(), 'lib/pdfGenerator.ts'), 'utf8');
    expect(source).toContain('formatQuoteAdvisorEmailLine');
    expect(source).not.toContain('Email: ${emailToDisplay}');
  });
});
