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

## 2. 涉及哪些檔案？

### 2.1 會新建的
- `assets/apgo-carcare.css`（取代 `apgo-tactical.css` 的角色，新主題皮膚）
- `assets/apgo-carcare.js`（互動：sort tabs、category tile clicks、promo countdown 等）
- `sections/apgo-cc-list-hero.liquid`（列表頁 hero 促銷帶）— 如果 user 同意做
- `sections/apgo-cc-category-mosaic.liquid`（5 格分類磚 — 桌機 2:1:1:1:1，手機 featured + 2x1）
- `sections/apgo-cc-product-grid.liquid`（取代 / 包住現有 `main-collection`）
- `sections/apgo-cc-promo-strip.liquid`（永久促銷膠囊列）
- `templates/collection.json`（重塑，當前 tactical sections 都拆掉）
- `templates/product.apgo-v2.json`（新通用詳情頁模板）
- `sections/apgo-cc-detail-*.liquid`（詳情頁多個 section，待 phase）
- `docs/CAR_CARE_REDESIGN_PLAN.md`（本檔）

### 2.2 會被廢棄 / 移除的（Phase 1 動工時）
- `assets/apgo-tactical.css`（戰術風皮膚）
- `assets/apgo-tactical.js`
- `sections/apgo-tactical-hero.liquid`（戰術 Hero）
- `sections/apgo-tactical-cart-bar.liquid`（懸浮購物車列）
- `templates/collection.json` 中 `apgo_tac_hero` / `apgo_tac_cart_bar` 條目
- `layout/theme.liquid` 中 `template.name == 'collection'` 的 tactical 載入分支

### 2.3 絕對不動
- `templates/product.apgo-v1s-plus.json`（洗衣精單品專用模板）
- `sections/apgo-hero.liquid`、`sections/apgo-mobile-pdp.liquid`（v1s-plus 的 PDP sections）
- `assets/apgo-pdp.css`、`assets/apgo-pdp.js`（v1s-plus 的 PDP assets）
- 既建的 metaobjects：`pain_solution` / `comparison_row` / `spec_row` / `review` / `faq` / `scent`
- 既建的 product metafields：`apgo.pain_solutions` / `apgo.comparison_rows` / `apgo.spec_rows` / `apgo.reviews` / `apgo.faqs` / `custom.pic` / `apgo.subtitle`
- shop metafield `apgo.scents`

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

### Phase 1：列表頁皮膚 + 拆戰術風（**先這刀**）
**目標**：collection 頁變成 Car Care Colors 風格，但**保留現有的 product card block 結構**（跟戰術風一樣的策略）。

**Claude 做**：
1. 新建 `assets/apgo-carcare.css` — 全套 token + 列表頁所有皮膚
2. 修改 `layout/theme.liquid`：
   - 移除 tactical 條件載入
   - 改成 collection 頁載入 carcare CSS + Cormorant Garamond / Inter / JetBrains Mono fonts
   - body class 改 `apgo-cc-skin`（不再是 `apgo-tactical-skin`）
3. 修改 `templates/collection.json`：
   - 移除 `apgo_tac_hero` / `apgo_tac_cart_bar`
   - 暫時保留現有 `main-collection` 跟 `collection_links_pNT4Ld`（用 CSS 重新化妝）
4. 廢棄 tactical 相關檔案：
   - `assets/apgo-tactical.css`、`apgo-tactical.js`（保留檔案以便 git history，但不再 import）
   - `sections/apgo-tactical-hero.liquid`、`apgo-tactical-cart-bar.liquid`（同上，留檔但 collection.json 不引用）

**User 做**：看效果。

**Rollback**：把 theme.liquid 的 `apgo-cc-skin` body class + carcare CSS load 拿掉、collection.json 還原。

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
| 0 計畫書 | ✅ | (本 commit) | 文件就緒 |
| 1 列表頁皮膚 + 拆戰術 | ⏳ 待動工 | - | - |
| 2 列表頁 sections | ⏸ 未開始 | - | - |
| 3 列表頁互動 | ⏸ 未開始 | - | - |
| 4 詳情頁皮膚 + 新模板 | ⏸ 未開始 | - | - |
| 5 詳情頁 metafields | ⏸ 未開始 | - | - |
| 6 Bundle / 倒數 / 評價 | ⏸ 未開始 | - | - |

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
