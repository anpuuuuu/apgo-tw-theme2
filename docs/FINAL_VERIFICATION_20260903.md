# 最終統一驗證：購物／結帳入口及禮組導覽回歸通過（未付款下單）

## 第五輪：公司名稱已依授權補正（正式站與 Draft 共用）

日期：2026-09-03，Shopify 更新時間 `2026-09-03T11:20:35Z`。使用者明確同意補正正式站共用 Page 正文。

- 目標：`gid://shopify/Page/133607162107`，`/pages/campaign20260803`，APGO評價募集活動。
- 僅將 1 處 `【APGO 公司完整登記名稱】` 替換成使用者提供的「光世代科技有限公司」。修改前已保存完整正文；mutation 只提交 body。
- `pageUpdate` userErrors 為空。更新後讀回，body 完全等於原文精確替換的結果；只有 body 和 updatedAt 改變，title、handle、isPublished、publishedAt、templateSuffix 均保持不變。
- 正式站和 Draft URL HTTP 200，兩者回傳 HTML 均包含正確公司名稱、不再包含原占位文字。本輪為文字定點驗證，不重跑購物流程。
- 備份：`docs/qa/company-page-before-20260903.json`、`docs/qa/company-page-after-20260903.json`。
- 沒有修改商品、選單、Theme 檔；沒有發布 Draft／合併 main／Git commit 或 push。公司名稱是此次唯一允許影響正式站的變更。

前述兩項收尾（推薦價格、活動公司名稱）均已完成；未付款下單等驗證界線仍依前輪報告保留。

---

## 第四輪：洗衣精推薦價格已統一；公司名称等待共用內容修改授權

日期：2026-09-03。使用者要求修復推薦價格，並提供公司名稱「光世代科技有限公司」。本節為最新狀態，下方待辦描述為歷史紀錄。

### 已完成

- 電腦 `sections/apgo-related.liquid` 和手機 `sections/apgo-mobile-pdp.liquid` 的推薦區，不再直接輸出 `p.price` 最低價。
- 新增 `snippets/apgo-related-price.liquid`，只包裝既有 `price` 元件，明確傳入 `is_product_card: true`，不複製另一套價格邏輯。價格範圍、全部規格划線原價、部分規格優惠及無優惠規則均沿用共用元件。
- 使用獨立 `.apgo-related-card-price` CSS 範圍，在窄卡允許換行、標籤另列；不影響商品主售價、已選規格價、商品後台售價或結帳計算。
- 兩處推薦圖片補 width／height。其他圖片和商品選擇／加購程式未動。
- 修改前下載 Draft 原檔比對，兩個 section 及共用 price 與本地一致。只推送上述 3 個檔案至 Draft `162094055675`，下載回讀全部相同。未發布、未合併 main、未推送 Git、未修改正式 Theme 或選單。

### 測試證據

- `tests/related-price.test.cjs`：7 種價格資料 × 2 個真實推薦區 Liquid 渲染均通過，另驗證選中規格仍顯示單一售價／原價。涵蓋部分優惠、全部優惠、無優惠、compare 等於／低於售價、單規格及同價混合優惠。
- `tests/related-price-smoke.cjs`：Draft 桌機 1440px 的 5 張卡、手機 390px 的 8 張卡逐一與商品 `.js` API 比對，售价範圍／划線範圍／部分優惠判斷一致；無頁面横向溢出，價格容器不超過卡片寬度。兩端截圖已人工查看。
- 手機塑膠保護劑、鋁圈光亮劑與鐵粉去除劑均顯示 `$20 TWD ~ $250 TWD`、`部分規格優惠`，沒有單一划線價；雨刷精顯示 `$20 TWD ~ $120 TWD`。
- 電腦現有集合是居家清潔，5 張洗衣精卡均正確顯示售價 `$299 TWD`、划線 `$399 TWD`；未改 Editor 的推薦集合或商品順序。
- `tests/related-add-smoke.cjs`：電腦由推薦卡進入海洋晨曦 1L，加購 SKU `48675311223035`，`/cart/add.js` 200、1 件 NT$299。手機由推薦卡進入塑膠保護劑，在視窗選 2L 加購 SKU `47480434557179`，200、1 件 NT$250。
- 手機第一次測試等待外層 modal 容器可見而逾時：該容器子層為 fixed，外層本身沒有可視高度。改等真正的 `[role="dialog"]` 後定點復測通過，沒有修改網站視窗程式或以強制 click 繞過。
- 測試均使用獨立匿名會話，逐筆按已知 variant／line key 清除；最終 item_count 0、total_price 0，瀏覽器已關閉。沒有付款或建立訂單。
- `git diff --check` 通過。Shopify Liquid revision 2：新 snippet、電腦 section 均 VALID；手機整份 section 還有 10 個既有圖片缺尺寸提示。與下載基線對照，這 10 處原本就存在，推薦圖片的 1 處已修復；不宣稱整份舊 section 靜態檢查零錯誤。基線下載不是完整 Theme，另有缺少 snippets/locales 的驗證環境訊息，不能視為遠端缺檔。
- 本輪 agent-browser 曾連線逾時／元素定位失敗，改用隔離 Playwright 完成實機測試，不將工具異常當作站點故障。

