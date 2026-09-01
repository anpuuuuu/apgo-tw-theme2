# Shopify 滿 NT$2,000 送 NT$200 Gift Card 自動化研究

> 建立日期：2026-08-24  
> 目前狀態：技術研究完成，等待在 TW 店鋪的 Shopify Flow 編輯器做實店驗證  
> 目標：不升級 Store Credit、不建立自製 App，盡量使用 Shopify 原生 Gift Card 與 Flow 自動完成。

---

## 1. 結論

優先方案是：

```text
Shopify Flow 定時執行
        ↓
取得已付款、符合金額且尚未獎勵的訂單
        ↓
再次確認退款／取消／顧客 Email 等條件
        ↓
Send Admin API request：giftCardCreate
        ↓
Shopify 產生隨機 16 位 Gift Card
        ↓
Shopify 原生通知寄給顧客
        ↓
訂單加上已發放標籤
```

此方案在官方功能上可行：

- Shopify Flow 的 `Send Admin API request` 可以呼叫大多數 GraphQL Admin API mutation，包括尚未做成 Flow 原生 action 的 mutation。
- `giftCardCreate` 可以建立指定初始金額的 Gift Card、關聯 Customer、加入內部備註與 recipient notification。
- 不傳入自訂 code 時，Shopify 會自動產生隨機 16 位英數代碼。
- Gift Card 可用於促銷、獎勵或退款，並且所有 Shopify 訂閱方案皆可使用。

官方參考：

