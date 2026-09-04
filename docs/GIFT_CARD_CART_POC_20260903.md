# 購物車提前輸入禮品卡：最小驗證

日期：2026-09-03。狀態：核心最小驗證通過，測試資料已清理；尚未實作購物車 UI 整合。

## 目標與邊界

顧客在購物車的同一個輸入框輸入折扣碼或禮品卡，進入 Shopify 結帳時保留已套用項目，不要求再次輸入。

本輪僅驗證 API 到結帳的必要條件，沒有修改購物車輸入框或正式／Draft 主題，沒有提交訂單、付款、寄送通知、建立折扣或修改客戶禮品卡。依使用者明確授權建立一張 NT$1 專用測試卡，驗證後已停用。未部署額外服務。

## 已執行的實際驗證

使用獨立 HTTP session 建立 Ajax 測試購物車；未讀寫使用者瀏覽器的購物車。商品為鍍膜布，variant `47358780899579`，數量 2，測試行項目属性 `_apgo_poc=gift-card-carryover-20260903`。

| 檢查 | 實際結果 |
| --- | --- |
| 原生 Ajax 購物車 | 商品總額 NT$78，既有折扣碼 `EDMCART50` applicable=true，折扣 NT$50，商品折後合計 NT$28 |
| Storefront API `cartCreate` | 無額外 Storefront token 的請求成功；上述商品、數量、折扣及測試屬性完整保留；合計 NT$28 |
| 開啟 API 回傳的 `checkoutUrl` | 實際 Shopify 結帳頁顯示鍍膜布 ×2、NT$78、`EDMCART50` −NT$50、合計 NT$28；尚未填寫地址，運費未計 |
| 原生結帳輸入欄位 | 可見「折扣代碼或禮品卡」 |
| 無效禮品卡 | `cartGiftCardCodesUpdate` 回傳空 userErrors 與 warnings，但 appliedGiftCards 為空；商品及原折扣保持不變 |
| 有效禮品卡 API 套用 | 在新建的相同商品／折扣測試購物車套用 NT$1 卡，appliedGiftCards 回傳末碼 `hykr`、amountUsed=1.0 TWD，折扣仍 applicable=true，totalAmount=27.0 TWD |
| 有效卡自動帶入實際結帳 | 開啟 API 回傳的 checkoutUrl，未在結帳頁重新輸入；同時顯示 `EDMCART50` 與「末碼為 hykr 的禮品卡」，總金額 NT$28、禮品卡 −NT$1、應收總金額 NT$27（運費尚未計入） |
| 移除禮品卡 | API 傳入空 giftCardCodes 後，appliedGiftCards 清空、商品仍為 2 件、合計恢復 NT$28，原折扣保留 |
| 清理 | 本輪各個獨立 Ajax／Storefront 測試購物車均已移除測試商品，數量確認為 0；測試結帳分頁已關閉；NT$1 測試卡狀態確認為 Deactivated |

結論：已實際證明「提前透過 Storefront API 套用有效禮品卡，並與折扣一起帶入原生結帳」可行，且本次基本路徑沒有使用額外後端或 Storefront access token。這仍不是「現有購物車共用輸入框已完成」的驗收。

## 測試卡與清理記錄

- Shopify GiftCard ID：`574794137851`，末四碼 `hykr`，初始金額 NT$1。
- 未指定客戶或收件人；Send gift card 按鈕一直不可用，未寄送通知。
- 後台 Timeline 確認建立及停用事件，狀態為 Deactivated。
- 停用時餘額仍為 NT$1，未完成訂單或實際支付；停用紀錄保留於後台，該卡不能再次使用。
- 正式、Draft 主題及既有折扣設定未更動。

## 尚未驗證

- 禮品卡替換、多卡、餘額耗盡、已過期／停用卡的錯誤提示，以及變更購物車金額後的重新計算。
- 現有贈品、會員身分、發票／收件資料、組合商品及訂閱方案的完整相容性。
- 桌機／手機的共用輸入框操作；本輪尚未實作 UI。

目前 Admin 連接缺少 `read_gift_cards` 權限，因此使用者授權後，透過既有後台 UI 建立及停用測試卡；沒有增加連接權限，也沒有使用任何客戶卡片。

## 對實作的直接影響

- 必須以回傳的已套用禮品卡清單判定是否成功，不能只判斷 HTTP 成功或沒有 userErrors。
- 本輪沒有證明必須新增後端服務；購物車基本建立已能直接呼叫官方 Storefront API。正式架構仍須依會員、敏感資料處理及整合驗證決定。
- 現有 Ajax 購物車與 Storefront API 購物車不是同一個物件。本輪僅確認明確複製的簡單商品與折扣一致，不代表已建立自動同步。
- 禮品卡完整代碼、購物車密鑰及結帳 session 網址不寫入此報告或版本控制。

官方參考：

- https://shopify.dev/docs/api/storefront/latest/mutations/cartGiftCardCodesUpdate
- https://shopify.dev/docs/api/storefront/latest/objects/Cart
- https://community.shopify.dev/t/storefront-cart-api-and-shopify-liquid-themes-cart-how-to-make-them-sync/35172