瀏覽器輸出及截圖：`C:/Users/chiaz/AppData/Local/Temp/apgo-related-smoke-20260903/`，包括 `results.json`、`add-results.json`（含第一次手機定位逾時）及成功的 `add-mobile-results.json`。本地 fixtures 的 Shopify globals 使用 liquidjs globals 模擬；最初缺 globals 的貨幣格式失敗已修正測試設定，未改共用價格程式。

### 尚未修改：活動頁公司名稱

Admin API 確認頁面 `gid://shopify/Page/133607162107`／`campaign20260803` 已發布，HTML 正文包含 1 處 `【APGO 公司完整登記名稱】`。這是全店共用的 Shopify Page body，不是 Draft 獨立內容。

已向使用者詢問是否允許將該處直接補成「光世代科技有限公司」，同時影響正式站。等待明確授權前不執行 Page mutation，也不以主題字串替換隱藏后台占位文字。若獲准，僅精確替換此 1 處，保留標題、handle、發布狀態、模板及其餘條款。

參考：[Shopify product Liquid 欄位](https://shopify.dev/docs/api/liquid/objects/product)、[PageUpdateInput 的 body 欄位](https://shopify.dev/docs/api/admin-graphql/2026-07/input-objects/PageUpdateInput)。

---

## 第三輪：禮組選單修復與剩餘定點驗證

日期：2026-09-03。使用者同意修正兩個 Draft 禮組選單連結並繼續驗證。最新狀態以本節為準；下方第二輪、第一輪為歷史證據。

### 交付與發布邊界

- Shopify `main-menu-v2`（`gid://shopify/Menu/262517489915`）的「暢銷優惠禮組」及其下「禮組」改為 `https://apgo.tw/collections/bestselling-discount-gift-set`。
- 修改前確認該 Collection 存在；保存完整選單與 Theme roles 基線後，執行經 schema／GraphQL 驗證的 `menuUpdate`。回讀比較只有兩個 `url` 差異，其他標題、順序、階層、資源欄位及正式選單保持不變。
- 基線及回讀：`docs/qa/gift-menu-before-20260903.json`、`docs/qa/gift-menu-after-20260903.json`。
- Draft `162094055675` 仍 UNPUBLISHED，正式 Theme `158931615995` 仍 MAIN。未發布主題、未合併 main，未修改正式菜單。
- 本輪是 Shopify 選單設定更新，不需要重推 Theme 檔。前輪三個購物車 badge 檔已更新 Draft；本地程式、測試、報告仍未 Git commit／push。

### 新增實測證據

使用獨立匿名瀏覽器，不使用使用者的登入或購物車。Playwright 為本輪 agent-browser 連線重啟異常後的替代工具；工具異常與網站故障分開記錄。測試檔：`tests/navigation-smoke.cjs`、`tests/cart-discount-smoke.cjs`。

| 流程 | 結果／證據 |
|---|---|
| 桌機禮組選單 | 真實點擊「禮組」抵達正確 Collection，顯示共 11 項商品 |
| 手機禮組選單 | 「暢銷優惠禮組」在同一側欄展開；UL 為 position:static、transform:none；禮組連結進入正確集合 |
| 手機生活誌選單 | 展開後依序為總覽與五個分類，6 個 href 均正確，沒有 `/tagged/` |
| 手機生活誌總覽 | 標題、5 個分類入口、1 篇真實文章、4 個「文章準備中」；390px 無頁面橫向溢出 |
| 五個獨立 Blog | 均 HTTP 200，無 Liquid error／開發中錯誤頁；居家清潔 1 篇，其餘 4 類正常空狀態 |
| 文章連結 | 從居家清潔列表點入 `laundry-detergent-guide-2026`，標題正確，手機無橫向溢出 |
| 品牌故事 | 390px／1440px 均正常載入舊首頁內容，無頁面橫向溢出 |
| 各國社群媒體 | `/pages/short-videos` 有短影片、長影片及各平台社群內容，並非空白頁；390px／1440px 無頁面橫向溢出 |
| 兩個活動頁 | `/pages/google-review`、`/pages/campaign20260803` 均正常載入且無頁面橫向溢出；僅此不能代表文案、外部連結或所有背景區塊完成驗收 |
| 上述導覽頁 JS | 此次頁面 `pageerror` 收集為空；不等同所有第三方請求都成功，也未逐一播放影片 |
| 購物車頁無效折扣碼 | 390px 實際填入 `APGO-QA-INVALID-20260903-CART` 並點「套用」；`/cart/update.js` 200，applicable:false；UI 顯示「此優惠碼目前無法套用，可能是條件未達成或無法與現有優惠合併」 |
| 無效折扣回滾 | `/cart.js` 仍 1 件 NT$39，discount_codes 回到 []；沒有錯誤折抵或多加商品 |
| 本輪清理 | 用已知 line key 移除測試鍍膜布後，API 確認 item_count 0、total_price 0；測試瀏覽器已關閉 |

折扣測試的 1 件鍍膜布由 API 建立匿名 fixture，只測「輸入→套用→後端判定→回滾→錯誤提示」；不把 fixture 設置算成 UI 加購測試。UI 加購證據見第二輪。錯誤訊息由 locator 讀取，截圖不作該訊息的證據。

執行輸出保留於 `C:/Users/chiaz/AppData/Local/Temp/apgo-nav-smoke-20260903/results.json` 及 `C:/Users/chiaz/AppData/Local/Temp/apgo-cart-discount-smoke-20260903/results.json`。生活誌手機截圖已人工查看；JSON／截圖皆為匿名測試資料，不含購物車 token 或個人收件資訊。

本輪本地檢查：cart-icon 6 項測試通過；journal fixtures 全部通過；`git diff --check` 無空白錯誤。第一次 journal 執行未設定外部 `NODE_PATH`，因找不到 `liquidjs` 未能啟動；指定既有 `apgo-journal-tools-20260903/node_modules` 後成功，沒有新增 Theme 依賴或修改程式來跳過測試。

### 綜合結論及仍需處理的範圍

本次確認的購物主流程、購物車同步、缺貨一般商品、洗衣精促銷與 Shopify 結帳入口，以及禮組／生活誌導覽定點回歸已通過。此為 Draft 的限定範圍驗證，不是「整站零缺陷」或付款成功保證。

- **內容待補**：評價募集活動頁仍顯示 `【APGO 公司完整登記名稱】` 占位文字；應由商家提供正式資料後填入，本輪未擅改。
- **價格統一待辦**：第二輪記錄的洗衣精頁舊推薦區仍可能僅顯示最低價；尚未將該區納入價格範圍修正，不能宣稱每張推薦卡都已統一。
- **未實測**：真實會員登入、購物金／特定有效優惠碼、實際超商門市選取、不同有效地址的所有配送組合、洗衣精全部缺貨組合。
- **未付款下單**：已確認到達 Shopify checkout、商品與金額／優惠／運費顯示及付款選項；未輸入付款資料、未點立即付款、未建立真實訂單，不涵蓋金流跳轉／扣款／訂單通知／履約。
- 本輪沒有公開測試文章或變更既有文章；Blog 排序／分頁／未發布排除的測試資料證據沿用 `tests/journal.test.cjs`，不要把只有 1 篇正式文章的線上列表當作分頁實測。

---

## 第二輪歷史紀錄：已授權的修復與實機復測

日期：2026-09-03。範圍仍為預覽分支 `feature/main-navigation-v2-preview` 和 Draft `162094055675`，不是正式主題驗收／發布。

### 修復交付

- `assets/cart-icon.js` 同時接收 `cart:update` 與 `cart:updated`，對後者使用絕對數量，成對移除事件監聽。不改 cart-shell 的事件名稱、不重新發送刷新事件。
- 可視 badge、action 的 `aria-label`、live-region 數量及 sessionStorage 同步更新。使用既有翻譯文字。
- 保留 product-form 的增量契約；拒絕空白／布林／負數／非整數等無效數量；100 件以上仍保存精確總數。
- 只推送 `assets/cart-icon.js`、`snippets/cart-icon-component.liquid`、`snippets/cart-bubble.liquid` 三檔到 Draft，未更動 merchant 的 Editor 設定。
- 推送前，遠端三檔與本地修改前內容一致。Shopify Liquid 驗證 revision 2：三檔全部 VALID。revision 1 提示既有 `test_id` 缺參數宣告，已補 LiquidDoc。
- 新增 `tests/cart-icon.test.cjs`：修改前 6 項失敗，修改後 6 項通過；既有 journal fixtures 也全部通過。這些是本地契約測試，不是 Shopify 後端測試。

### 實際瀏覽器結果

獨立匿名 QA 會話，桌機 1440×1000、手機 390×844。以下後端結果来自該會話 `/cart.js` 與 Shopify checkout，不以 UI 文案推定成功。

| 流程 | 結果／證據 |
|---|---|
| 首頁規格視窗加購 | 原子琉璃釉鍍膜 SKU `48845759643899`，1 件 NT$1,999；badge、aria-label、live text 都為 1 |
| 购物車加／減／移除 | 1→2→1→0；API 與商品列／header 同步；金額 199900→399800→199900→0 cents |
| 手機购物車加價購 | 鍍膜布 SKU `47358780899579`，1 件 NT$39；header 同步，390px 無頁面橫向溢出 |
| 未登入結帳入口 | 會員提示可選「不登入，直接結帳」，抵達 Shopify `/checkouts/…`，不是空白頁或錯誤頁 |
| 小額訂單 checkout | 桌機／手機均顯示鍍膜布 1 件 NT$39＋宅配 NT$130＝NT$169；付款區顯示 TapPay、JKOPay、ATM |
| 宅配預填 | 臺北市→中正區→100；checkout 實際帶入 city 臺北市、address1 中正區、postalCode 100（未填真實姓名、電話或門牌） |
| 超商區域選項 | 新北市→板橋區→220，城市／行政區連動成功；未進行實際門市選取、超商配送或超商訂單確認 |
| 缺貨一般商品 | 塑膠保護劑 500ml，API available=false；桌機只一個全寬 disabled「已售完」，手機吸底 CTA 也是 disabled「已售完」 |
| 手機有貨規格 | 切到 2L 後恢復購買選項；購買視窗確認加購 SKU `47480434557179`，1 件 NT$250，header 與輔助文字同步 |
| 首頁部分規格折扣 | 塑膠保護劑商品卡显示 `$20 TWD ~ $250 TWD` 和「部分規格優惠」，沒有誤導性的單一划線原價 |
| 洗衣精單包 | 淨心棉花 SKU `48777217114363`，1 包 NT$299，header 為 1 |
| 手機洗衣精買 3 送 1 | 選滿 4 包後才可加購；API 原價 NT$1,196、折扣 NT$299，洗衣精小計 NT$897。與原有測試 2L 合計 5 件 NT$1,147，header 為 5 |
| 桌機洗衣精買 6 送 3 | 清除前組測試商品後，API 9 包、原價 NT$2,691、折扣 NT$897、小計 NT$1,794，header 為 9 |
| 組合 checkout | checkout 保留 9 包、NT$1,794，3 包優惠及滿 NT$999 免運成立；實際應付仍 NT$1,794 |
| 無效折扣 | checkout 輸入 `APGO-QA-INVALID-20260903`，顯示「輸入有效的折扣代碼或禮品卡」與 aria-invalid，沒有錯誤折抵 |
| 生活誌桌機子選單 | 點擊展開，總覽在最前，五個 Blog 分類連結沒有 `/tagged/` |

工具操作注意：固定底部結帳列與 Shopify preview bar 會遮住自動捲到視窗底緣的點擊位置。隱藏 preview bar／把目標捲到視窗中間後使用真實點擊，沒有以 DOM click 繞過遮擋，也未將工具定位錯誤判成購物車同步失敗。移除一次等候逾時後重新定位復核，最終 `/cart/change.js` 200 且 count 0。

### 新發現：主選單禮組仍連全部商品（待授權修復）

在 Draft 展開「所有產品」後，實際 DOM：

| 入口 | 現有 href | 應指向 |
|---|---|---|
| 主選單「暢銷優惠禮組」 | `/collections/all` | `/collections/bestselling-discount-gift-set` |
| 其下「禮組」 | `/collections/all` | `/collections/bestselling-discount-gift-set` |
| 首頁品類禮組／商品列查看全部 | `/collections/bestselling-discount-gift-set`，11 件 | 已正確 |

根因是選單連結設定仍保留舊 fallback，並非加購或 collection 模板錯誤。`sections/header-group.json` 使用 `main-menu-v2`；首頁 `templates/index.json` 兩個對應 collection 已正確。建議只修改 Draft 使用的 `main-menu-v2` 這兩個連結，不修改正式菜單、不發布主題。

依 `verification` 技能「第一個確認故障邊界」停止後續全站檢查，所以本報告不能標成整站全部通過。購物和結帳已通過的定點結果仍有效。

### 未涵蓋／仍待最後驗收

- 修復上述禮組導覽後，補完桌機／手機分類路由與完整導覽回歸、生活誌／品牌故事／社群／活動頁本輪檢查。
- 洗衣精缺貨組合目前沒有修改真實庫存製造測試條件，因此不能宣稱所有缺貨組合都已實機驗證。
- 购物車頁的折扣輸入框此次按鈕曾被固定列遮住，未完成該入口套用；已验证的是 checkout 的無效折扣處理和實際自動組合折扣。
- 未測真實會員登入、購物金／專用優惠碼、實際門市選取、不同有效收件地址的所有配送組合。
- 洗衣精頁推薦商品仍有最低價顯示（如塑膠保護劑 `$20`）；是否要把該舊推薦區也納入統一範圍，需後續核對，不應以首頁價格通過代表每一個推薦卡都已驗收。
- 未按「立即付款」、未建立真實訂單、未進入金流跳轉，因此不驗證扣款、訂單建立、通知或履約。

### 本輪清理與發布邊界

- 各組測試商品按已知 variant／bundle ID 核對，再用 line key 清除；最後 API 確認 item_count 0、total_price 0。
- 無真實姓名、電話、Email、門牌或付款資料；只以公開城市／行政區測試預填。匿名 checkout 會話可能保留在 Shopify，但没有提交訂單。
- 正式 Theme `158931615995` 保持 live；更新目標 `162094055675` 保持 unpublished。沒有發布正式主題、合併 main 或修改正式菜單。
- 更新後重新下載 Draft 三檔逐一比對，全部與本地一致。QA 瀏覽器會話已關閉。
- 程式、測試與本報告保留在本地預覽分支的工作目錄，尚未 Git commit／push；這與已完成的 Shopify Draft 三檔更新是不同狀態。

## 第一輪歷史紀錄（以下描述修復前狀態）

日期：2026-09-03。目標：Draft `162094055675`，預覽分支 `feature/main-navigation-v2-preview`，提交 `38736e4`。

使用者流程：首頁／商品頁選品 → 規格選擇 → 加購 → 购物車調整數量 → 結帳。使用獨立匿名訪客會話，不使用使用者已有购物車，不付款、不提交訂單。

## 結論

尚不能標為全站驗收通過。依 `verification` 技能，在第一個已確認的購物資料與可視 UI 同步問題停下；沒有繼續推進結帳或修改主題程式。

## 已確認通過的部分

| 邊界 | 證據 |
|---|---|
| Draft 身分與首頁 | `Shopify.theme.id = 162094055675`、`role = unpublished`；1440px 頁面無橫向溢出 |
| 正式主題 | 不帶預覽的首頁 HTTP 200，Theme ID 仍為 `158931615995` |
| 商品頁加購 | 大燈還原劑 200ml，`POST /cart/add.js` 200；购物車 1 件、NT$250 |
| 首頁規格視窗 | 原子琉璃釉鍍膜按鈕開啟規格視窗，選項為「300ml+工具一組」，NT$1,999／原價 NT$2,127 |
| 確認加購 | `POST /cart/add.js` 200，實際 SKU `48845759643899`，數量 1、總價 199900 cents |
| 成功回饋 | toast「已加入購物車」；SVG 禮物動畫有 29 個 keyframes、720ms、`cubic-bezier(0.42, 0, 1, 1)` |
| 首頁可視 badge | 加購後數字即時由 0 變 1，與 `/cart.js` 一致 |
| 進入购物車 | 右上角圖示連至 `/cart`，商品規格、數量與 NT$1,999 金額一致 |
| 购物車數量／金額 | 按 `+` 後 `/cart.js` 回傳 item_count 2、quantity 2、total_price 399800；購物車主內容顯示 2 ITEMS／NT$3,998 |

## 問題 1：购物車改數量後，右上角數字不更新

重現：加入一件原子琉璃釉鍍膜 → 點右上角购物車 → 按商品 `+`。

- 後端：2 件，NT$3,998。
- 購物車商品列及總金額：2 件，NT$3,998。
- 右上角 `.cart-bubble__text-count`：仍為 `1`，等待 25 秒仍未更新。
- 不是 API 改數量失敗，也不是金額算錯；故障在「成功回應 → 共用 header」同步邊界。

根因：

- `sections/cart-shell-v2.liquid:1146` 與 `:1163` 發出的是 `cart:updated`，包含 `detail.cart`。
- `assets/cart-icon.js:30` 只監聽 `ThemeEvents.cartUpdate`；`assets/events.js:14` 的值是 `cart:update`。
- 首頁 quick-add 同時處理對應更新，所以首頁加購數字正常；漏掉的是购物車頁既有的另一個事件名稱。

診斷證據：不改後端、不再加商品，只在測試頁暫時發出帶真實 cart 的 `cart:update`；右上角數字立即由 `1` 變成 `2`，與 API 相符。

建議修復：共用 CartIcon 相容 `cart:updated`，以 `cart.item_count` 絕對數同步，並成對解除 listener。不要直接把 cart-shell 的 `cart:updated` 全改成 `cart:update`；該檔 `:1673` 會監聽後者觸發 section refresh，需避免形成刷新迴圈。修復後回歸測試加、減、移除與购物車加價購。

## 問題 2：無障礙數量文字未同步

- 首頁成功加購後，可視數字為 `1`，但 `a.action__cart` 的 `aria-label` 仍為初始 `0`。
- 购物車診斷更新後可視數字為 `2`，`aria-label` 和 `.visually-hidden` 文字仍為 `1`。
- 原因是數字更新只改 `cartBubbleCount`；`snippets/header-actions.liquid:21` 的 aria-label 及其他初始文字沒有同步。
- 建議在共用數量更新時同步可視數字與輔助文字。此問題不改變實際购物車金額，但影響螢幕閱讀器。

## 尚未完成的統一驗證

- 洗衣精模板：單包／買三送一／買六送三，規格與購物車資料一致性。
- 多規格商品價格範圍、部分規格折扣及規格切換。
- 缺貨時大 Sold out 按鈕、手機吸底列，以及不可加購檢查。
- 购物車減量／移除／加價購／折扣、宅配與超商預填驗證。
- 結帳資料及付款頁能否正常開啟；本輪尚未進入結帳，不能宣稱結帳通過。
- 手機完整購物流程及桌機／手機其他全站導覽回歸。

上一輪生活誌定點驗證的通過紀錄仍有效，但不等於這次整站購物驗證已完成。

## 清理與範圍

- 最後可訪問的測試會話只含測試 SKU `48845759643899`；已按 line key 移除，確認 item_count 0、total_price 0。
- 瀏覽器會話已關閉，臨時保存的 QA 瀏覽器狀態檔已移除。
- 第一個匿名測試會話曾因瀏覽器 CLI 的 state 參數重新建立而失去訪問；該會話的殘留匿名购物車無法再次核實清空。之後從新的空购物車重新驗證。兩個會話均未輸入收件人／付款資料、未进入結帳、未提交訂單。
- 本輪沒有修改 Theme 程式、推送 Draft、合併 main、發布正式主題、修改庫存／商品或正式菜單。
- 本文件為本地驗證報告，待使用者確認修復範圍後再修正並重新跑完整流程。
