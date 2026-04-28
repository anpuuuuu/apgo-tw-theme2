# APGO Car Care Colors · 全站重設計計畫書

> **本文件用途**：context 視窗超過 / 換 session 時，下一個 Claude 看這份就能無縫接手。User 也可以回來看流程進度。
>
> **建立日期**：2026-04-27
> **目前狀態**：Phase 0 計畫書已建立，等開 Phase 1
> **設計來源**：Claude Design 包，本機解壓於 `/tmp/apgo-design/apgotw/`
>   - 主入口：`Car Care Colors.html`
>   - 桌機列表：`merged-list.jsx`
>   - 桌機詳情：`merged-detail.jsx`
>   - 手機列表：`mobile-list.jsx`
>   - 手機詳情：`mobile-detail.jsx`
>   - 共用元件：`card-bits.jsx` / `placeholders.jsx` / `palettes.jsx`
>   - 後端整合文件：`docs/Shopify-Integration.md`
> **設計 chat transcript**：`/tmp/apgo-design/apgotw/chats/chat1.md`（1507 行，最後一輪是加 onSale toggle + promo pills）

---

## 1. User 拍板的 4 個決定（2026-04-27）

| # | 議題 | 決定 |
|---|---|---|
| 1 | **視覺方向** | (a) **完全取代**戰術風 → 全站改成 Car Care Colors（暖米色商品照背景 + 灰深灰背景 + 暖白文字 + 橘色 accent） |
| 2 | **PDP 處理** | **新建一個通用 product template**（例如 `templates/product.apgo-v2.json`），其他產品用這個。**保留** `templates/product.apgo-v1s-plus.json` 給洗衣精單品（已建好的 metaobject 資料維持） |
| 3 | **Metafields** | 設計文件要的 metafield **逐步**新建（不一次全建），照當前 phase 需要才建 |
| 4 | **Scope 順序** | 純前端先做 → **列表頁先**做完整 → 再做詳情頁 → 後續才接資料。**「全站滿千免運」block 暫不做**（屬於 free_shipping_threshold 那塊功能延後） |

---

## 2. 涉及哪些檔案？（2026-04-28 重新盤點）

> ⚠️ Phase 0 之後有 24 個其他 session 的 commits 進來，含 SGS 認證 section、AJAX 加購物車、桌機 hero 合進 mobile-pdp、ship_row 改用 shop metafield、多版本 tactical-aio sections。本節已更新為當前實際檔案清單。

### 2.0 完整當前 sections/ 清單（apgo-* prefix）

| 檔案 | 來源 | 處理方向 |
|---|---|---|
| `apgo-tactical-hero.liquid` | **本 plan 戰術風 Phase 2** | Phase 1 停用（不引用，留檔） |
| `apgo-tactical-cart-bar.liquid` | **本 plan 戰術風 Phase 3** | Phase 1 停用（不引用，留檔） |
| `apgo-tactical-aio.liquid` | 其他 Claude session | **不 touch** |
| `apgo-tactical-aio-v2.liquid` | 其他 Claude session | **不 touch** |
| `apgo-tactical-aio-v3.liquid` | 其他 Claude session | **不 touch** |
| `apgo-tactical-aio-v4.liquid` | 其他 Claude session | **不 touch** |
| `apgo-tactical-hub.liquid` | 其他 Claude session | **不 touch** |
| `apgo-hero.liquid` | v1s-plus PDP（雖然 41d1c90 把桌機 hero 合進 mobile-pdp，檔案還在） | **不動** |
| `apgo-mobile-pdp.liquid` | v1s-plus PDP 主 section | **不動** |
| `apgo_product_page.liquid` | 舊 PDP（給 product.json / v1plus.json 用） | **不動** |
| `apgo-product.liquid` | ? PDP | **不動** |
| `apgo-account-line.liquid` | 其他功能 | **不 touch** |
| `apgo-cleaning-sale.liquid` | 其他 | **不 touch** |
| `apgo-cny-event.liquid` | 其他 | **不 touch** |
| `apgo-coating-products.liquid` | 其他 | **不 touch** |
| `apgo-comparison.liquid` | 其他 | **不 touch** |
| `apgo-dynamic-title.liquid` | 其他 | **不 touch** |
| `apgo-editorial.liquid` | 其他 | **不 touch** |
| `apgo-line-auth.liquid` | 其他 | **不 touch** |
| `apgo-pain-solutions.liquid` | 其他（注意：跟我 PDP 的 pain_solutions metafield 同名但這是 section） | **不 touch** |
| `apgo-promo-bar.liquid` | 其他（戰術廣播條） | **不 touch** |
| `apgo-related.liquid` | 其他 | **不 touch** |
| `apgo-scent-quiz.liquid` | 其他 | **不 touch** |
| `apgo-scent-timeline.liquid` | 其他 | **不 touch** |
| `apgo-spec-table.liquid` | 其他（注意：跟我 PDP 的 spec_rows metafield 同名） | **不 touch** |
| `apgo-trust-guarantee.liquid` | 其他 | **不 touch** |
| `apgo-ugc-wall.liquid` | 其他 | **不 touch** |
| `apgo_live*.liquid` (4 個) | 其他（直播頁面？） | **不 touch** |

