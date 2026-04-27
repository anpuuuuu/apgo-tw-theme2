# Collection Page · Tactical Skin 計畫書

> **本文件用途**：context 視窗超過 / Claude 換 session 時，下一個 Claude 看這份就能無縫接手。User 也可以回來看流程進度。
>
> **建立日期**：2026-04-27
> **目前狀態**：Phase 1 待動工
> **Approach**：方案 B（保留現有 product card block 結構，外圍套戰術風）

---

## 1. 為什麼做？目標是什麼？

User 提供了一份 mockup（`C:\Users\chiaz\Downloads\馬來西亞代碼_子平\_.html`，TACTICAL_LOADOUT 主題），要把目前 apgo.tw 的 collection page（`/collections/all` 等）改成這個戰術風視覺：
- 黑底 (`--dt-bg-screen: #050505`)
- APGO 品牌橘 (`#f08418`) 為 accent
- JetBrains Mono 字型在價格、標籤
- 大寫斜體 Inter 在標題
- 軍事/戰術術語（DEPLOY_TO_LOADOUT 取代「加入購物車」、CRD 取代 NT$、FINALIZE_MISSION 取代「結帳」）

**重點限制**：
- ❌ **不能動** PDP 那條線：`apgo-hero.liquid` / `apgo-mobile-pdp.liquid` / `apgo-pdp.css/js` / `templates/product.apgo-v1s-plus.json` 等
- ✅ **要保留** Shopify Horizon 主題的 nested static block 編輯 UX（user 在 theme editor 可以個別點 product card 內的 title / price / media 編輯）

---

## 2. 涉及哪些檔案？

### 會動的
- `templates/collection.json`（加 wrap class、可能加新 sections）
- 新建 `assets/apgo-tactical.css`（戰術風 CSS）
- 新建 `assets/apgo-tactical.js`（floating cart bar、bottom sheet 互動）
- 新建 `sections/apgo-tactical-hero.liquid`（Phase 2）
- 新建 `sections/apgo-tactical-tabs.liquid`（Phase 2，可能取代或包住 collection-links）
- 新建 `sections/apgo-tactical-cart-bar.liquid`（Phase 3）
- 新建 `sections/apgo-tactical-menu.liquid`（Phase 4，bottom sheet）
- 可能調整 `sections/main-collection.liquid`（**只加 class hook，不動 block 結構**）
- 可能調整 `layout/theme.liquid`（加 Inter + JetBrains Mono Google Fonts）

### 絕對不動
- `templates/product.apgo-v1s-plus.json` 及衍生的 PDP section / asset
- 其他不相關的 sections（header / footer / cart drawer 等）

---

## 3. 為什麼選方案 B？

### 三個方案比較

| 方案 | 戰術風還原度 | 保留 block 編輯 UX | 工程量 | Rollback |
|---|---|---|---|---|
| A 砍掉重建 | 100% | ❌ 失去 | 大 | 難 |
| **B 化妝** | 80% | ✅ 完全保留 | 中 | 易（移除 wrap class） |
| C 雙模板並存 | 100%（自選） | 看 A/B | 中 | 中 |

User 選 **B**，因為：
1. 不想失去現有 product card 的 block-by-block 編輯 UX
2. 隨時可 rollback（只要把 wrap class 拿掉，整頁就回到原樣）

### B 的核心策略

```
templates/collection.json
└── wrap class: .apgo-tactical-skin
    ├── (新) apgo-tactical-hero.liquid       ← Phase 2
    ├── (新) apgo-tactical-tabs.liquid       ← Phase 2
    ├── (現) main-collection.liquid          ← 不動 block 結構，只靠外層 CSS 變黑
    └── (新) apgo-tactical-cart-bar.liquid   ← Phase 3
(全頁固定底部) (新) apgo-tactical-menu.liquid ← Phase 4
```

CSS 把現有 product card 內的 `.product-title` / `.price` 等 selector 在 `.apgo-tactical-skin` 命名空間下重新定義（黑底、橘字、Mono 字型）。block 結構不變，但「皮膚」變了。

---

## 4. 四個 Phase（增量推進）

### Phase 1：CSS 化妝（~30 分鐘工程）
**目標**：頁面底色 / 字型 / 卡片視覺改成戰術風，不加新 section。

**Claude 做**：
1. `assets/apgo-tactical.css`：定義 `.apgo-tactical-skin` 命名空間下的所有覆蓋規則
   - 頁面背景 #050505
   - product-card 改黑底 + 戰術邊框
   - product-title 改大寫斜體 Inter 900
   - price 改 JetBrains Mono 900 橘色（NT$ 可保留或換 CRD）
   - hover/active 加橘色發光
2. `layout/theme.liquid`：加 Google Fonts（Inter / JetBrains Mono）
3. `templates/collection.json`：在最外層加 wrap class（待研究 Horizon 怎麼加）— 如果不能在 JSON 上加，改在 `main-collection.liquid` 包一層 wrapper div

**User 做**：
- 看前端效果
- 決定要不要繼續 Phase 2

**Rollback**：刪 wrap class / 註解 import → 完全回到原樣

### Phase 2：Hero Banner + Tactical Tabs（~1 小時）
**Claude 做**：
- `sections/apgo-tactical-hero.liquid`：image_picker + kicker + title + 大標 + 副標 + 按鈕（CTA URL）
- `sections/apgo-tactical-tabs.liquid`：sticky 橫向 scroll tab，active 狀態橘底 + 發光
  - 可能直接 reskin 現有 `collection-links` 而不是新建（更省事，再決定）

