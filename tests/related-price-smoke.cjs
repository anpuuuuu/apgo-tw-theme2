const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = path.join(process.env.TEMP, 'apgo-related-smoke-20260903');
const results = [];
const record = (name, evidence) => { results.push({ name, evidence }); console.log(JSON.stringify({ name, evidence })); };
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const res = await page.goto('https://apgo.tw/products/apgo-superwash?preview_theme_id=162094055675&pb=0', { waitUntil: 'domcontentloaded' });
      assert.equal(res.status(), 200);
      await page.waitForFunction(() => window.Shopify?.theme?.id === 162094055675);
      const region = page.locator(width === 1440 ? '.apgo-related' : '.apgo-mpdp-related');
      await region.waitFor();
      await region.evaluate(el => el.scrollIntoView({ block: 'center' }));
      const cards = await region.locator('a').evaluateAll(items => items.map(a => ({ title: a.querySelector('.apgo-serif')?.textContent, href: a.getAttribute('href'),
        price: a.querySelector('.price')?.textContent.trim(), compare: a.querySelector('.compare-at-price')?.textContent.trim() ?? null,
        partial: a.querySelector('.partial-sale-label')?.textContent.trim() ?? null,
        priceWidth: a.querySelector('.apgo-related-card-price')?.getBoundingClientRect().width,
        cardWidth: a.getBoundingClientRect().width })));
      assert.ok(cards.length > 0);
      for (const card of cards) {
        const url = new URL(card.href, 'https://apgo.tw');
        url.pathname += '.js'; url.search = '';
        const product = await (await context.request.get(url.toString())).json();
        const cents = card.price.replaceAll(',', '').match(/\d+(?:\.\d+)?/g)?.map(x => Math.round(Number(x) * 100));
        assert.deepEqual(cents, product.price_min === product.price_max ? [product.price_min] : [product.price_min, product.price_max], card.title + ' price');
        const discounted = product.variants.filter(v => v.compare_at_price > v.price).length;
        assert.equal(Boolean(card.partial), discounted > 0 && discounted < product.variants.length, card.title + ' partial');
        assert.equal(Boolean(card.compare), discounted > 0 && discounted === product.variants.length, card.title + ' compare');
        if (card.compare) {
          const compares = product.variants.map(v => v.compare_at_price);
          assert.deepEqual(card.compare.replaceAll(',', '').match(/\d+(?:\.\d+)?/g).map(x => Math.round(Number(x) * 100)), Math.min(...compares) === Math.max(...compares) ? [Math.min(...compares)] : [Math.min(...compares), Math.max(...compares)]);
        }
        assert.ok(card.priceWidth <= card.cardWidth + 1);
      }
      record('recommendations ' + width, cards);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await region.screenshot({ path: path.join(output, 'recommendations-' + width + '.png') });
      const target = cards.find(c => c.title.includes('塑膠')) || cards[0];
      await region.locator('a').filter({ hasText: target.title }).first().click();
      await page.waitForFunction(() => window.Shopify?.theme?.id === 162094055675);
      record('recommended product opened ' + width, { path: new URL(page.url()).pathname, title: await page.locator('h1').first().innerText(), buttons: await page.getByRole('button').allTextContents() });
    }
  } finally { await browser.close(); }
}
main().catch(error => { record('STOP', { message: error.message }); process.exitCode = 1; })
  .finally(() => fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2)));
