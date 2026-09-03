const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function element(text = '') {
  const classes = new Set();
  return {
    textContent: text,
    classList: {
      toggle(name, value) { value ? classes.add(name) : classes.delete(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
  };
}

function setup(count = 0) {
  const listeners = new Map();
  const storage = new Map();
  let CartIcon;
  class Component {
    connectedCallback() {}
    disconnectedCallback() {}
  }
  const source = fs.readFileSync(path.join(__dirname, '../assets/cart-icon.js'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '');
  vm.runInNewContext(source, {
    Component,
    ThemeEvents: { cartUpdate: 'cart:update' },
    onAnimationEnd: async () => {},
    document: {
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(fn);
      },
      removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    },
    sessionStorage: {
      getItem(key) { return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, value); },
    },
    customElements: { get() {}, define(name, value) { CartIcon = value; } },
  });
  const icon = new CartIcon();
  const accessible = element(`購物車商品數量: ${count}`);
  const action = {
    label: `開啟購物車 購物車商品數量: ${count}`,
    getAttribute() { return this.label; },
    setAttribute(name, value) { this.label = value; },
  };
  icon.dataset = { cartCount: String(count), cartCountLabel: '購物車商品數量' };
  icon.refs = {
    cartBubble: element(), cartBubbleText: element(), cartBubbleCount: element(count < 100 ? String(count) : ''),
  };
  icon.classList = element().classList;
  icon.querySelector = () => accessible;
  icon.closest = () => action;
  return {
    icon, action, accessible, listeners, storage,
    async emit(type, detail) {
      await Promise.all([...(listeners.get(type) ?? [])].map(fn => fn({ type, detail })));
    },
  };
}

test('registers and removes both cart contracts', () => {
  const t = setup();
  t.icon.connectedCallback();
  assert.equal(t.listeners.get('cart:update')?.size, 1);
  assert.equal(t.listeners.get('cart:updated')?.size, 1);
  t.icon.disconnectedCallback();
  assert.equal(t.listeners.get('cart:update').size, 0);
  assert.equal(t.listeners.get('cart:updated').size, 0);
});

test('cart page absolute updates synchronize badge, action and live text, including removal', async () => {
  const t = setup(1);
  t.icon.connectedCallback();
  for (const count of [2, 2, 1, 0]) {
    await t.emit('cart:updated', { cart: { item_count: count } });
    assert.equal(t.icon.currentCartCount, count);
    assert.equal(t.icon.refs.cartBubbleCount.textContent, String(count));
    assert.equal(t.action.label, `開啟購物車 購物車商品數量: ${count}`);
    assert.equal(t.accessible.textContent, `購物車商品數量: ${count}`);
    assert.equal(t.icon.refs.cartBubble.classList.contains('visually-hidden'), count === 0);
    assert.equal(JSON.parse(t.storage.get('cart-count')).value, String(count));
  }
});

test('preserves legacy absolute payloads and product-form delta contract', async () => {
  const t = setup(2);
  t.icon.connectedCallback();
  await t.emit('cart:update', { data: { itemCount: 3, source: 'product-form-component' } });
  assert.equal(t.icon.currentCartCount, 5);
  assert.equal(t.accessible.textContent, '購物車商品數量: 5');
  await t.emit('cart:update', { resource: { item_count: 4 } });
  assert.equal(t.icon.currentCartCount, 4);
  await t.emit('cart:update', { data: { item_count: '3' } });
  assert.equal(t.icon.currentCartCount, 3);
});

test('ignores refresh signals and invalid counts instead of clearing a valid cart', async () => {
  const t = setup(3);
  t.icon.connectedCallback();
  for (const value of [undefined, null, '', ' ', false, -1, 1.5, NaN, Infinity, 'unknown']) {
    await t.emit('cart:update', { cart: { item_count: value } });
    assert.equal(t.icon.currentCartCount, 3, `invalid ${String(value)}`);
  }
  await t.emit('cart:update', {});
  assert.equal(t.icon.currentCartCount, 3);
});

test('retains exact count above visual limit for later delta updates and accessibility', async () => {
  const t = setup(100);
  t.icon.connectedCallback();
  await t.emit('cart:update', { data: { itemCount: 1, source: 'product-form-component' } });
  assert.equal(t.icon.currentCartCount, 101);
  assert.equal(t.icon.refs.cartBubbleCount.textContent, '');
  assert.equal(t.accessible.textContent, '購物車商品數量: 101');
});

test('restores recent count consistently without animation', () => {
  const t = setup(1);
  t.storage.set('cart-count', JSON.stringify({ value: '2', timestamp: Date.now() }));
  t.icon.connectedCallback();
  assert.equal(t.icon.currentCartCount, 2);
  assert.equal(t.action.label, '開啟購物車 購物車商品數量: 2');
  assert.equal(t.icon.refs.cartBubble.classList.contains('cart-bubble--animating'), false);
});
