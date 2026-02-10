import { expect, test } from '@playwright/test'

test('smoke: открывает главную и видит заголовок', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Запись к врачу' })).toBeVisible()
})
