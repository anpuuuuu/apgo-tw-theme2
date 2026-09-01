# APGO US Amazon 独立页上线与公开流程

## 当前目标

把 APGO US Amazon 导流页放在 `apgo.tw` 的独立 Page 中，但在资料完成前不公开引流。

当前采用三层保护：

1. 不加入主选单、Footer、文章、广告或其他站内入口。
2. Page 的 `seo.hidden` 设为 `1`，使它不进入 sitemap、搜索引擎与 Shopify 店内搜索。
3. 主题的 `APGO US Amazon public` 保持关闭。只有两款 Amazon 链接都有填写并标记 ready 后，页面才允许输出可索引状态。

即使有人猜到网址，页面在准备期仍能打开，但所有 Amazon CTA 都没有 `href`，无法导流。

## Shopify 内的组成

- Layout：`layout/apgo-us-amazon.liquid`
- Page template：`templates/page.us-amazon-referral.json`
- Section：`sections/apgo-us-amazon-landing.liquid`
- CSS / JS / 图片 / 影片：`assets/apgo-us-*`
- 全局设定：Theme settings → **APGO US Amazon Landing**

此页面使用独立 Layout，不显示台湾官网的 Header、Footer、购物车、帐号入口及促销栏；但 Shopify 必须注入的 `content_for_header` 仍会保留。

## 第一次建立 Page

1. Shopify Admin → Online Store → Pages → Add page。
2. Title：`APGO Finish Care | D204 Dry & D215 Wet Application`
3. URL handle：建议 `us-amazon`
4. Theme template：选择 `us-amazon-referral`
5. Content 保持空白并设为 Visible。
6. 不把该 Page 加到 Navigation。
7. 在 Page metafield `seo.hidden` 填入整数 `1`。

若还没有该 metafield definition：Settings → Custom data → Pages → Add definition，名称可写 `Hide from search`，namespace/key 使用 `seo.hidden`，类型选 Integer，限制最大值为 `1`。

## 准备期检查清单

- [ ] D204 / D215 的英文名称、容量、用法与包装图核准
- [ ] D215 素材使用权确认
- [ ] 美国客服邮箱确认
- [ ] D204 与 D215 Amazon.com 商品页确定
- [ ] 为两个商品建立 Amazon Attribution 链接
- [ ] GA4 / Meta Pixel / Amazon Attribution 的归因口径确认
- [ ] 桌面、iPhone、Android 实机检查
- [ ] 两支影片、字幕、FAQ 与所有 CTA 检查
- [ ] Amazon 商品页的库存、价格、退货说明与页面文案一致

## 加入 Amazon 链接

在 Theme settings → **APGO US Amazon Landing** 中：

1. 填写 D204 Amazon URL。
2. 打开 D204 link ready。
3. 填写 D215 Amazon URL。
4. 打开 D215 link ready。
5. 填写美国客服邮箱。

页面只接受 `https://amazon.com` 或其子网域链接；没有通过检查的链接不会被写入 CTA。

## 正式公开

确认清单完成后再做以下动作：

1. 将 Page 的 `seo.hidden` 从 `1` 清空。
2. 打开 Theme settings 中的 `APGO US Amazon public`。
3. 再次确认页面输出 `index,follow`，11 个 CTA 都指向预期的 Amazon Attribution 链接。
4. 最后才把该页面加入广告、社群、EDM、二维码或官网入口；是否加入主选单可另外决定。

## 回滚

若公开后发现问题，先关闭 `APGO US Amazon public` 并把 `seo.hidden` 改回 `1`。这会立刻停止 Amazon CTA 与索引；无需删除 Page。修复后再按正式公开流程重新开启。

## 日后维护

- 改 Amazon 链接、客服邮箱、ready/public 状态：Theme settings，不必改代码。
- 改页面英文文案、版面或图片：修改对应 Section / CSS / Asset，并先上传未发布主题预览。
- 查点击：GA4 事件 `amazon_referral_click`，可用 `sku` 与 `placement` 区分商品和按钮位置。
- 查问题：先确认 Page template、主题设定、浏览器 Console、Shopify CDN 资源与 Amazon URL；不要直接删除 Page。
