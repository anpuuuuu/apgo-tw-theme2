# V1S-Plus · 限時優惠組合（Bundle）功能計畫書

> **本文件用途**：context 視窗超過 / 換 session 時，下一個 Claude 看這份就能無縫接手。User 也可以回來看流程進度。
>
> **建立日期**：2026-04-29
> **目前狀態**：Phase 0 計畫書建立，等 user 建好 metafield + Phase A 動工
> **設計參考**：user 在對話中提供的 4 張截圖（tier 卡 / 香氛 grid / disabled CTA / enabled CTA）

---

## 1. 目標

把現有「APGO 超級濃縮洗衣精」產品 PDP 的「香氛選擇 + 容量規格 + 數量 stepper + 加入購物車 / 立即購買」整段，替換成 **限時優惠組合 picker**：

1. 4 個 tier 卡片（單包 / 買 2 送 1 / 買 4 送 2 / 買 6 送 3）
2. 點 tier → 出現香氛分配區（counter X / max + 6 個香氛 qty stepper）
3. 沒選滿 → CTA disabled「還差 X 包」
4. 選滿 → CTA 啟動「加入購物車」+「立即購買 NT$ XXX」

**只給這個產品用**，不影響其他可能也用 v1s-plus 模板的產品。

---

## 2. User 拍板的 5 個決定（2026-04-29）

| # | 議題 | 決定 |
|---|---|---|
| 1 | bundle 區塊位置 | (a) 取代現有「香氛 + 容量 + 數量 + CTA」段 |
| 2 | tier 價格資料來源 | Phase A 寫死，Phase C 接 metaobject |
| 3 | 贈品的香氛 user 自選嗎？ | **是**（介面不區分買 / 送，全 N 包都讓使用者分配香氛） |
| 4 | 最少幾種香氛？ | **無限制**（可全部同款；「全部都同款」是 quick action 不是強制） |
| 5 | 折扣怎麼處理？ | **Shopify Automatic Discount**（user 後台手動設） |

---

## 3. Per-product 開關策略（重要）

`product.apgo-v1s-plus.json` 模板**所有產品共用同一份 section 設定**，所以無法用 section setting 開關 bundle UI。

**唯一乾淨的做法 = product metafield 開關**：

```liquid
{%- if product.metafields.apgo.bundle_enabled -%}
  ... 渲染 bundle widget ...
{%- else -%}
  ... 既有的 香氛 + 容量 + 數量 + CTA ...
{%- endif -%}
```

### Metafield 定義（user 建）

**Settings → Custom data → Products → Add definition**：

| 欄位 | 值 |
|---|---|
| Name | `啟用組合包選購` |
| Namespace and key | `apgo.bundle_enabled` |
| Type | **True or false**（Boolean） |
| Storefront API access | **ON**（必須，前端要讀） |

→ 進「APGO 超級洗衣精」產品 → metafields → 「啟用組合包選購」打勾 ✓
→ 其他產品保持不勾 → 看不到 bundle UI

**Phase A 動工的前提**：這個 metafield 必須先建好 + 在洗衣精產品打勾。

---

## 4. 涉及檔案

### 4.1 會動的
- `sections/apgo-mobile-pdp.liquid` — 主 PDP section（在 line 350~ 附近會新增 bundle 區塊，包在 `{% if product.metafields.apgo.bundle_enabled %}` 裡）
- `assets/apgo-pdp.css` — 加 bundle widget 樣式（奶油底、深棕 active、墨綠輔助色 — 跟既有 v1s-plus 風格一致，**不是 Car Care 風格**）
- `assets/apgo-pdp.js` — 加 bundle 互動 logic（Phase B+ 才動）

### 4.2 會新建的
- 無新 section / template / asset 檔案，全部加進既有 PDP 檔
- Phase C 可能新建 metaobject `bundle_tier` + product metafield `apgo.bundle_tiers`

