// Isolated anonymous Draft fixture; tests invalid-code UI only, never submits an order.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const findings = [];
const output = path.join(process.env.TEMP, 'apgo-cart-discount-smoke-20260903');
function record(name, evidence) { findings.push({ name, evidence }); console.log(JSON.stringify({ name, evidence })); }
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const base = 'https://apgo.tw';
  const variant = 47358780899579;
  let fixtureCreated = false;
  const cart = async () => (await context.request.get(base + '/cart.js')).json();
  try {
    const before = await cart();
    assert.equal(before.item_count, 0, 'isolated cart must start empty');
    const setup = await context.request.post(base + '/cart/add.js', { data: { items: [{ id: variant, quantity: 1 }] } });
    assert.equal(setup.ok(), true);
    fixtureCreated = true;
    const initial = await cart();
    record('API fixture setup (not an add-button test)', { count: initial.item_count, total: initial.total_price });
    await page.goto(base + '/cart?preview_theme_id=162094055675&pb=0', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.Shopify?.theme?.id === 162094055675);
    await page.locator('.cdi-input').waitFor();
    const dismiss = page.getByRole('button', { name: '今天先不要', exact: true });
    if (await dismiss.isVisible()) await dismiss.click();
    const code = 'APGO-QA-INVALID-20260903-CART';
    await page.locator('.cdi-input').fill(code);
    await page.locator('.cdi-btn').evaluate(el => el.scrollIntoView({ block: 'center' }));
    const responsePromise = page.waitForResponse(r => r.url().includes('/cart/update.js') && r.request().method() === 'POST' && r.request().postData()?.includes(code));
    await page.locator('.cdi-btn').click();
    const response = await responsePromise;
    const result = await response.json();
    const error = page.locator('.cdi-msg--error:not(.hidden)');
    await error.waitFor({ timeout: 20000 });
    const message = await error.innerText();
    const final = await cart();
    record('invalid code UI → Shopify → rollback → UI', { status: response.status(), codes: result.discount_codes, message, count: final.item_count, total: final.total_price, finalCodes: final.discount_codes, overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
    assert.equal(final.total_price, initial.total_price);
    assert.equal(final.item_count, initial.item_count);
    assert.equal((final.discount_codes || []).some(x => x.code === code && x.applicable), false);
    assert.match(message, /優惠碼/);
    await page.screenshot({ path: path.join(output, 'invalid-code-mobile.png') });
  } finally {
    if (fixtureCreated) {
      const remaining = await cart();
      for (const item of remaining.items.filter(x => x.variant_id === variant)) {
        const res = await context.request.post(base + '/cart/change.js', { data: { id: item.key, quantity: 0 } });
        assert.equal(res.ok(), true, 'fixture removal');
      }
      const cleaned = await cart();
      record('fixture cleanup', { count: cleaned.item_count, total: cleaned.total_price });
      assert.equal(cleaned.item_count, 0);
    }
    await browser.close();
  }
}
main().catch(error => { record('STOP', { message: error.message }); process.exitCode = 1; })
  .finally(() => fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(findings, null, 2)));
