const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Liquid } = require('liquidjs');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const engine = new Liquid({ root: path.join(root, 'snippets'), extname: '.liquid', globals: { settings: { currency_code_enabled_product_cards: true } } });
for (const name of ['doc', 'stylesheet', 'schema']) {
  engine.registerTag(name, {
    parse(token, tokens) { while (tokens.length && tokens.shift().name !== 'end' + name) {} },
    render() { return ''; }
  });
}
const translations = JSON.parse(read('locales/zh-TW.json').replace(/^\s*\/\*[\s\S]*?\*\//, '')).content;
engine.registerFilter('t', key => translations[key.replace('content.', '')]);
engine.registerFilter('money', cents => '$' + (cents / 100).toLocaleString('en-US'));
engine.registerFilter('money_with_currency', cents => '$' + (cents / 100).toLocaleString('en-US') + ' TWD');
engine.registerFilter('image_url', () => '/fixture.jpg');
const product = (rows, selected = 0) => {
  const variants = rows.map(([price, compare_at_price]) => ({ price, compare_at_price }));
  const prices = variants.map(v => v.price);
  const compares = variants.map(v => v.compare_at_price).filter(x => x != null);
  return { id: 1, handle: 'recommended', title: 'Fixture', url: '/products/fixture', featured_image: {},
    variants, selected_or_first_available_variant: variants[selected],
    price: Math.min(...prices), price_min: Math.min(...prices), price_max: Math.max(...prices), price_varies: new Set(prices).size > 1,
    compare_at_price_min: Math.min(...compares), compare_at_price_max: Math.max(...compares) };
};
const desktop = read('sections/apgo-related.liquid');
const mobile = read('sections/apgo-mobile-pdp.liquid').split('{%- if section.settings.related_collection != blank -%}')[1].split('{%- comment -%} Sticky bottom CTA')[0];
const mobileFragment = '{%- if section.settings.related_collection != blank -%}' + mobile;
const text = (html, cls) => [...html.matchAll(new RegExp('class="' + cls + '"[^>]*>([\\s\\S]*?)<', 'g'))].map(m => m[1].trim());
async function main() {
  const cases = [
    ['partial', product([[2000, null], [13000, 19900], [25000, null]], 1), '$20 TWD ~ $250 TWD', [], true],
    ['all discounted', product([[10000, 15000], [20000, 30000]]), '$100 TWD ~ $200 TWD', ['$150 TWD ~ $300 TWD'], false],
    ['none discounted', product([[2000, null], [25000, null]]), '$20 TWD ~ $250 TWD', [], false],
    ['equal/invalid compare', product([[2000, 2000], [25000, 19900]]), '$20 TWD ~ $250 TWD', [], false],
    ['single discounted', product([[13000, 19900]]), '$130 TWD', ['$199 TWD'], false],
    ['single regular', product([[25000, null]]), '$250 TWD', [], false],
    ['equal price mixed', product([[10000, 15000], [10000, null]]), '$100 TWD', [], true]
  ];
  for (const [name, p, price, compare, partial] of cases) {
    for (const [surface, source] of [['desktop', desktop], ['mobile', mobileFragment]]) {
      const html = await engine.parseAndRender(source, { product: { id: 2, handle: 'current' }, collections: { fixtures: { products: [p] } },
        section: { id: 'fixture', settings: { collection: 'fixtures', related_collection: 'fixtures', columns: 4, limit: 4 } },
        settings: { currency_code_enabled_product_cards: true } });
      assert.deepEqual(text(html, 'price'), [price], name + ' ' + surface);
      assert.deepEqual(text(html, 'compare-at-price'), compare, name + ' ' + surface);
      assert.equal(html.includes('部分規格優惠'), partial, name + ' ' + surface);
      assert.match(html, /href="\/products\/fixture"/);
    }
    console.log('PASS desktop/mobile: ' + name);
  }
  const variantHtml = await engine.renderFile('price', { product_resource: cases[0][1], is_product_card: false, settings: {} });
  assert.deepEqual(text(variantHtml, 'price'), ['$130']);
  assert.deepEqual(text(variantHtml, 'compare-at-price'), ['$199']);
  assert.equal(variantHtml.includes('部分規格優惠'), false);
  console.log('PASS selected variant remains single-price; no checkout data altered');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