### 4.3 絕對不動
- Car Care Colors 那條線（`apgo-carcare.css` / `apgo-cc-*` sections / `product.apgo-v2.json`）
- 任何其他產品 / collection / 首頁
- 既建的 metaobjects：`pain_solution` / `comparison_row` / `spec_row` / `review` / `faq` / `scent` / `usage_step`(?) — 全部保留
- 既建的 metafields：`apgo.subtitle` / `apgo.spec_rows` / `apgo.reviews` / `apgo.faqs` / `apgo.pain_solutions` / `apgo.comparison_rows` / `custom.pic` — 全部保留
- 5 個 tab（商品說明 / 規格 / 評價 / 問答 / SGS 認證）— 完全不動
- ship_row 區塊（配送提醒）— 完全不動
- Hero gallery / 標題 / 副標 / 評分 / 價格 / breadcrumb — 完全不動

---

## 5. 4 個 Phase

### Phase A：純 Layout（最先做）
**目標**：HTML + CSS 結構到位。按鈕點下去**完全沒反應**，純視覺。

**Claude 做**：
1. 在 `apgo-mobile-pdp.liquid` 找到既有「香氛選擇 + 容量 + 數量 + CTA」整段
2. 用 `{% if product.metafields.apgo.bundle_enabled %}` 包成 if/else：
   - **TRUE 路徑**：渲染新 bundle widget（hardcoded 4 tier）
   - **FALSE 路徑**：保留現在的 layout（不變）
3. Bundle widget HTML 三層結構：
   - 區塊 1：限時優惠組合（4 張 tier 卡，靜態）
   - 區塊 2：香氛選擇（counter 0/3 + 3 個 quick action 按鈕 + 6 個 scent rows，每個 row 有 [-] qty [+]）
   - 區塊 3：CTA 區（disabled 狀態 + enabled 雙按鈕，靜態 markup）
4. CSS 加在 `apgo-pdp.css`，使用既有的 v1s-plus tokens（奶油 / 深棕 / 墨綠），不是 Car Care 橘
5. **不寫任何 JS**

**User 確認**：
- 開 metafield → 看新 layout
- 關 metafield → 看舊 layout（功能正常）
- 視覺 OK 才進 Phase B

### Phase B：前端 Logic（純 JS，不接 cart）
**Claude 做**：
1. 點 tier 卡片 → 切換 active 狀態 + 把該 tier 的 max count 寫到 dataset / state
2. 香氛 +/- → 累計 counter
3. counter < max → CTA disabled「還差 X 包」
4. counter === max → 顯示總價 + 雙按鈕啟動
5. 「全部都同款」 → 把 N 包全給某預設或第 1 個香氛
6. 「隨機驚喜」 → JS 隨機分配 N 包到 6 香氛
7. 「清除」 → 全部歸零
8. 點 CTA 還是不接 cart，**只 console.log 預期的 cart payload**

**User 確認**：互動順了再進 Phase C

### Phase C：後端 cart 整合
**Claude 做**：
1. 設計 cart payload — 多 line items 一次加：
```json
{
  "items": [
    { "id": <variant_id_淨心棉花>, "quantity": 3, "properties": {
        "_bundle_id": "abc123",
        "_bundle_tier": "買4送2",
        "_bundle_role": "buy"
      }
    },
    { "id": <variant_id_海洋晨曦>, "quantity": 3, "properties": {
        "_bundle_id": "abc123",
        "_bundle_tier": "買4送2",
        "_bundle_role": "gift"
      }
    }
  ]
}
```
2. AJAX `POST /cart/add.js` (Shopify 支援一次加多 line items via `items` 陣列)
3. 加完成功 → toast「已加入購物車」+ 跳購物車 drawer（如果有）
4. 失敗 → toast 顯示錯誤
5. 「立即購買」按鈕 → 加完直接跳 `/checkout`
6. **User 後台設定**：Shopify Discounts → Automatic discounts → 規則例：
   - 「商品（洗衣精）數量 ≥ 3 → 折 NT$ 149」
   - 「商品數量 ≥ 6 → 折 NT$ 298」
   - 「商品數量 ≥ 9 → 折 NT$ 447」
   - 用「Order discount」+ 條件「Specific products: 洗衣精」+ minimum quantity

