import { expect, test } from '@playwright/test';
import { api, login } from './helpers.js';

test.describe('"Who is your Secret Santa?" and the list (D28)', () => {
  test.afterEach(async () => {
    await api('PUT', '/api/persona', null);
    await api('PUT', '/api/list', { lines: [], pasted: '' });
  });

  test('setup asks "Who is your Secret Santa?" after the agent is chosen: just my agent by default, personas on request', async ({ page }) => {
    await login(page, '/setup');
    await page.getByRole('button', { name: 'Continue' }).click();
    // Agents only: no chat modes, no MCP, no "gifts possible".
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/Connected|Portable|MCP|paste a request|desktop app/i);
    await expect(page.getByRole('heading', { name: 'Which agent?' })).toBeVisible();
    // The question appears once an agent is chosen.
    await expect(page.getByRole('heading', { name: 'Who is your Secret Santa?' })).toHaveCount(0);
    await page.getByRole('button', { name: /Custom command/ }).click();
    await expect(page.getByRole('heading', { name: 'Who is your Secret Santa?' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Just my agent' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('radio', { name: 'One of my personas' }).click();
    const noodle = page.getByRole('radio', { name: /Noodle/ });
    await expect(noodle).toBeVisible();
    await expect(noodle).toContainText('a calm cat');
    await expect(page.getByRole('button', { name: 'Choose a file…' })).toBeVisible();
    await noodle.click();
    await expect(noodle).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText(/Its notes will be signed with that name/)).toBeVisible();
    const persona = await api<{ persona: { name: string } | null }>('GET', '/api/persona');
    expect(persona.persona?.name).toBe('Noodle');
  });

  test('Settings: the persona with Change and Refresh, and an editable list with a paste box', async ({ page }) => {
    const cands = await api<{ candidates: Array<{ id: string }> }>('GET', '/api/persona/candidates');
    await api('PUT', '/api/persona', { candidateId: cands.candidates[0]!.id });
    await api('PUT', '/api/list', { lines: [{ text: 'Rows on the lake every morning' }, { text: 'Dog called Biscuit' }] });
    await login(page, '/settings');
    await expect(page.getByRole('heading', { name: 'Your Secret Santa', exact: true })).toBeVisible();
    await expect(page.getByText('Noodle').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Your Secret Santa’s list/ })).toBeVisible();
    const lines = page.getByLabel('List line');
    await expect(lines).toHaveCount(2);
    await lines.first().fill('Rows at dawn');
    await lines.first().blur();
    await expect.poll(async () => (await api<{ lines: Array<{ text: string }> }>('GET', '/api/list')).lines.map((l) => l.text)).toContain('Rows at dawn');
    await page.getByRole('button', { name: /Delete: Dog called Biscuit/ }).click();
    await expect.poll(async () => (await api<{ lines: unknown[] }>('GET', '/api/list')).lines.length).toBe(1);
    const paste = page.getByLabel('Paste what your Claude or ChatGPT app knows about you');
    await expect(paste).toHaveAttribute('placeholder', 'Ask your app: what do you know about me?');
    await paste.fill('- Plays the cello');
    await paste.blur();
    await expect.poll(async () => (await api<{ pasted: string }>('GET', '/api/list')).pasted).toBe('- Plays the cello');
  });

  test('onboarding step 2 says the Secret Santa checks its list, and nothing leaves the computer', async ({ page }) => {
    await api('PUT', '/api/settings', { onboardingDone: false });
    try {
      await login(page, '/');
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: 'Next' }).click();
      await expect(dialog.getByText('Before wrapping, your Secret Santa checks its list. Nothing leaves your computer.')).toBeVisible();
    } finally {
      await api('PUT', '/api/settings', { onboardingDone: true });
    }
  });
});
