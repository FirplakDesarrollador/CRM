import { expect, test } from '@playwright/test';

test.describe('Create activity wizard', () => {
    test('does not submit when advancing from step 2 to the final step', async ({ page }) => {
        await page.goto('/e2e/activities-wizard');

        await expect(page.getByText('Tipo & Asunto')).toBeVisible();
        await expect(page.getByTestId('activity-submit-count')).toHaveText('Envios: 0');

        await page.locator('input[name="asunto"]').fill(`Actividad E2E ${Date.now()}`);
        await page.getByRole('button', { name: /Siguiente/i }).click();

        await expect(page.getByText('Clasificación & Fechas')).toBeVisible();
        await page.getByTestId('activity-classification-select').click();
        await page.getByPlaceholder('Buscar clasificación...').fill('Seguimiento E2E');
        await page.getByRole('option', { name: 'Seguimiento E2E' }).click();

        const nextButton = page.getByRole('button', { name: /Siguiente/i });
        await nextButton.dblclick();

        await expect(page.getByText('Detalles')).toBeVisible();
        await expect(page.getByTestId('activity-submit-count')).toHaveText('Envios: 0');
        await expect(page.getByRole('button', { name: /Agendar Evento/i })).toBeDisabled();

        await page.waitForTimeout(600);
        await expect(page.getByRole('button', { name: /Agendar Evento/i })).toBeEnabled();
        await expect(page.getByTestId('activity-submit-count')).toHaveText('Envios: 0');
    });
});
