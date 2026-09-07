import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
const password = 'demo-passphrase-2026';
const secretValue = 'demo-only-not-a-real-api-key-1234';
async function launch(directory: string) {
  const extension = resolve('dist');
  const context = await chromium.launchPersistentContext(directory, {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    viewport: { width: 380, height: 600 },
  });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  return { context, id };
}
async function popup(context: BrowserContext, id: string) {
  const page = await context.newPage(); await page.goto(`chrome-extension://${id}/popup.html`); return page;
}
async function add(page: Page, name: string) {
  await page.getByRole('button', { name: 'Add API Key', exact: true }).first().click();
  await page.getByLabel('Service', { exact: true }).fill('Example API');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Secret', { exact: true }).fill(secretValue);
  await page.getByRole('button', { name: 'Save key' }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}
async function storeShot(page: Page, file: string) {
  await page.setViewportSize({ width: 1280, height: 800 });
  const style = await page.addStyleTag({ content: 'body{margin:100px 160px 100px auto;box-shadow:0 15px 65px #203c311a;border:1px solid #e0e6e1;border-radius:12px}html{background:#eef2ef}html::before{content:"Envpin";position:fixed;left:130px;top:260px;color:#253d32;font:700 64px system-ui;letter-spacing:-3px}html::after{content:"Pin. Copy. Build.\\a API keys, ready when you are.";white-space:pre;position:fixed;left:133px;top:355px;color:#607367;font:22px/1.9 system-ui}' });
  await page.screenshot({ path: file });
  await style.evaluate(element => element.parentNode?.removeChild(element));
  await page.setViewportSize({ width: 380, height: 600 });
}
test('packaged extension: lifecycle, clipboard, scrolling, two-profile transport, deletion and restart', async () => {
  const profileA = await mkdtemp(join(tmpdir(), 'envpin-e2e-a-'));
  const profileB = await mkdtemp(join(tmpdir(), 'envpin-e2e-b-'));
  let a: Awaited<ReturnType<typeof launch>> | undefined, b: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    a = await launch(profileA);
    let page = await popup(a.context, a.id);
    const errors: string[] = [];
    page.on('pageerror', () => errors.push('Unexpected page error'));
    await page.getByLabel('Master Password', { exact: true }).fill('1234567');
    await page.getByLabel('Confirm Password').fill('1234567');
    await page.getByRole('button', { name: 'Create Vault' }).click();
    await expect(page.getByRole('heading', { name: 'Create your vault' })).toBeVisible();
    await page.getByLabel('Master Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm Password').fill(password);
    await page.getByRole('button', { name: 'Create Vault' }).click();
    await expect(page.getByText('No API keys yet')).toBeVisible();
    for (const name of ['Personal demo', 'Development demo', 'Staging demo', 'Sandbox demo']) await add(page, name);
    const header = await page.locator('header').boundingBox();
    await page.locator('.keys-scroll').evaluate(element => { element.scrollTop = element.scrollHeight; });
    expect(await page.locator('header').boundingBox()).toEqual(header);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(600);
    expect(await page.locator('.keys-scroll').evaluate(element => getComputedStyle(element, '::-webkit-scrollbar').width)).toBe('6px');
    await page.locator('.keys-scroll').evaluate(element => { element.scrollTop = 0; });
    const card = page.locator('article').filter({ hasText: 'Personal demo' });
    await card.getByRole('button', { name: 'Show', exact: true }).click();
    await expect(card.locator('code')).toHaveText(secretValue);
    await expect(card.getByRole('button', { name: 'Show', exact: true })).toBeVisible({ timeout: 12_000 });
    await card.getByRole('button', { name: 'Copy Example API / Personal demo' }).click();
    await expect(card.getByText('Copied ✓')).toBeVisible();
    // Read from a separate local test page; no extra extension permission is granted.
    const clipboardPage = await a.context.newPage();
    await clipboardPage.route('http://127.0.0.1/clipboard-test', route => route.fulfill({ contentType: 'text/html', body: '<title>Clipboard test</title>' }));
    await a.context.grantPermissions(['clipboard-read'], { origin: 'http://127.0.0.1' });
    await clipboardPage.goto('http://127.0.0.1/clipboard-test');
    expect(await clipboardPage.evaluate(async expected => await navigator.clipboard.readText() === expected, secretValue)).toBe(true);
    await clipboardPage.close(); await a.context.clearPermissions();
    await page.bringToFront();
    await page.getByRole('searchbox').fill('demo-only-not');
    await expect(page.getByText('No keys match your search.')).toBeVisible();
    await page.getByRole('searchbox').fill('');
    const encrypted = await page.evaluate(() => chrome.storage.sync.get(null));
    const serialized = JSON.stringify(encrypted);
    for (const plain of [password, secretValue, 'Example API', 'Personal demo']) expect(serialized.includes(plain)).toBe(false);
    expect(await page.evaluate(() => chrome.storage.local.get(null))).toEqual({});
    await page.locator('.keys-scroll').evaluate(element => { element.scrollTop = 0; });
    await storeShot(page, 'store/screenshot-keys-1280x800.png');
    await page.close(); page = await popup(a.context, a.id);
    await expect(page.getByRole('searchbox')).toBeVisible();
    await page.getByRole('button', { name: 'Lock vault' }).click();
    await expect(page.getByRole('heading', { name: 'Vault locked' })).toBeVisible();
    await storeShot(page, 'store/screenshot-lock-1280x800.png');
    await page.getByLabel('Master Password', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Unable to unlock');
    await page.getByLabel('Master Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
    await expect(page.getByRole('searchbox')).toBeVisible();
    b = await launch(profileB); const other = await popup(b.context, b.id);
    expect(b.id).toBe(a.id);
    // Relay ciphertext explicitly. This verifies real storage/onChanged, not Google's Sync service.
    await other.evaluate(data => chrome.storage.sync.set(data), encrypted);
    await other.reload();
    await other.getByLabel('Master Password', { exact: true }).fill(password);
    await other.getByRole('button', { name: 'Unlock', exact: true }).click();
    await expect(other.getByText('Personal demo', { exact: true })).toBeVisible();
    await other.getByRole('button', { name: 'Delete Example API / Personal demo' }).click();
    await other.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(other.getByText('Personal demo', { exact: true })).toHaveCount(0);
    const afterDelete = await other.evaluate(() => chrome.storage.sync.get(null));
    await page.evaluate(data => chrome.storage.sync.set(data), afterDelete);
    await expect(page.getByText('Personal demo', { exact: true })).toHaveCount(0);
    // Replaying an outdated copy must not undo the retained tombstone.
    await page.evaluate(data => chrome.storage.sync.set(data), encrypted);
    await expect.poll(async () => page.evaluate(async () => Object.values(await chrome.storage.sync.get(null)).filter(v => v.kind === 'deleted').length)).toBe(1);
    await page.reload(); await expect(page.getByText('Personal demo', { exact: true })).toHaveCount(0);
    const privacyPagePromise = a.context.waitForEvent('page');
    await page.getByRole('link', { name: 'Privacy', exact: true }).click();
    const privacy = await privacyPagePromise; await expect(privacy.getByRole('heading', { name: 'Envpin Privacy Policy', exact: true })).toBeVisible();
    await a.context.close(); a = await launch(profileA); page = await popup(a.context, a.id);
    await expect(page.getByRole('heading', { name: 'Vault locked' })).toBeVisible();
    expect(await page.evaluate(() => chrome.storage.session.get('vault:session'))).toEqual({});
    expect(errors).toEqual([]);
  } finally {
    await a?.context.close(); await b?.context.close();
    await rm(profileA, { recursive: true, force: true }); await rm(profileB, { recursive: true, force: true });
  }
});