### 2.1 會新建的（Car Care Colors 專屬，名稱用 `apgo-cc-*` prefix）

- `assets/apgo-carcare.css`（新主題皮膚 — 取代 `apgo-tactical.css` 在 collection 頁的角色）
- `assets/apgo-carcare.js`（互動：sort tabs、category tile clicks、promo countdown）
- `sections/apgo-cc-list-hero.liquid`（列表頁 hero 促銷帶 — Phase 2）
- `sections/apgo-cc-category-mosaic.liquid`（5 格分類磚 — Phase 2）
- `sections/apgo-cc-promo-strip.liquid`（永久促銷膠囊列 — Phase 2）
- `sections/apgo-cc-product-grid.liquid`（如有需要全面取代 main-collection — 待 Phase 2 決定）
- `templates/product.apgo-v2.json`（新通用 PDP 模板 — Phase 4）
- `sections/apgo-cc-detail-*.liquid`（詳情頁 sections — Phase 4）

### 2.2 Phase 1 動工時要做的事

> User 決定：**戰術風檔案保留**（不刪），collection.json 不再引用即可。

具體動作：
1. 修改 `templates/collection.json`：
   - 移除 `apgo_tac_hero` / `apgo_tac_cart_bar` 條目
   - 保留 `section` / `collection_links_pNT4Ld` / `main` 三個既有 sections
2. 修改 `layout/theme.liquid`：
   - 把現有 `template.name == 'collection'` 載入 `apgo-tactical.css/js` + Inter/JetBrains Mono Google Fonts 那段
   - 改成載入 `apgo-carcare.css` + Cormorant Garamond/Inter/JetBrains Mono
   - body class 從 `apgo-tactical-skin` 改 `apgo-cc-skin`
3. 新建 `assets/apgo-carcare.css`：套上設計 token + product card 重新化妝（暖米色 photo bg、暖白文字、Cormorant 標題、Inter 副文）
4. **檔案保留不刪**：
   - `assets/apgo-tactical.css`、`apgo-tactical.js`
   - `sections/apgo-tactical-hero.liquid`
   - `sections/apgo-tactical-cart-bar.liquid`

### 2.3 絕對不動（Phase 1-6 全程都不動）

- **PDP 那條線**：
  - `templates/product.apgo-v1s-plus.json`（洗衣精單品專用）
  - `sections/apgo-hero.liquid`、`sections/apgo-mobile-pdp.liquid`
  - `sections/apgo_product_page.liquid`、`sections/apgo-product.liquid`
  - `assets/apgo-pdp.css`、`assets/apgo-pdp.js`
  - 因 SGS section 加進去後，PDP 結構更複雜，徹底不碰
- **其他 Claude session 的 sections**（見第 2.0 節 **不 touch** 標記的）
- **既建的 metaobjects**：`pain_solution` / `comparison_row` / `spec_row` / `review` / `faq` / `scent`、加上 SGS 相關（從 commit log 看有 SGS metaobject）
- **既建的 product metafields**：`apgo.pain_solutions` / `apgo.comparison_rows` / `apgo.spec_rows` / `apgo.reviews` / `apgo.faqs` / `custom.pic` / `apgo.subtitle`、加上 ship_rows shop metafield
- **shop metafield** `apgo.scents` + 其他 ship_row 相關 shop metafields

---

## 3. 設計關鍵 token（從 `palettes.jsx` 萃取）

