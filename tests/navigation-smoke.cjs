// Read-only Draft UI smoke test. Requires an external Playwright installation.
// No cart writes, login, order submission, or theme changes.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = path.join(process.env.TEMP, 'apgo-nav-smoke-20260903');
const themeId = 162094055675;
const findings = [];
let browser;
function record(name, evidence) {
  findings.push({ name, evidence });
  console.log(JSON.stringify({ name, evidence }));
}
async function main() {
  fs.mkdirSync(output, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  async function ready() {
    await page.waitForFunction(id => window.Shopify?.theme?.id === id, themeId);
    const dismiss = page.getByRole('button', { name: '今天先不要', exact: true });
    if (await dismiss.isVisible()) await dismiss.click();
  }
  async function visit(route) {
    const url = new URL(route, 'https://apgo.tw');
    url.searchParams.set('preview_theme_id', String(themeId));
    url.searchParams.set('pb', '0');
    const res = await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
    assert.equal(res.status(), 200, route + ' HTTP');
    await ready();
    assert.equal(await page.locator('body').innerText().then(t => /Liquid error|您點擊的網頁當前開發中/.test(t)), false, route + ' error page');
    return res;
  }
  await visit('/');
  await page.locator('.apgo-home-card').first().waitFor();
  await page.getByRole('button', { name: '今天先不要', exact: true }).click({ timeout: 3000 }).catch(() => {});
  await page.locator('header-menu').getByRole('link', { name: '所有產品', exact: true }).click();
  const gifts = page.locator('header-menu').getByRole('link', { name: '禮組', exact: true });
  assert.equal(await gifts.getAttribute('href'), 'https://apgo.tw/collections/bestselling-discount-gift-set');
  await gifts.click();
  await page.waitForURL('**/collections/bestselling-discount-gift-set');
  await ready();
  await page.getByRole('region', { name: '排序與商品數' }).waitFor();
  record('desktop gift link', { url: new URL(page.url()).pathname, count: await page.getByRole('region', { name: '排序與商品數' }).innerText() });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('summary.header__icon--menu').click();
  await page.locator('#HeaderDrawer-所有產品').click();
  await page.locator('#HeaderDrawer-所有產品-暢銷優惠禮組').click();
  record('mobile gift accordion', await page.locator('#HeaderDrawer-所有產品-暢銷優惠禮組').evaluate(s => {
    const d = s.closest('details');
    return { open: d.open, children: [...d.children].map(x => ({ tag: x.tagName, position: getComputedStyle(x).position, transform: getComputedStyle(x).transform })), links: [...d.querySelectorAll('a')].map(x => ({ text: x.textContent.trim(), href: x.getAttribute('href') })) };
  }));
  await page.locator('header-drawer').getByRole('link', { name: '禮組', exact: true }).click();
  await ready();
  await page.locator('summary.header__icon--menu').click();
  await page.locator('#HeaderDrawer-apgo生活誌').click();
  const journalLinks = await page.locator('#HeaderDrawer-apgo生活誌').evaluate(s => {
    const d = s.closest('details');
    return { open: d.open, links: [...d.querySelectorAll('a')].map(x => ({ text: x.textContent.trim(), href: x.getAttribute('href') })) };
  });
  assert.equal(journalLinks.open, true);
  assert.equal(journalLinks.links.length, 6);
  assert.equal(journalLinks.links.some(x => x.href.includes('/tagged/')), false);
  record('mobile journal accordion', journalLinks);
  await page.locator('header-drawer').getByRole('link', { name: '生活誌總覽', exact: true }).click();
  await page.locator('[data-journal-hub]').waitFor();
  record('journal hub mobile', await page.locator('[data-journal-hub]').evaluate(x => ({ title: x.querySelector('h1').textContent, categories: x.querySelectorAll('.apgo-journal__category').length, articles: x.querySelectorAll('.apgo-journal-card').length, empty: [...x.querySelectorAll('.apgo-journal__empty')].map(n => n.textContent), overflow: document.documentElement.scrollWidth > innerWidth })));
  await page.screenshot({ path: path.join(output, 'journal-mobile.png') });

  for (const category of ['居家清潔', '鍍膜知識', '洗車教學', '損傷處理', '行車安全']) {
    await visit('/blogs/' + encodeURIComponent(category));
    await page.locator('.apgo-journal h1').waitFor();
    record('blog ' + category, await page.locator('.apgo-journal').evaluate(x => ({ title: x.querySelector('h1').textContent, cards: x.querySelectorAll('.apgo-journal-card').length, empty: x.querySelector('.apgo-journal__empty')?.textContent, overflow: document.documentElement.scrollWidth > innerWidth })));
  }
  await visit('/blogs/' + encodeURIComponent('居家清潔'));
  const article = page.locator('.apgo-journal-card a').first();
  const articleHref = await article.getAttribute('href');
  await article.click();
  await ready();
  await page.locator('h1').first().waitFor();
  record('article mobile', { path: articleHref, title: await page.locator('h1').first().innerText(), overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });

  for (const route of ['/pages/brand-story', '/pages/short-videos', '/pages/google-review', '/pages/campaign20260803']) {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await visit(route);
      const evidence = await page.evaluate(() => ({ path: location.pathname, title: document.title, text: document.querySelector('main')?.innerText.slice(0,700) ?? document.body.innerText.slice(0,700), overflow: document.documentElement.scrollWidth > innerWidth, mainBackground: document.querySelector('main') && getComputedStyle(document.querySelector('main')).backgroundColor }));
      record(route + ' ' + width, evidence);
      assert.equal(evidence.overflow, false, route + ' horizontal overflow');
    }
  }
  record('console page errors', errors);
  await browser.close();
}
main().catch(async error => {
  record('STOP', { message: error.message });
  if (browser) await browser.close();
  process.exitCode = 1;
}).finally(() => fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(findings, null, 2)));