**User 做**：
- 提供 Hero Banner 素材：背景圖、kicker（如「// NEW_DEPLOYMENT」）、大標（如「GRAPHENE_REV7」）、描述文字、按鈕文字、按鈕連結
- 決定 tab 文案策略（**待決定**，見第 5 節）

### Phase 3：懸浮底部購物車列（~1.5 小時）
**Claude 做**：
- `sections/apgo-tactical-cart-bar.liquid`：fixed bottom，顯示 `cart.total_price` + 結帳按鈕
- `assets/apgo-tactical.js`：監聽 `cart:updated` → 即時更新；FINALIZE_MISSION → `/checkout`

**User 做**：
- 決定 CRD 還是 NT$（**待決定**，見第 5 節）
- 決定是否顯示商品數量（圖示 + count）

### Phase 4：Command Center bottom sheet（~1 小時）
**Claude 做**：
- `sections/apgo-tactical-menu.liquid`：含 4 格 sectors grid + 推薦商品 + 文字連結
- 用 `<details>` 或 `<dialog>` + JS 控制滑入/滑出
- hamburger 按鈕（已在 Phase 2 hero 裡）→ 觸發 sheet

**User 做**：
- 提供 4 個分類資料（圖片 + 名稱 + 連結）
- 指定一個推薦商品（product handle）

---

## 5. 待 User 決定的事項

| # | 問題 | 選項 | 決定 |
|---|---|---|---|
| 1 | 方案選擇 | A / B / C | **B**（決定 2026-04-27）|
| 2 | 戰術風套用範圍 | (a) 全部 collection<br>(b) 只套某幾個 | **(a) 全部**（決定 2026-04-27）|
| 3 | 貨幣顯示 | NT$ / CRD（純文字）/ CRD（真做點數系統） | **NT$ 維持不變**（決定 2026-04-27）|
| 4 | Tactical Tabs 文案 | (a) mockup 英文<br>(b) 中文戰術風<br>(c) 維持現有 | **(b) 中文戰術風**（決定 2026-04-27）|
| 5 | Hero Banner 素材 | 圖、文案 | **待提供**（Phase 2 才需要） |
| 6 | Phase 4 推薦商品 | 一個 product handle | **待提供**（Phase 4 才需要） |
| 7 | 4 格 sectors 分類 | 4 張圖 + 4 個名稱 + 4 個連結 | **待提供**（Phase 4 才需要） |

---

## 6. Rollback 策略（重要）

如果任何 Phase 看了不滿意：
- **Phase 1 rollback**：移除 wrap class + 註解 `apgo-tactical.css` import → 1 個 commit revert
- **Phase 2/3/4 rollback**：移除對應 section（從 collection.json 拿掉）→ section 檔案留著也沒影響
- **整體 rollback**：`git revert` 從第一個 tactical commit 起算

---

## 7. 已知技術風險

1. **Horizon block hierarchy 黑盒**：current `main-collection.liquid` 309 行，內部用 Horizon 自家的 block render system。CSS 命名空間是否能完整覆蓋？Phase 1 會驗證。
2. **CSS 變數衝突**：mockup 用 `--dt-bg-screen` 等變數，現有主題用 `--color-background` 等。需 scope 在 `.apgo-tactical-skin` 內避免污染其他頁。
3. **Floating cart bar 跟主題既有 cart drawer 衝突**：要確認不會雙開。
4. **Shopify Horizon 升級會不會打架**：Horizon 是 Shopify 官方主題，未來升級可能改 block 結構。屆時 CSS 覆蓋可能要更新。

---

## 8. 進度紀錄（每個 commit 後更新）

| Phase | 狀態 | Commit hash | 備註 |
|---|---|---|---|
| 0 計畫書 | ✅ 已完成 | e9759d6 | 文件就緒 |
| 1 CSS 化妝 | ✅ 已完成 | 5102045 | apgo-tactical.css + theme.liquid 條件載入 + body class |
| 2 Hero + Tabs | ✅ 已完成 | afd9e00 | 新建 apgo-tactical-hero section + 強化 collection-links pill 樣式；hero 已 seed 進 collection.json |
| 3 Cart Bar | ✅ 已完成 | (本 commit) | 新建 apgo-tactical-cart-bar section + apgo-tactical.js（cart 即時總額、fetch 攔截更新、checkout 跳轉） |
| 4 Bottom Sheet | ✅ 已完成 | (本 commit) | 新建 apgo-tactical-menu section（hamburger trigger + sectors blocks + featured product + system_link blocks）|

---

## 9. 給下一個 Claude 的 onboarding

如果你是接手這個任務的 Claude：
1. **先讀** `mockup` 原始檔：`C:\Users\chiaz\Downloads\馬來西亞代碼_子平\_.html`
2. **再讀** 本文件第 1–4 節，理解目標跟方案
3. **跑一下** `git log --oneline -20` 看最近 commit，找最後一個 `tactical` 相關 commit
4. **檢查** 第 8 節進度紀錄，找下一個 ⏳ phase
5. **動工前** 跟 user 確認第 5 節的待決定事項是否還有缺
6. **每完成一個 phase**：更新本文件第 8 節的 commit hash 跟狀態
7. **絕對不動** PDP 那邊：`product.apgo-v1s-plus.json` / `apgo-hero.liquid` / `apgo-mobile-pdp.liquid` / `apgo-pdp.css` / `apgo-pdp.js`

---

## 10. 參考連結

- mockup 原始檔：`C:\Users\chiaz\Downloads\馬來西亞代碼_子平\_.html`
- 現行 collection 主 section：`sections/main-collection.liquid`
- 現行 collection 子 nav：`sections/collection-links.liquid`
- 現行 collection template：`templates/collection.json`