```css
/* 主品牌色票 */
--cc-bg:        #16181c;   /* 主背景：冷暖中性深灰 */
--cc-bg-alt:   #1c1f24;   /* 次要面 / 卡片背景 */
--cc-bg-deep:  #0f1115;   /* 最深層（promo strip 等） */
--cc-surface:  #22262d;   /* 互動表面 */
--cc-surface-hi: #2a2e35; /* hover */
--cc-divider: #2a2e35;
--cc-divider-dim: #23262c;

--cc-photo-bg:      #f1ede4;  /* 商品照暖米色 — 重點 */
--cc-photo-bg-warm: #f1ede4;
--cc-photo-bg-alt:  #e8e2d4;
--cc-photo-bg-cool: #eef0f3;
--cc-photo-bg-dark: #2a2e35;  /* 手機列表頁用這個 */

--cc-fg:        #f0ece4;     /* 主文字：暖白 */
--cc-fg-mid:    #b8b3a8;     /* 次文字 */
--cc-fg-dim:    #8a857b;     /* 弱文字 */
--cc-fg-faint:  #5c584f;     /* 最弱（mono 標籤） */

--cc-orange:      #ff6b1a;   /* 主橘 */
--cc-orange-hi:   #ff8240;   /* 亮橘 */
--cc-orange-dim:  #c4541a;   /* 暗橘 */
--cc-orange-soft: rgba(255,107,26,.12);
--cc-orange-soft-hi: rgba(255,107,26,.2);

--cc-red:   #e74c3c;   /* sale 紅 */
--cc-green: #52c878;   /* in-stock 綠 */

/* 圓角級距 */
--cc-r1: 6px;
--cc-r2: 10px;
--cc-r3: 14px;
--cc-r4: 20px;
--cc-r5: 999px;

/* 字體 */
--cc-font-display: 'Cormorant Garamond', serif;  /* 大標 / 引用 */
--cc-font-body:    'Inter', -apple-system, sans-serif;
--cc-font-mono:    'JetBrains Mono', ui-monospace, monospace;
```

---

## 4. 列表頁 UI 區塊清單（`merged-list.jsx` + `mobile-list.jsx`）

| # | 區塊 | 桌機 | 手機 | Phase |
|---|---|---|---|---|
| A | 庫存 + 日期條（promo strip 上方） | 左:庫存即時更新；右:日期 + 滿千免運 | (合併進別的) | 1 |
| B | **Hero 促銷 banner**（大橘色漸層） | 大尺寸帶倒數 | 小尺寸無倒數 | 1（暫不做倒數）|
| C | **永久促銷膠囊列** (PromoPills) | 「全站優惠」label + 3 顆膠囊 | 同 | 1 |
| D | **5 格分類磚**（mosaic） | 2:1:1:1:1（左大 + 右 4 小） | featured + 2x1 + 第二行 | 2 |
| E | 篩選列（共 N 項 / sort tab / 視圖切換） | 完整 | 簡化 | 2 |
| F | **商品卡 grid** | 3-4 欄 | 1-2 欄 | 1（皮膚）+ 2（資料） |
| G | 商品卡內容 | 圖 + 標題 + 副標 + 價格 + tag + rating + sold | 同 | 1（皮膚） |
| H | 分頁 | 標準 | 標準 | 1（皮膚） |
| I | (手機獨有)頂部 brandbar 含購物袋 + 心愛 | — | 有 | 後 |
| J | (手機獨有)搜尋 input | — | sticky | 後 |

---

## 5. 詳情頁 UI 區塊清單（`merged-detail.jsx` + `mobile-detail.jsx`）

> Phase 4+ 才開動，先佔個位

| # | 區塊 |
|---|---|
| 1 | 麵包屑 |
| 2 | 主圖 gallery（large 1:1 + 縮圖列） |
| 3 | 商品 info：標題 / 副標 / 評分 / 限時特價區（可開關）/ 容量變體 / 數量 |
| 4 | CTA：加入購物車 + 立即購買 + 收藏 |
| 5 | BUNDLE & SAVE 側欄 |
| 6 | 5 個 tab：商品描述 / 使用方式 / 規格參數 / 客戶評價 / 常見FAQ |
| 7 | 評價區（含星等分布） |
| 8 | 推薦商品 |

---

## 6. 階段切片（Phasing）

> 每刀 3-7 個 commits，每刀做完截圖確認，不滿意可 rollback。

### Phase 1：列表頁皮膚 + 拆戰術風引用（**先這刀**）

**目標**：collection 頁視覺改成 Car Care Colors（暖米色照片 bg + 灰深背景 + 暖白文字），保留現有 product card block 結構。**所有戰術風檔案保留不刪**，只是 collection.json 跟 theme.liquid 不再引用。

