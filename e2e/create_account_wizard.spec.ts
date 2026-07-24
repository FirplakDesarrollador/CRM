import { test, expect } from '@playwright/test';

test.describe('Create account wizard', () => {
    test('does not submit or redirect when advancing from step 2 to step 3', async ({ page }) => {
        await page.goto('/e2e/cuentas-wizard');

        await expect(page.getByRole('heading', { name: 'Crear Nueva Cuenta' })).toBeVisible();
        await expect(page.getByText('Información Base')).toBeVisible();

        await page.getByPlaceholder('Ej. Constructora Firplak SAS').fill(`Cuenta E2E ${Date.now()}`);
        await page.getByPlaceholder('Ej. 900123456').fill('900123456');
        await page.getByRole('button', { name: /Siguiente/i }).click();

        await expect(page.getByText('Ubicación y Contacto')).toBeVisible();
        await page.getByPlaceholder('correo@ejemplo.com').fill('wizard.e2e@example.com');

        const nextButton = page.getByRole('button', { name: /Siguiente/i });
        await nextButton.dblclick();

        await expect(page).toHaveURL(/\/e2e\/cuentas-wizard/);
        await expect(page.getByText('Clasificación')).toBeVisible();
        await expect(page.getByText('Nivel de Cliente (Premium)')).toBeVisible();
        await expect(page.getByRole('button', { name: /Crear Cuenta/i })).toBeDisabled();

        await page.waitForTimeout(600);
        await expect(page.getByRole('button', { name: /Crear Cuenta/i })).toBeEnabled();
        await expect(page).toHaveURL(/\/e2e\/cuentas-wizard/);
    });
});
