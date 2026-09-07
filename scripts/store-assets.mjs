import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const svg = readFileSync('public/icons/mark.svg', 'utf8');
  for (const size of [16, 32, 48, 128]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
    await page.screenshot({ path: `public/icons/icon-${size}.png`, omitBackground: true });
  }
  await page.setViewportSize({ width: 440, height: 280 });
  await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#253d32;color:#f8faf8;font-family:system-ui,sans-serif;padding:36px 38px}svg{width:62px;height:62px;margin-left:-5px}h1{font-size:36px;letter-spacing:-1.5px;margin:5px 0 6px}p{font-size:17px;margin:0;color:#b6d5ba}.sub{font-size:12px;margin-top:23px;color:#dae7dd}</style>${svg}<h1>Envpin</h1><p>Pin. Copy. Build.</p><p class="sub">Your API keys. One encrypted vault.</p>`);
  await page.screenshot({ path: 'store/promo-440x280.png' });
} finally { await browser.close(); }
