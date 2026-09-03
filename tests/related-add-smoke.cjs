const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const results = [];
const output = path.join(process.env.TEMP, 'apgo-related-smoke-20260903');
const record = (name, evidence) => { results.push({ name, evidence }); console.log(JSON.stringify({ name, evidence })); };
async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const knownVariants = new Set();
  const cart = async () => (await context.request.get('https://apgo.tw/cart.js')).json();
  async function cleanup() {
    const current = await cart();
    for (const item of current.items.filter(x => knownVariants.has(x.variant_id))) {
      assert.equal((await context.request.post('https://apgo.tw/cart/change.js', { data: { id: item.key, quantity: 0 } })).ok(), true);
    }
    const cleaned = await cart();
    record('cleanup', { count: cleaned.item_count, total: cleaned.total_price });
    assert.equal(cleaned.item_count, 0);
  }
  try {
    assert.equal((await cart()).item_count, 0);
    for (const width of process.argv.includes('--mobile-only') ? [390] : [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('https://apgo.tw/products/apgo-superwash?preview_theme_id=162094055675&pb=0', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.Shopify?.theme?.id === 162094055675);
      const parent = page.locator(width === 1440 ? '.apgo-related' : '.apgo-mpdp-related');
      const title = width === 1440 ? '海洋晨曦超級洗衣精' : '塑膠還原保護劑';
      await parent.locator('a').filter({ hasText: title }).first().click();
      await page.waitForFunction(() => window.Shopify?.theme?.id === 162094055675);
      let button;
      let id;
      if (width === 1440) {
        button = page.locator('.apgo-pdp [data-apgo-add]');
        await button.waitFor();
        id = Number(await page.locator('#apgo-mobile-product-form input[name="id"]').inputValue());
      } else {
        await page.locator('[data-apgo-cc-buybar-add]').click();
        const modal = page.locator('[data-apgo-cc-purchase]');
        await modal.locator('[role="dialog"]').waitFor();
        await modal.locator('label').filter({ has: page.locator('input[data-apgo-cc-modal-option-input][value="2L"]') }).click();
        id = Number(await page.locator('[data-apgo-cc-variant-id]').inputValue());
        button = modal.locator('[data-apgo-cc-purchase-cta="add"]');
      }
      knownVariants.add(id);
      await button.evaluate(el => el.scrollIntoView({ block: 'center' }));
      const responsePromise = page.waitForResponse(r => r.url().includes('/cart/add.js') && r.request().method() === 'POST');
      await button.click();
      const response = await responsePromise;
      assert.equal(response.status(), 200);
      const after = await cart();
      record('recommended product UI add ' + width, { variant: id, count: after.item_count, total: after.total_price, items: after.items.map(x => ({ variant: x.variant_id, quantity: x.quantity, title: x.product_title, variantTitle: x.variant_title })) });
      assert.equal(after.item_count, 1);
      assert.equal(after.items[0].variant_id, id);
      assert.equal(after.total_price, width === 1440 ? 29900 : 25000);
      await cleanup();
    }
  } finally { try { await cleanup(); } finally { await browser.close(); } }
}
main().catch(error => { record('STOP', { message: error.message }); process.exitCode = 1; })
  .finally(() => fs.writeFileSync(path.join(output, process.argv.includes('--mobile-only') ? 'add-mobile-results.json' : 'add-results.json'), JSON.stringify(results, null, 2)));