**Claude 做**：
1. 新建 `assets/apgo-carcare.css` — 全套設計 token + 列表頁皮膚（body bg、product card、collection links pill、section background 等）
2. 修改 `layout/theme.liquid`：
   - 把 tactical CSS/JS load 註解掉（**不刪 import 行**，只讓它失效，方便日後 revert）
   - 加上 carcare 條件載入 + Cormorant Garamond / Inter / JetBrains Mono Google Fonts
   - body class `apgo-tactical-skin` 改成 `apgo-cc-skin`
3. 修改 `templates/collection.json`：
   - 從 `order` 移除 `apgo_tac_hero` / `apgo_tac_cart_bar`
   - `sections.apgo_tac_*` 兩個 entries 也移除（避免變成 orphan section data）
   - 保留 `section` / `collection_links_pNT4Ld` / `main` 三個原始 sections
4. **不刪任何檔案**（戰術風的 sections / css / js 全部留檔，git history 用）

**User 做**：刷新前端看效果。

**Rollback 步驟**（如果視覺不滿意）：
- 把 `theme.liquid` carcare load 改回 tactical load
- body class 改回 `apgo-tactical-skin`
- collection.json `order` 加回 `apgo_tac_hero` / `apgo_tac_cart_bar`
- 1 個 commit revert

### Phase 2：列表頁專屬 sections（hero / mosaic / product-grid 重做）
**Claude 做**：
1. 新建 `sections/apgo-cc-list-hero.liquid`（暫時純視覺，倒數延後）
2. 新建 `sections/apgo-cc-promo-strip.liquid`（3 顆 promo 膠囊，section settings 控文案）
3. 新建 `sections/apgo-cc-category-mosaic.liquid`（5 格分類磚 — 用 section blocks 讓 user 配 collection + 圖）
4. 把它們塞進 collection.json 順序：hero → promo strip → category mosaic → main-collection（既有 product grid）→ pagination
5. 必要時做 `sections/apgo-cc-product-grid.liquid` 完全取代 main-collection（這要決定）

**User 做**：上傳分類磚圖、設定每個磚連結到哪個 collection。

### Phase 3：列表頁互動細節
- sort tabs（熱銷/新品/價格 ↑↓）
- 商品卡 hover 動畫
- promo countdown timer（如果 user 改變主意要做）

### Phase 4：詳情頁皮膚（新模板）
- 新建 `templates/product.apgo-v2.json`
- 新建 `sections/apgo-cc-detail-main.liquid`、`apgo-cc-detail-tabs.liquid` 等
- 重點：**user 在 Shopify 後台手動把產品分配到 v2 模板**（v1s-plus 留給洗衣精）

### Phase 5：詳情頁 metafields & metaobjects
- 逐步建 design 文件提到的 metafield（subtitle / bullets / spec_rows / faqs / usage_steps...）
- 接到 v2 模板的 tabs

### Phase 6：Bundle / 倒數 / promo icons / 評價
- 進階互動 + 後端整合

---

## 7. 進度紀錄表（每 commit 更新）

| Phase | 狀態 | Commit | 備註 |
|---|---|---|---|
| 0 計畫書（初版） | ✅ | `0ca8df6` | 2026-04-27 |
| 0.5 計畫書更新（檔案盤點 + 反映 Phase 0 後 24 個其他 session commit） | ✅ | (本 commit) | 2026-04-28 |
| 1 列表頁皮膚 + 停用戰術 | ✅ 已完成 | (本 commit) | apgo-carcare.css + theme.liquid 載入切換 + body class 改 + collection.json 拿掉 tactical sections。戰術 css/js/sections 全部留檔 |
| 2 列表頁 sections | 🟡 進行中 | (本 commit) | Category Mosaic 完成；Hero promo banner + permanent promo pills 延後（屬於 user 緩做的「全站滿千」） |
| 3 列表頁互動 | ⏸ 未開始 | - | - |
| 4 詳情頁皮膚 + 新模板 | ✅ 已完成 | (本 commit) | apgo-cc-product-detail section + product.apgo-v2.json template + apgo-cc-pdp.js + PDP CSS。商品描述 tab 用 product.description；其他 4 個 tab 是 placeholder（Phase 5 接 metafields） |
| 5 詳情頁 metafields | ⏸ 未開始 | - | - |
| 6 Bundle / 倒數 / 評價 | ⏸ 未開始 | - | - |

### Phase 0 之後的中間 commits（不在本 plan scope，僅供 onboarding 參考）