- [Flow：Send Admin API request](https://help.shopify.com/en/manual/shopify-flow/reference/actions/send-admin-api-request)
- [Admin API：giftCardCreate](https://shopify.dev/docs/api/admin-graphql/latest/mutations/giftcardcreate)
- [Shopify 建立 Gift Card](https://help.shopify.com/en/manual/products/gift-card-products/issue-gift-card)

### 尚未能只靠文件確認的部分

Shopify 官方說 Flow 支援「大多數」mutation，但沒有逐店保證 `giftCardCreate` 一定出現在 Flow 下拉選單。因此正式拍板前必須登入 TW 店鋪做兩項驗證：

1. `Send Admin API request` 的 Mutation 清單能否選到 `giftCardCreate`。
2. `recipientAttributes.sendNotificationAt` 能否在 Flow 中使用動態時間並成功寄出原生 Gift Card 通知。

若第一項成功，原則上不需要自製 App；若第二項失敗，仍可自動建立 Gift Card，但寄送可能需要人工或第三方工具補上。

---

## 2. 為什麼選 Gift Card

### 顧客體感

```text
符合滿額條件
        ↓
收到 APGO／Shopify 的 NT$200 Gift Card Email
        ↓
下次購物到 Checkout
        ↓
在 Gift Card 欄位輸入代碼
        ↓
從應付金額扣除，未使用完的餘額繼續保留
```

Gift Card 使用 Shopify Checkout 原生 Gift Card 欄位，不使用 APGO 購物車現有的折扣碼欄位。

### 適合此需求的原因

- 是真正的 NT$200 餘額，不是綁定商品的折扣規則。
- Shopify 原生管理餘額、交易紀錄、失效狀態與通知。
- 可分次使用，顧客不必單次剛好用完 NT$200。
- 不依賴新版 Customer Account 的 Store Credit，因此不需要因這項活動改變 LINE／HIKO 登入架構。
- 不需要 AIOD。

---

## 3. 推薦的 Flow 架構：每日批次，而非付款後立即發

### 為什麼推薦每日批次

如果在 `Order paid` 後立即建立 Gift Card，訂單之後取消、退款或被判定異常時，已發出的 Gift Card 不會自動收回。每日批次可以設定「等待期」，並在真正發放前讀取最新訂單狀態。

Flow 的 Wait action 也能等待最多 90 天，而且等待結束後會重新整理資料；但定時批次更容易修改規則、重跑漏單與集中查錯。[Flow Wait 官方說明](https://help.shopify.com/en/manual/shopify-flow/reference/actions/wait)

### 推薦步驟

1. Trigger：`Scheduled time`，每天固定執行一次。
2. Action：`Get order data`，取得符合以下初步條件的訂單：
   - 已付款。
   - 已超過店鋪決定的獎勵等待期。
   - 尚未包含 `reward-giftcard-issued-200`。
   - 尚未包含 `reward-giftcard-processing-200`。
3. `For each` 處理每一筆訂單。
4. Condition：再次確認目前有效商品金額達 NT$2,000。
5. Condition：訂單未取消、退款後仍符合門檻。
6. Condition：存在 Shopify Customer，且顧客有可寄送的 Email。
7. 加入 `reward-giftcard-processing-200` 標籤。
8. Action：`Send Admin API request` → `giftCardCreate`。
9. 建立成功後：
   - 加入 `reward-giftcard-issued-200`。
   - 移除 `reward-giftcard-processing-200`。
10. 建立失敗時：保留 processing 標籤並寄內部警報，避免下一次排程重複建立。

`Get order data` 每次最多取得 100 筆；排程查詢應優先處理最舊、尚未發放的訂單。若日量可能超過 100，增加排程頻率或拆成多批。[Get order data 官方說明](https://help.shopify.com/en/manual/shopify-flow/reference/actions/get-order-data)

### 金額欄位建議

商業規則建議使用「折扣後、退款後的商品小計」，不含運費與稅金，而不是最初下單總額。Flow 實店設定時要確認對應欄位，預計使用：

```text
order.currentSubtotalPriceSet.shopMoney.amount >= 2000
```

這個條件仍需在 TW 店鋪 Flow 變數選單中確認。若公司定義的「滿 NT$2,000」包含運費或是以付款總額計算，則要換成對應的 current total 欄位。

---

## 4. giftCardCreate 輸入草稿

以下是 Flow `Send Admin API request` 的輸入方向，不是尚未測試就直接上線的最終值：

```json
{
  "input": {
    "initialValue": "200.0",
    "customerId": "{{ order.customer.id }}",
    "note": "APGO 滿額回饋｜來源訂單 {{ order.name }}",
    "recipientAttributes": {
      "id": "{{ order.customer.id }}",
      "preferredName": "APGO 顧客",
      "message": "感謝您的支持，這是本次滿額回饋 NT$200 購物金。",
      "sendNotificationAt": "由 Scheduled time 動態產生的 ISO 時間"
    }
  }
}
```

關鍵點：

- 不提供 `code`，由 Shopify 產生安全的隨機 16 位代碼。
- `customerId` 與 recipient 都指向本筆訂單的 Customer。
- `note` 寫入來源訂單號，客服日後能追查。
- `sendNotificationAt` 應使用排程時間加幾分鐘；正式 Liquid 寫法要以 TW 店鋪 Flow 編輯器實際支援的變數測試。
- 顧客沒有 Email 時不要執行自動建立，改標記為 `reward-giftcard-manual-review`。

API 要求 `write_gift_cards` 權限；如果 mutation 能從 Flow 內建清單選取，通常由 Shopify Flow 的店鋪權限處理，不需要自行保存 Admin API token。

---

## 5. 防止重複發放與查錯

### 訂單標籤

| 標籤 | 意義 |
|---|---|
| `reward-giftcard-processing-200` | 已進入建立流程，尚未確認完成 |
| `reward-giftcard-issued-200` | 已成功發放 NT$200 Gift Card |
| `reward-giftcard-manual-review` | 缺 Email、缺 Customer 或條件異常，需要人工處理 |

### Gift Card 內部備註

每張 Gift Card 必須包含來源訂單，例如：

```text
APGO 滿額回饋｜Order #12345｜Flow 2026-08-24
```

### 查錯順序

1. Shopify Flow → Activity，找到訂單對應的 workflow run。
2. 檢查停在哪個 condition 或 action。
3. 到 Products → Gift cards，以顧客或末四碼查找 Gift Card。
4. 檢查 Gift Card 的初始值、餘額、顧客、通知與內部備註。
5. 檢查訂單的 processing／issued／manual-review 標籤。
6. 未確認是否已建立前，不可直接重跑，避免顧客收到兩張 Gift Card。

Gift Card 被視為貨幣，店鋪後台建立後通常只能看到代碼末四碼；完整代碼應由 Shopify 原生通知交付給顧客。[Gift Card 概覽](https://help.shopify.com/en/manual/products/gift-card-products/overview)

---

## 6. 備援方案比較

| 方案 | 自動化程度 | 額外 App | 維護成本 | 建議 |
|---|---:|---:|---:|---|
| Flow＋`giftCardCreate`＋原生通知 | 高 | 無 | 低 | 首選，先做實店 POC |
| Flow 篩選並通知員工，人工建立 Gift Card | 半自動 | 無 | 中 | 最可靠備援 |
| 第三方 Gift Card／Loyalty App 的 Flow connector | 高 | 有 | 中至高 | 只有原生 API 方案不可用才考慮 |
| 把 Gift Card 商品加入原訂單再履約 | 中 | 無 | 高 | 不建議，會污染訂單、履約與會計流程 |
| 自製 App | 高 | 自製 | 高 | 目前需求明確排除 |

### 人工備援流程

1. Flow 加上 `reward-giftcard-manual-review` 並通知工作人員。
2. 工作人員到 Products → Gift cards → Create gift card。
3. 金額填 NT$200、選擇顧客、備註來源訂單。
4. Shopify 寄送 Gift Card。
5. 訂單改標記 `reward-giftcard-issued-200`。

---

## 7. 必須先拍板的商業規則

1. 門檻是「折扣後商品小計」還是「實際付款總額」？是否包含運費？
2. 使用 Gift Card 支付的部分是否也計入滿額門檻？
3. Gift Card 在付款後立即發、出貨後發，還是等待若干天後發？
4. 若部分退款後低於 NT$2,000，是否取消資格？
5. 每張訂單都可獲得，還是每位顧客／每段活動期間只能獲得一次？
6. Gift Card 是否設定效期？正式設定前需確認台灣適用的法律與會計處理。

---

## 8. 上線前 POC 驗證清單

1. 在 TW 店鋪 Flow 確認可選 `giftCardCreate`。
2. 使用測試顧客與 NT$1 測試 Gift Card，不先用正式 NT$200。
3. 確認未傳 code 時產生隨機 16 位代碼。
4. 確認 Customer 關聯正確。
5. 確認原生 Email 有寄出、內容與品牌樣式正確。
6. 確認顧客能在 Checkout 使用並保留餘額。
7. 模擬退款、取消、缺 Email 與重跑，確認不會重複發放。
8. 檢查 Flow Activity、訂單標籤、Gift Card 備註與財務報表。
9. 確認店鋪建立日期與方案是否適用 Gift Card 交易費。Shopify 說 2025-05-12 之後建立的店鋪，使用 Gift Card 支付的金額可能產生第三方交易費；Plus 搭配 Shopify Payments 有例外。

---

## 9. 下一步

這份研究不代表已在正式店鋪啟用。下一步是在 TW 店鋪建立一個停用狀態的測試 Flow，先完成 `giftCardCreate` 與通知 POC；測試成功後，再根據第 7 節的商業規則完成正式 workflow。
