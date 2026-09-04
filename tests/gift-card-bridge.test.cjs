const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../snippets/cart-gift-card-bridge.liquid'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const context = { module: { exports: {} }, URL };
vm.runInNewContext(source, context);
const { createBridge, operations, linesFrom, assertParity, checkoutURL } = context.module.exports;
const clone = value => JSON.parse(JSON.stringify(value));
function fixture() {
  let native = { token: 'native-test-token', currency: 'TWD', total_price: 2800, note: 'test note', attributes: { '發票種類': '個人' }, discount_codes: [{ code: 'TEST50', applicable: true }], items: [{ variant_id: 1, quantity: 2, properties: { _bundle_role: 'paid', scent: 'rose' } }] };
  let remote, saved = null, status, time = 1000, reads = 0, serial = 0;
  const calls = [];
  const config = { domain: 'test.myshopify.com', host: 'example.test', country: 'TW', customer: 'guest' };
  function recalc() {
    const amount = remote.lines.nodes.reduce((sum, l) => sum + 3900 * l.quantity, 0) - (remote.discountCodes.some(d => d.applicable) ? 5000 : 0);
    remote.totalQuantity = remote.lines.nodes.reduce((sum, l) => sum + l.quantity, 0);
    remote.cost.totalAmount.amount = String((Math.max(0, amount) - (remote.appliedGiftCards.length ? 100 : 0)) / 100);
  }
  const mock = {
    config, now: () => time, hash: async s => 'hash:' + s,
    restore: () => saved, save: s => { saved = clone(s); }, change: s => { status = clone(s); },
    native: async () => { reads++; return clone(native); },
    graphql: async (query, vars) => {
      const op = Object.keys(operations).find(key => operations[key] === query); calls.push(op);
      const line = l => ({ id: 'line-' + ++serial, quantity: l.quantity, attributes: clone(l.attributes), merchandise: { id: l.merchandiseId }, sellingPlanAllocation: l.sellingPlanId ? { sellingPlan: { id: l.sellingPlanId } } : null });
      if (op === 'create') {
        remote = { id: 'gid://shopify/Cart/test?key=private', checkoutUrl: 'https://example.test/cart/c/test?key=private', note: vars.input.note, attributes: clone(vars.input.attributes), discountCodes: vars.input.discountCodes.map(code => ({ code, applicable: true })), appliedGiftCards: [], cost: { totalAmount: { amount: '28', currencyCode: 'TWD' } }, lines: { pageInfo: { hasNextPage: false }, nodes: vars.input.lines.map(line) } };
      }
      if (op === 'read') return { data: { cart: clone(remote) } };
      if (op === 'gift') remote.appliedGiftCards = vars.codes[0] === 'VALID-TEST-ONLY' ? [{ id: 'gift1', lastCharacters: 'ONLY', amountUsed: { amount: '1', currencyCode: 'TWD' } }] : [];
      if (op === 'update') vars.lines.forEach(l => { remote.lines.nodes.find(old => old.id === l.id).quantity = l.quantity; });
      if (op === 'add') remote.lines.nodes.push(...vars.lines.map(line));
      if (op === 'remove') remote.lines.nodes = remote.lines.nodes.filter(l => !vars.lines.includes(l.id));
      if (op === 'attributes') remote.attributes = clone(vars.attributes);
      if (op === 'note') remote.note = vars.note;
      if (op === 'discount') remote.discountCodes = vars.codes.map(code => ({ code, applicable: true }));
      recalc();
      return { data: { payload: { cart: clone(remote), userErrors: [], warnings: [] } } };
    }
  };
  return { mock, calls, get native() { return native; }, get remote() { return remote; }, get saved() { return saved; }, get status() { return status; }, get reads() { return reads; }, advance: () => { time += 1800001; }, setNative: n => { native = n; } };
}
test('no gift: uses native checkout without a Storefront request', async () => {
  const f = fixture(), bridge = createBridge(f.mock);
  assert.equal(await bridge.checkout(new URLSearchParams()), null); assert.deepEqual(f.calls, []);
});
test('valid gift + existing discount, masked display, safe session, checkout prefills', async () => {
  const f = fixture(), bridge = createBridge(f.mock);
  await bridge.apply('VALID-TEST-ONLY');
  assert.equal(f.status.estimate.used, 100); assert.equal(f.status.estimate.due, 2700);
  assert.equal(f.native.total_price, 2800);
  assert.equal(JSON.stringify(f.saved).includes('VALID-TEST-ONLY'), false);
  assert.deepEqual(Object.keys(f.saved).sort(), ['expires', 'id', 'last4', 'owner']);
  const params = new URLSearchParams({ 'checkout[shipping_address][city]': '臺北市', key: 'overwritten', discount: 'BAD', gift_card: 'SECRET', preview_theme_id: 'draft' });
  const result = new URL(await bridge.checkout(params));
  assert.equal(result.searchParams.get('key'), 'private'); assert.equal(result.searchParams.get('discount'), null);
  assert.equal(result.searchParams.get('gift_card'), null); assert.equal(result.searchParams.get('checkout[shipping_address][city]'), '臺北市');
});
test('API accepts invalid code with no userErrors: do not claim applied', async () => {
  const f = fixture(), bridge = createBridge(f.mock);
  await assert.rejects(bridge.apply('INVALID'), /invalid/); assert.equal(bridge.active(), false); assert.equal(f.saved, null);
});
test('one-card policy does not replace a valid card accidentally', async () => {
  const f = fixture(), bridge = createBridge(f.mock); await bridge.apply('VALID-TEST-ONLY');
  await assert.rejects(bridge.apply('INVALID'), /remove_first/); assert.equal(bridge.active(), true); assert.equal(f.remote.appliedGiftCards.length, 1);
});
test('quantity, line replacement, properties, note and invoice synchronized', async () => {
  const f = fixture(), bridge = createBridge(f.mock); await bridge.apply('VALID-TEST-ONLY');
  f.native.items[0].quantity = 3; f.native.total_price = 6700; f.native.attributes['統一編號'] = 'test'; f.native.note = 'updated';
  await bridge.refresh(); assert.equal(f.status.estimate.due, 6600);
  f.native.items[0].variant_id = 2; f.native.items[0].properties.scent = 'ocean';
  await bridge.refresh(); assert.equal(f.remote.lines.nodes.length, 1); assert.ok(f.calls.indexOf('add') < f.calls.lastIndexOf('remove'));
  assert.equal(f.remote.note, 'updated'); assert.equal(f.remote.attributes.find(a => a.key === '統一編號').value, 'test');
});
test('selling plans and custom bundle properties are mapped, native bundles fail safely', () => {
  const f = fixture(); f.native.items[0].selling_plan_allocation = { selling_plan: { id: 8 } };
  assert.equal(linesFrom(f.native)[0].sellingPlanId, 'gid://shopify/SellingPlan/8');
  assert.equal(linesFrom(f.native)[0].attributes.find(a => a.key === '_bundle_role').value, 'paid');
  f.native.items[0].item_components = [{}]; assert.throws(() => linesFrom(f.native), /unsupported/);
});
test('wrong currency, lost discounts, prices, attributes, lines block checkout', async () => {
  const f = fixture(), bridge = createBridge(f.mock); await bridge.apply('VALID-TEST-ONLY');
  for (const mutate of [r => r.cost.totalAmount.currencyCode = 'USD', r => r.discountCodes = [], r => r.cost.totalAmount.amount = '28', r => r.attributes = [], r => r.lines.nodes[0].quantity = 1, r => r.lines.pageInfo.hasNextPage = true]) {
    const remote = clone(f.remote); mutate(remote); assert.throws(() => assertParity(f.native, remote), /mismatch/);
  }
});
test('expired state is retained and blocks checkout until explicitly removed', async () => {
  const f = fixture(), bridge = createBridge(f.mock); await bridge.apply('VALID-TEST-ONLY'); f.advance();
  await assert.rejects(bridge.checkout(new URLSearchParams()), /expired/); assert.equal(bridge.active(), true);
  await bridge.remove(); assert.equal(f.saved, null); assert.equal(await bridge.checkout(new URLSearchParams()), null);
});
test('changed customer or native cart cannot reuse the saved gift cart', async () => {
  const f = fixture(), bridge = createBridge(f.mock); await bridge.apply('VALID-TEST-ONLY'); f.native.token = 'different';
  const restored = createBridge(f.mock); await assert.rejects(restored.refresh(), /expired/);
});
test('change during checkout and network failure block, never silent native fallback', async () => {
  const f = fixture(), bridge = createBridge(f.mock); await bridge.apply('VALID-TEST-ONLY');
  let calls = 0; const original = f.mock.native;
  f.mock.native = async () => { if (++calls === 2) f.native.note = 'changed in another tab'; return original(); };
  await assert.rejects(bridge.checkout(new URLSearchParams()), /changed/);
  f.mock.graphql = async () => { throw Error('sensitive API payload'); };
  await assert.rejects(bridge.checkout(new URLSearchParams()), /^Error: network$/); assert.equal(bridge.active(), true);
});
test('remove after transport failure discards unusable checkout state locally', async () => {
  const f = fixture(), bridge = createBridge(f.mock); await bridge.apply('VALID-TEST-ONLY');
  f.mock.graphql = async () => { throw Error('offline'); };
  await bridge.remove(); assert.equal(bridge.active(), false); assert.equal(f.saved, null);
});
test('hostile checkout URLs and key overrides are rejected', () => {
  const config = fixture().mock.config;
  for (const url of ['https://evil.test/cart/c/x', 'http://example.test/cart/c/x', 'https://example.test/account']) assert.throws(() => checkoutURL(url, new URLSearchParams(), config), /mismatch/);
});
test('translations and inline JavaScript parse', () => {
  for (const file of ['en.default.json', 'zh-TW.json', 'zh-CN.json']) {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../locales', file), 'utf8').replace(/^\s*\/\*[\s\S]*?\*\//, ''));
    for (const key of ['gift', 'help', 'network', 'invalid', 'mismatch', 'expired', 'unsupported', 'changed', 'remove_first', 'attributes_error']) assert.equal(typeof data.apgo_gift[key], 'string');
  }
  for (const file of ['cart-discount-input-only', 'cart-gift-card-bridge']) {
    const liquid = fs.readFileSync(path.join(__dirname, '../snippets', file + '.liquid'), 'utf8');
    for (const match of liquid.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1].replace(/\{\{[\s\S]*?\}\}/g, '"liquid-value"'));
  }
});
