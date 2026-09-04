/* Local-only contract fixtures: never creates Shopify articles.
 * Shopify's published/newest-first blog drop and paginate slicing are emulated.
 * The real section/snippet Liquid is rendered; remote rendering is checked separately.
 * Dependency: liquidjs (set NODE_PATH to an external tools installation).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Liquid } = require('liquidjs');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file).replace(/^\s*\/\*[\s\S]*?\*\//, ''));
const engine = new Liquid({ root: path.join(root, 'snippets'), extname: '.liquid' });
for (const tag of ['doc', 'stylesheet', 'schema']) {
  engine.registerTag(tag, {
    parse(token, tokens) {
      while (tokens.length && tokens.shift().name !== 'end' + tag) {}
    },
    render() { return ''; }
  });
}
const messages = json('locales/zh-TW.json').journal;
engine.registerFilter('t', (key, ...args) => {
  let result = messages[key.replace('journal.', '')];
  assert.ok(result, `Missing translation: ${key}`);
  for (const [name, value] of args) result = result.replace(`{{ ${name} }}`, value);
  return result;
});
engine.registerFilter('image_url', image => image.url);
engine.registerFilter('image_tag', (url, ...args) => {
  const options = Object.fromEntries(args);
  return `<img src="${url}" alt="${String(options.alt).replaceAll('&', '&amp;').replaceAll('"', '&quot;')}" loading="lazy">`;
});
const now = Date.parse('2026-09-03T00:00:00Z');
const names = ['居家清潔', '鍍膜知識', '洗車教學', '損傷處理', '行車安全'];
const article = (id, day, overrides = {}) => ({
  id, title: `文章 ${id}`, url: `/blogs/居家清潔/article-${id}`,
  excerpt_or_content: '<p>實用教學與選購指南。</p>',
  published_at: `2026-08-${String(day).padStart(2, '0')}T00:00:00Z`,
  isPublished: true, image: { url: '/fixture-image.png', alt: '' }, ...overrides
});
const drop = (name, entries) => {
  const articles = entries.filter(a => a.isPublished && Date.parse(a.published_at) <= now)
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
  return { title: name, handle: name, url: `/blogs/${name}`, articles, articles_count: articles.length };
};
const config = json('templates/page.apgo-journal.json').sections.main;
assert.deepEqual(config.block_order.map(id => config.blocks[id].settings.blog), names);
assert.equal(json('templates/blog.apgo-journal.json').sections.main.type, 'apgo-journal-blog');
const hubSource = read('sections/apgo-journal-hub.liquid');
const listingSource = read('sections/apgo-journal-blog.liquid');
assert.match(hubSource, /category_blog\.articles limit: 2/);
assert.match(listingSource, /paginate blog\.articles by 12/);
assert.doesNotMatch(hubSource + listingSource, /tagged\/|sort:|reverse|blogs\[/);
const hub = blogs => engine.parseAndRender(hubSource, {
  section: { id: 'test-hub', settings: config.settings, blocks: config.block_order.map((id, i) => ({
    id, settings: { ...config.blocks[id].settings, blog: blogs[i] }
  })) }, page: { title: 'APGO生活誌' }
});
const ids = html => [...html.matchAll(/data-journal-article="(.*?)"/g)].map(m => m[1]);
const listing = async (blog, page) => {
  const pages = Math.ceil(blog.articles_count / 12);
  const paginate = {
    pages, current_page: page,
    previous: page > 1 ? { url: `?page=${page - 1}` } : null,
    next: page < pages ? { url: `?page=${page + 1}` } : null,
    parts: Array.from({ length: pages }, (_, i) => ({ title: String(i + 1), is_link: i + 1 !== page, url: `?page=${i + 1}` }))
  };
  return engine.parseAndRender(listingSource
    .replace(/{%-?\s*paginate blog\.articles by 12\s*-?%}/, '')
    .replace(/{%-?\s*endpaginate\s*-?%}/, ''), {
    blog: { ...blog, articles: blog.articles.slice((page - 1) * 12, page * 12) }, paginate,
    section: { id: 'test-blog', settings: { hub_page: { url: '/pages/apgo-journal' } } }
  });
};
(async () => {
  const mixed = [article('old', 1), article('draft', 31, { isPublished: false }),
    article('second', 20), article('newest', 29), article('scheduled', 1, { published_at: '2027-01-01' })];
  const home = drop(names[0], mixed);
  const blogs = names.map((name, i) => i === 0 ? home : drop(name, []));
  const html = await hub(blogs);
  assert.deepEqual(ids(html), ['newest', 'second']);
  assert.equal((html.match(/data-journal-blog=/g) || []).length, 5);
  assert.equal((html.match(/文章準備中/g) || []).length, 4);
  assert.equal((html.match(/class="apgo-journal__category"/g) || []).length, 5);
  assert.doesNotMatch(html, /article-draft|article-scheduled|article-old|汽車美容知識庫|新聞/);
  assert.ok(html.includes('alt="文章 newest"'), 'Image alt falls back to title');
  console.log('PASS: hub order, latest two, draft/scheduled exclusion, no legacy mixing, four empty categories, cover alt');
  const independent = await hub(names.map((name, i) => drop(name, [article(`category-${i}`, 2)])));
  assert.deepEqual(ids(independent), names.map((_, i) => `category-${i}`));
  const one = await hub(names.map((name, i) => drop(name, i ? [] : [article('only', 1)])));
  assert.deepEqual(ids(one), ['only']);
  const empty = await listing(drop(names[1], []), 1);
  assert.ok(empty.includes('文章準備中'));
  assert.deepEqual(ids(empty), []);
  assert.doesNotMatch(empty, /404|開發中/);
  console.log('PASS: independent bindings, one article, empty Blog');
  const thirteen = drop(names[0], Array.from({ length: 13 }, (_, i) => article(String(i + 1), i + 1)));
  const first = await listing(thirteen, 1), second = await listing(thirteen, 2);
  assert.deepEqual(ids(first), Array.from({ length: 12 }, (_, i) => String(13 - i)));
  assert.deepEqual(ids(second), ['1']);
  assert.match(first, /href="\?page=2" rel="next"/);
  assert.doesNotMatch(first, /rel="prev"/);
  assert.match(second, /href="\?page=1" rel="prev"/);
  assert.doesNotMatch(second, /rel="next"/);
  assert.match(second, /aria-current="page">2/);
  const twelve = await listing(drop(names[0], thirteen.articles.slice(0, 12)), 1);
  assert.doesNotMatch(twelve, /class="apgo-journal__pagination"/);
  console.log('PASS: 12-per-page, newest first, page boundaries, next/previous/current, no duplicates');
  const special = await listing(drop(names[0], [article('safe', 1, { title: '<script>bad</script>', image: null })]), 1);
  assert.match(special, /&lt;script&gt;bad&lt;\/script&gt;/);
  assert.doesNotMatch(special, /<script>|<img/);
  console.log('PASS: title escaping, missing-cover rendering');
  console.log('All journal fixture tests passed. Shopify drop/pagination behavior is emulated, not an API integration test.');
})().catch(error => { console.error(error); process.exitCode = 1; });
