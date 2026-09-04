const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const section = read('sections/apgo-mobile-pdp.liquid');
const snippet = read('snippets/apgo-cc-mobile-buybar.liquid');
const script = read('assets/apgo-cc-buybar.js');
const layout = read('layout/theme.liquid');
const styles = read('assets/apgo-mobile-buybar.css');

assert.match(section, /render 'apgo-cc-mobile-buybar'[\s\S]*mode: 'laundry'/);
assert.doesNotMatch(section, /class="apgo-mpdp-sticky/);

assert.match(snippet, /data-apgo-cc-buybar-mode=/);
assert.match(snippet, /buybar_mode == 'laundry'/);
assert.match(snippet, /href="\{\{ routes\.cart_url \}\}"/);
assert.match(snippet, /'product\.go_to_cart' \| t/);
assert.equal((snippet.match(/data-apgo-cc-buybar-chip(?:\s|>)/g) || []).length, 1);
assert.match(snippet, /data-apgo-bundle-add/);
assert.match(snippet, /data-apgo-bundle-buy-now/);
assert.match(snippet, /unless buybar_mode == 'laundry'/);

assert.match(script, /mode === 'laundry'/);
assert.match(script, /form\.apgo-product-form/);
assert.match(script, /\[data-apgo-variants\]/);

assert.match(layout, /template\.suffix == 'apgo-v2' or template\.suffix == 'apgo-v1s-plus'/);
assert.match(layout, /apgo-mobile-buybar\.css/);
assert.match(layout, /apgo-cc-buybar\.js/);

assert.match(styles, /\.apgo-cc-buybar--laundry/);
assert.match(styles, /#fdfaf2/);
assert.match(styles, /max-height: 65dvh/);
assert.match(styles, /\.apgo-cc-buybar--laundry \.apgo-cc-buybar__cart-link \{[\s\S]*?color: var\(--cc-orange\);/);
assert.match(styles, /\.apgo-cc-buybar--laundry \.apgo-cc-buybar__chip \{[\s\S]*?color: var\(--cc-orange\);/);

console.log('PASS shared mobile buy bar is wired for car-care and laundry templates');