**User 確認**：實際下單一次走完流程

### Phase D：細節
- tier 切換動畫 / counter 跳動動畫
- Accessibility（ARIA labels / keyboard support）
- 邊界 case：庫存不足、變體已售完（花漾蒼蘭跟清雅白茶目前都 0 庫存，要怎麼處理？灰底不能選？）
- bundle 加完後購物車 drawer 怎麼顯示（要顯示 bundle 群組嗎？）
- 規格 / FAQ tab 加 bundle 相關問答

---

## 6. 進度紀錄表（每 commit 更新）

| Phase | 狀態 | Commit | 備註 |
|---|---|---|---|
| 0 計畫書 | ✅ | (本 commit) | 文件就緒 |
| 0.5 Metafield 建立 | ⏳ 待 user | - | user 在 Settings → Custom data 建 `apgo.bundle_enabled` boolean，洗衣精打勾 |
| A Layout | ⏸ 未開始 | - | 等 0.5 完成 |
| B 前端 Logic | ⏸ 未開始 | - | - |
| C Cart 整合 | ⏸ 未開始 | - | 含 user 後台 Automatic Discount 設定 |
| D 細節 | ⏸ 未開始 | - | - |

---

## 7. Rollback 策略

- **Phase A**：失敗 → user 把 `apgo.bundle_enabled` metafield 取消打勾 → 立刻看到原本 layout，無風險
- **Phase B**：失敗 → 同上，metafield 關掉就回原樣
- **Phase C**：失敗 → 同上 + git revert cart payload code
- **整體 rollback**：找到 Phase A 第一個 commit → `git revert` 之後所有 commits → 完全回到沒 bundle 之前

---

## 8. 已知技術風險 / 待確認

1. **庫存 0 的香氛**（花漾蒼蘭 / 清雅白茶）：UI 上是灰掉禁用 + 提示「缺貨」？還是隱藏？
2. **Shopify Automatic Discount 限制**：Basic plan 不支援 Functions，只能用 amount 或 percent 折扣，不能太花俏
3. **多 line items 一次加購**：`/cart/add.js` 支援 `items` 陣列嗎？需驗證 — Shopify [Cart AJAX API](https://shopify.dev/docs/api/ajax/reference/cart#post-cart-add-js) 確認支援
4. **Bundle 在 cart 怎麼顯示**：目前每包獨立 line item + properties 標記。cart drawer 需不需要群組顯示？
5. **加購後通知 cart drawer 更新**：要 dispatch `cart:updated` 事件
6. **第一個 tier「單包」**：本質上沒有 bundle 邏輯，是不是直接走原本的 qty=1 加購？還是也走 bundle flow？

---

## 9. 給下一個 Claude 的 onboarding

如果你接手這個任務：
1. **先讀** 本檔第 1-5 節，理解 4 個 phase 的 scope
2. **檢查** 第 6 節進度表，找下一個 ⏳ phase
3. **動工前** 跟 user 確認是否仍要往下推
4. **每完成一個 phase**：更新本檔第 6 節 commit hash 跟狀態
5. **絕對不動**（見第 4.3 節）：
   - Car Care 那條線
   - 既建的 metaobjects / metafields（不要 migrate 不要重命名）
   - 其他產品 / collection / 首頁
6. **與 Car Care 計畫的關係**：這是 **v1s-plus 線**的功能，跟 Car Care `docs/CAR_CARE_REDESIGN_PLAN.md` 完全平行，互不干擾

---

## 10. 參考連結

- 設計參考：user 提供的 4 張截圖（4 tier 卡 / 香氛 grid / disabled CTA / enabled CTA）
- 既有 v1s-plus PDP：`sections/apgo-mobile-pdp.liquid` line 350-450 附近
- 既有 PDP 樣式：`assets/apgo-pdp.css`
- 既有 PDP 互動：`assets/apgo-pdp.js`
- Car Care 平行計畫：`docs/CAR_CARE_REDESIGN_PLAN.md`
- 戰術風（已歸檔）：`docs/COLLECTION_TACTICAL_PLAN.md`