| 範圍 | 代表 commit | 影響 |
|---|---|---|
| SGS 認證 section（PDP 第 5 個 tab） | `5624a3b` / `ea02e63` | PDP 多了 tab，本 plan 不動 PDP |
| Ship rows 改用 shop metafield | `e11217a` | shop metafield 多了 ship_rows 相關 |
| 桌機 hero 合併進 mobile-pdp | `41d1c90` | apgo-hero.liquid 還在但行為改了 |
| AJAX 加購物車 + toast | `23bb9c5` | PDP 不再 redirect 到購物車 |
| Quantity 雙 shell 同步 | `05f1134` | PDP 桌機/手機 數量同步 |
| 多版本 tactical-aio sections | (admin export) | sections 目錄多了 aio v1/v2/v3/v4 + hub，**全部不 touch** |

---

## 8. Rollback 策略

- **整體 rollback**：找到 Phase 1 第一個 commit → `git revert` 之後所有 commits → 回到戰術風狀態
- **單一 phase rollback**：每個 phase 獨立成一個 commit batch（commits 的 message 都標 `feat(cc): Phase N — ...`）
- **檔案層 rollback**：tactical 檔案 Phase 1 不刪只「停用」，未來想用回去把 import 加回來即可

---

## 9. 待 user 提供的素材（按 phase）

### Phase 2 需要
- 5 格分類磚對應的 collection（你目前有：促銷組合 / coating-series / 清潔藥劑全系列 / 洗車用品 / 科技執法測速器 / 暢銷優惠禮組 / 損傷修復 / homecleaning，總共 8 個，但 design 是 5 格，你要選 5 個）
- 5 張分類磚主圖（建議 16:9 或 4:3）
- Hero promo banner 文案 + 按鈕連結

### Phase 4 需要
- 決定哪些既有產品要切到 v2 模板（PDP 通用版）
- 哪幾個保留現有的 default `product.json` template

### Phase 5 需要（資料）
- 每個產品的 subtitle / bullets / spec / faq / usage_steps 內容

---

## 10. 跟戰術風重疊的東西怎麼處理

| 戰術風檔案 | Phase 1 動作 |
|---|---|
| `assets/apgo-tactical.css` | 留檔（不引用） |
| `assets/apgo-tactical.js` | 留檔（不引用） |
| `sections/apgo-tactical-hero.liquid` | 留檔（template 不引用） |
| `sections/apgo-tactical-cart-bar.liquid` | 留檔（template 不引用） |
| `docs/COLLECTION_TACTICAL_PLAN.md` | 留檔（已歸檔，標為 superseded） |
| body class `apgo-tactical-skin` | 改成 `apgo-cc-skin` |
| Google Fonts `Inter:ital,wght@0,400;0,700;0,900;1,900&family=JetBrains Mono` | 換成 `Cormorant Garamond:wght@300;400;500&family=Inter:wght@300;400;500;600&family=JetBrains Mono:wght@400;500` |

---

## 11. 給下一個 Claude 的 onboarding

如果你接手這個任務：
1. **先讀** `/tmp/apgo-design/apgotw/README.md`（如果 design bundle 還在）— 它會告訴你怎麼處理這份設計
2. **再讀** `/tmp/apgo-design/apgotw/chats/chat1.md`（user 跟設計 AI 的對話，了解設計意圖）
3. **再讀** `merged-list.jsx` / `merged-detail.jsx` / `mobile-list.jsx` / `mobile-detail.jsx` 完整讀過
4. **再讀** `palettes.jsx`（color tokens）+ `card-bits.jsx`（共用元件）
5. **再讀** `docs/Shopify-Integration.md`（後端 metafield 規格）
6. **檢查** 本文件第 7 節進度表，找下一個 ⏳ phase
7. **動工前** 跟 user 確認是否仍要往下推
8. **每完成一個 phase**：更新本檔第 7 節 commit hash 跟狀態
9. **絕對不動**：v1s-plus 模板那條線（見第 2.3 節）

如果 `/tmp/apgo-design` 已經被清理：
- 設計檔可從原 design URL 重新 fetch：`https://api.anthropic.com/v1/design/h/VaxbWZkn4cpbohShaxlOjQ`（gzip tarball）
- 或請 user 重發

---

## 12. 已歸檔：戰術風方案

戰術風（Phase 1-3 已完成、Phase 4 已撤）的計畫書：
**`docs/COLLECTION_TACTICAL_PLAN.md`** — Status: SUPERSEDED by Car Care Colors plan.

戰術風檔案在 git history 都還能找到，未來如果想叫回來，先看那份 doc 第 8 節進度表的最後一個 commit hash：`56b68b8`。
