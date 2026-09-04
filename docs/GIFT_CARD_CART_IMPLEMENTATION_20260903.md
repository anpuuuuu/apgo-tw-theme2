# 購物車禮品卡預填實作與驗證 — 2026-09-03

## 發布邊界

- 開發及 Draft 驗證分支：`feature/main-navigation-v2-preview`。
- 僅推送 Draft Theme `162094055675`，未合併 main、未發布正式主題。
- 2026-09-04 依確認將禮品卡功能做成獨立 Git 提交，移植並推送至最新 `origin/main`；這不等於發布 Shopify 正式主題。
- Draft 購物車：[預覽](https://apgo.tw/cart?preview_theme_id=162094055675)。
- 推送前已將遠端對應檔案備份到本機臨時資料夾，逐檔與 Git HEAD 比對一致，沒有覆蓋 Editor 額外改動。
- 最後再從 Draft 下載本次 6 個主題檔案，與本機逐檔比對一致。

## 顧客操作

1. 同一輸入區先選「折扣碼」或「禮品卡」，再輸入並按「套用」。不以代碼長度猜測類型，也不把禮品卡當一般折扣碼送出。
2. 折扣碼沿用現有 Ajax Cart 流程，包括既有 `0507` 代碼贈品邏輯。
3. 禮品卡只接受 Shopify 實際回傳已套用且抵用額大於零的結果；API 沒有 userErrors 不代表成功。
4. 成功後只顯示末四碼、預估抵用與商品預估應付。商品總計、免運及滿額贈品門檻仍依原購物車金額計算。
5. 一次一張；更換時先移除目前卡片。移除後恢復普通結帳路徑。
6. 結帳前再次同步與核對。無法完整保留商品或優惠時停止並提示重試，或移除此處卡片、改到原生結帳輸入；不靜默丟棄卡片跳轉。

## 程式結構

- `snippets/cart-discount-input-only.liquid`：類型切換、共用輸入框、翻譯配置、舊折扣流程。
- `snippets/cart-gift-card-bridge.liquid`：Storefront API 2026-07 adapter、狀態、同步、差異檢查、安全結帳網址及提示。
- `sections/cart-shell-v2.liquid`：結帳前儲存發票 / 聯絡屬性，再決定原生或禮品卡 checkout URL；購物車刷新時保留收件 / 發票表單節點。
- `locales/en.default.json`、`zh-TW.json`、`zh-CN.json`：新增 `apgo_gift` 文案。
- `tests/gift-card-bridge.test.cjs`：純 Node 測試，使用合成資料、不建立公開測試商品或訂單。

不用新增後端或 Storefront token。瀏覽器將完整禮品卡代碼只提交至本店 Shopify Storefront GraphQL API，透過 request body 而非 URL；不寫入 cart attributes、line properties、分析事件、console 或檔案。送出後清空輸入。

sessionStorage 僅保存 Storefront cart ID（含私密 key，視為敏感會話）、原生 cart token / customer 的 SHA-256 綁定、末四碼及 30 分鐘期限；不保存完整卡號。會員 ID 僅用作會話綁定，並不是 Storefront 顧客驗證憑證。儲存不可用時只維持本頁記憶體狀態。

Storefront cart ID 不可加入日誌、文件或分享連結。移除會嘗試清除遠端卡片；即使網路失敗也會丟棄本機對該 checkout 的引用，不再導向它。這不是停用顧客禮品卡，卡片仍由顧客保有。

## 一致性保護

- 保留 variant、quantity、properties（含 APGO 自訂組合與贈品標記）、selling plan ID、cart attributes、note、可套用折扣碼。
- 更新現有 Storefront cart 而非每次重建，以保留已套用卡片。替換商品時先加入新行再移除舊行，避免中途清空。
- 比對商品身份與數量、屬性、備註、折扣碼適用狀態、幣別，以及「Storefront total + 實際禮品卡抵用」與原生 cart.total_price。
- 再讀取原生 cart fingerprint，偵測同步期間其他頁面 / App 改動。
- 傳輸錯誤、缺貨警告、會員優惠無法複製、資料或金額不同均阻止禮品卡 checkout。
- 結帳 URL 僅接受本店 HTTPS `/cart/c/` 地址，保留 Shopify 私密 key；只附加白名單地址 / 電話 / Draft 預覽參數，不覆蓋 key、不傳完整卡號。
- 原生購物車更新中阻止提早結帳，並在主要結帳請求期間防止重複點擊。

## 驗證結果

### 自動化

執行 `node --test tests/gift-card-bridge.test.cjs`，13 項通過：

- 無卡維持原生 checkout。
- 有效卡與既有折扣並存、僅儲存允許欄位、結帳預填白名單。
- 無效卡回傳空 appliedGiftCards、單卡限制。
- 數量 / 變體 / properties / note / 發票更新。
- selling plan 轉換、原生複合 bundle 拒絕。
- 幣別、折扣、價格、屬性、行項差異攔截。
- 過期、cart 身份改變、同步中異動、網路失敗、移除。
- 惡意結帳 URL 拒絕、翻譯與 inline JS 語法。

Storefront 全部 9 個 GraphQL operations 已通過 Shopify schema validator。兩個 snippets、英文與繁體 locales 通過 Liquid skill validator。該 validator 仍報出原檔既有問題：cart-shell 的固定 variant ID / 未使用變數，以及 zh-CN 大量既有缺漏翻譯；本次沒有宣稱全主題靜態检查零提示。

### 真實 Draft UI

- 原購物車為 16 件，總額 NT$23,904；未移除原商品。
- 無效卡由實際輸入框提交，正確顯示無法抵用，原金額不變。
- 本轮唯一測試卡：Gift Card ID `574794367227`，末四碼 `1538`，初始 NT$1；無指定顧客 / 收件人、未按 Send gift card。
- 從購物車套用後顯示預估抵用 NT$1、商品預估應付 NT$23,903。
- 實際點擊「結帳 →」及「不登入，直接結帳」，Shopify 結帳自動顯示同卡末四碼、抵用 NT$1、應收 NT$23,903；未在結帳再次輸入禮品卡。
- 結帳显示 16 件商品、小計 NT$23,904、原運費 NT$130 折為免費。未按付款、未下單。
- 從結帳返回購物車，卡片狀態與抵用額保留。
- 暫將原噴頭數量 1 → 2，總額變 NT$23,924、預估應付 NT$23,923；收件姓名測試值及超商分頁保留。之後恢復 2 → 1、清空測試姓名、還原宅配分頁。
- 由前台「移除禮品卡」清除測試套用，回到 16 件 / NT$23,904。
- 後台確認測試卡 **Deactivated**、餘額仍 NT$1，timeline 有停用紀錄；卡片不可重新啟用。沒有寄送 Gift Card Email，沒有付款。
- 390 × 844 手機 viewport：頁寬 / scrollWidth 皆 390；表單寬 316、輸入框寬 220，沒有橫向溢出；無效卡提示及按鈕可操作。測完重置 viewport。

第一次 UI 測試發現類型切換的 delegated selector 誤匹配外層容器，會在點套用時清空輸入；已限定 `button[data-code-mode]` 並重新驗證成功。

## 本版限制與正式上線前的檢查

- 首版限台灣 / TWD、最多 250 原生行項、一次一張卡。原生 item_components / parent_relationship 複合 bundle 不支援轉換，會提示改到原生結帳輸入。
- APGO 自訂 properties 組合與 selling plan 已實作保留、合成資料測試通過；尚未逐一實測所有 App 贈品、訂閱與會員限定折扣組合。金額不一致時安全攔截，不假裝已支援。
- 本次真實按鈕測試未新增折扣碼到使用者現有購物車。折扣碼 + 有效禮品卡的真實合併已由前一輪 PoC 驗證；本輪相同條件另有合成資料回歸測試，不能寫成每種實際促銷都通過。
- checkout 已儲存的非零運費 / 稅費可能使返回購物車後的全額比較不一致；目前會保守阻止禮品卡跳轉並提供重新套卡 / 原生結帳途徑，未以扣除估算稅運方式放寬。
- 未實際付款，故付款完成後原生 Ajax cart 是否清空、訂單归属、會員登入、App 訂單整合等尚未驗收。正式上線前需另行授權測試訂單驗證；目前只保留 Draft。
- Shopify checkout 的最終金額與禮品卡有效性仍由 Shopify 在付款時決定。

## 官方依據

- [Cart 與成本](https://shopify.dev/docs/api/storefront/latest/objects/CartCost)
- [套用禮品卡](https://shopify.dev/docs/api/storefront/latest/mutations/cartGiftCardCodesUpdate)
- [購物車行項更新](https://shopify.dev/docs/api/storefront/latest/mutations/cartLinesUpdate)
- [Shopify CLI theme push](https://shopify.dev/docs/api/shopify-cli/theme/theme-push)
