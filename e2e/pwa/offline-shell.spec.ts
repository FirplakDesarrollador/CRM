import { expect, test } from '@playwright/test';

const serviceWorkerReady = `
  async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker no disponible');
    }
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Service Worker no se activo')), 15_000)),
    ]);
  }
`;

test('publica los helpers PWA como JavaScript y no cachea datos privados', async ({ request }) => {
  const swResponse = await request.get('/sw.js');
  expect(swResponse.status()).toBe(200);
  expect(swResponse.headers()['content-type']).toContain('javascript');

  const swSource = await swResponse.text();
  const helperPaths = new Set([
    ...[...swSource.matchAll(/importScripts\("([^"]+)"\)/g)].map((match) => match[1]),
    ...[...swSource.matchAll(/["']\.\/(workbox-[^"']+)["']/g)].map((match) => `/${match[1]}.js`),
  ]);
  expect(helperPaths.size).toBeGreaterThan(1);

  for (const helperPath of helperPaths) {
    const response = await request.get(helperPath, { maxRedirects: 0 });
    expect(response.status(), `${helperPath} no debe redirigir a login`).toBe(200);
    expect(response.headers()['content-type'], `${helperPath} debe ser JavaScript`).toContain('javascript');
    expect((await response.text()).trimStart(), `${helperPath} no debe devolver HTML`).not.toMatch(/^<!doctype html/i);
  }

  expect(swSource, 'las respuestas API autenticadas no deben persistir en Cache Storage').not.toContain('cacheName:"apis"');
  expect(swSource, 'el catch-all no debe persistir respuestas privadas o de terceros').not.toContain('cacheName:"others"');
  expect(swSource, 'la ruta protegida / no pertenece al shell publico').not.toContain('cacheName:"start-url"');
});

test('instala el shell publico y recarga login sin internet', async ({ page, context }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Bienvenido' })).toBeVisible();
  await page.evaluate(serviceWorkerReady);

  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  const cacheKeys = await page.evaluate(() => caches.keys());
  expect(cacheKeys.length).toBeGreaterThan(0);

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Bienvenido' })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
