# APGO生活誌：五個獨立 Blog 與內容總覽

實作日期：2026-09-03。分支：`feature/main-navigation-v2-preview`。

## 結構與資源

不使用 `tagged`，不建立五個普通 Page 存放文章。唯一的新 Page 是生活誌總覽。

| 名稱 | 直接網址 | Shopify ID | 範本 |
|---|---|---|---|
| APGO生活誌總覽 | `/pages/apgo-journal` | Page `135253098747` | `page.apgo-journal` |
| 居家清潔（沿用） | `/blogs/居家清潔` | Blog `105615655163` | `blog.apgo-journal` |
| 鍍膜知識 | `/blogs/鍍膜知識` | Blog `105750888699` | `blog.apgo-journal` |
| 洗車教學 | `/blogs/洗車教學` | Blog `105750921467` | `blog.apgo-journal` |
| 損傷處理 | `/blogs/損傷處理` | Blog `105750954235` | `blog.apgo-journal` |
| 行車安全 | `/blogs/行車安全` | Blog `105750987003` | `blog.apgo-journal` |

建立前已逐一查 handle，沒有重複建立。四個新 Blog 關閉留言；居家清潔只更新列表範本，未改其他 Blog 設定。

總覽依表格順序呈現五個入口與五個區域；每類最多顯示最新兩篇已發布文章、封面（有設定時）、標題、摘要與文章連結，並提供「查看全部」。沒有獨立封面的文章仍可正常顯示文字卡，不生成假封面。摘要優先使用文章摘要，未填則擷取內文純文字。

分類列表每頁 12 篇，沿用 Shopify `blog.articles` 的已發布文章集合及發布時間新到舊順序，不另行反轉或按標籤篩選。空分類顯示「文章準備中」，不是 404。

## 後台人員如何維護

### 新增、編輯文章

1. 開啟 [Blog posts 文章管理](https://admin.shopify.com/store/a9x0eh-ws/articles)。
2. 新增文章，填寫標題，在富文本編輯器編輯文字、圖片與影片嵌入內容。
3. 「Blog」選擇上述五個分類其中之一；不需要添加分類標籤。
4. 設定文章封面與摘要。封面未填時卡片只顯示文字，不會從內文任意抓圖。
5. 在搜尋引擎預覽區編輯 SEO 標題、描述與網址。已發布文章不要隨意改 handle。
6. 儲存並設為可見／發布。總覽與列表會自動更新，不需改程式。
7. 隱藏／未到發布時間的文章不會進入公開文章集合。排序依發布時間，不依最後編輯時間。

[Blog 管理入口](https://admin.shopify.com/store/a9x0eh-ws/blogs)。文章繼續使用既有文章範本；本次沒有修改 `templates/article*` 或既有文章 sections。

### 影片嵌入

既有富文本編輯器可放影片嵌入碼。為避免手機上固定寬度的播放器溢出，影片碼使用自適應尺寸，例如在 HTML 模式加入以下結構，將 `影片供應商的嵌入網址` 換成實際 embed URL：

```html
<iframe
  src="影片供應商的嵌入網址"
  title="影片標題"
  loading="lazy"
  allowfullscreen
  style="display:block;width:100%;height:auto;aspect-ratio:16/9;border:0"
></iframe>
```

直式影片可改成 `aspect-ratio:9/16`。本次只驗證嵌入區域的響應式布局，沒有驗證特定影片供應商的播放權限、自動播放或追蹤同意行為。

### Theme Editor

1. 開啟 [指定 Draft 的 Editor](https://admin.shopify.com/store/a9x0eh-ws/themes/162094055675/editor?previewPath=%2Fpages%2Fapgo-journal)。
2. 選擇 Pages → `apgo-journal`，編輯「APGO · 生活誌總覽」標題與簡介。
3. 五個「文章分類」block 可各自選擇 Blog、修改分類簡介；預設順序即本文件表格順序。
4. 分類頁選 Blogs → `apgo-journal`，共用「APGO · 生活誌分類」section，總覽頁綁定 `apgo-journal`。

Blog／Page 資源選擇器是物件綁定，不是將網址填進文章內容。改總覽 Blog 綁定不會自動改 Navigation；若日後新增第六類，需另行調整結構。

## 菜單與發布邊界

- 只更新 Draft 使用的 `main-menu-v2`（Menu `262517489915`）。
- APGO生活誌頂層保持点击展開，子項依序為：生活誌總覽、居家清潔、鍍膜知識、洗車教學、損傷處理、行車安全。
- 子項使用 PAGE／BLOG 資源綁定，沒有 `tagged`，原有五個分类的 MenuItem ID 保留；只新增總覽子項。
- Draft 菜單其他項目、正式 `main-menu` 及所有其他菜單保持原樣。
- 唯一上傳目標：未發布 Theme `162094055675`。未合併 `main`，未發布或上傳正式 Theme `158931615995`。
- Blog、Page 是全商店資源，不屬於某個 Theme；直接網址已公開可訪問，但沒有掛上正式菜單入口。這不是私密訪問控制，也不保證搜尋引擎不會發現。
- 新列表／總覽設計只存在 Draft。正式 Theme 沒有這兩個專用範本，因此目前直接訪問非預覽網址會使用既有預設範本；已確認 HTTP 200。居家清潔在正式 Theme 仍顯示原文章列表。
- 總覽 Page 的內文保留簡介與五個分類直連作為預設 Page 範本的基本內容；Draft 專用 section 使用 Editor 設定，並非靠 Page 內文維護文章卡片。

### 不動的舊內容

「汽車美容知識庫」Blog `101587321083` 的 15 篇已發布文章、「新聞」Blog `98726936827` 的 4 篇未發布文章保留原位，不迁移、不更改 handle、發布狀態或範本，也不自動混入五個新分類。

修改前後資料記錄：`docs/data/journal-baseline-20260903.json`、`docs/data/journal-after-20260903.json`，含文章 ID、handle、updatedAt、發布狀態與菜單樹。所有原有文章（含居家清潔 1 篇）均完全一致。

## 實作檔案

- `sections/apgo-journal-hub.liquid`：總覽、五類入口與最新兩篇。
- `sections/apgo-journal-blog.liquid`：分類列表、12 篇分頁與空狀態。
- `snippets/apgo-journal-card.liquid`：共用文章卡。
- `snippets/apgo-journal-styles.liquid`：僅作用於 `.apgo-journal` 的樣式。
- `templates/page.apgo-journal.json`、`templates/blog.apgo-journal.json`：Editor 初始綁定。
- `locales/en.default.json`、`locales/zh-TW.json`：新增 `journal` 文案，保留其他翻譯。
- `tests/journal.test.cjs`：本地資料契約與 Liquid 渲染測試，不連寫入 API。

部署使用 `theme push --theme 162094055675 --nodelete --only ...`，只上傳這八個 Theme 檔案。上傳前已比對兩個翻譯檔與 Draft，沒有獨立的後台翻譯變更需要合併。

## 定點驗證記錄

- [x] 八個 Theme 檔案通過 Shopify Liquid／JSON／schema 驗證；`git diff --check` 通過。
- [x] 總覽及五個 Blog 均 HTTP 200、使用指定 Draft 專用範本、無 Liquid error、無無效 `tagged` 菜單链接。
- [x] 居家清潔實際顯示既有的 `laundry-detergent-guide-2026` 文章；總覽 1 張實際文章卡、另外四類顯示空狀態。
- [x] 桌機 1440px：點擊 APGO生活誌留在原頁並展開六個子項。
- [x] 手機 390px：生活誌在原側欄向下展開，六個子項順序、目的地正確。
- [x] 總覽五入口桌機五欄、手機兩欄；文章卡桌機兩欄、手機單欄，沒有横向溢出。
- [x] 本地測試資料：最新兩篇、五個 Blog 獨立綁定、未發布與未到期文章排除、單篇／空分類、13 篇分成 12＋1、上一頁／下一頁／目前頁、無重複文章、缺封面、文字跳脫。
- [x] 分頁目前頁以數字比較（Shopify `part.title` 為字串），避免頁碼高亮失效。
- [x] 既有文章三張內文圖片桌機、手機均成功載入且不溢出；文章 URL、內容與範本未改。
- [x] 用瀏覽器暫存 DOM 資料檢查卡片封面與自適應 iframe／video 布局：手機播放器 350×196.875、桌機 760×427.5；卡片封面維持 16:9。測完重新載入清除，沒有儲存任何測試文章。
- [x] 修改前後舊文章與正式菜單快照相同；Draft 菜單非生活誌項目相同。
- [x] Theme 上傳後重新拉取，八個檔案內容與本地一致（JSON 比較忽略 Shopify 自動格式化）。

本地測試明確模擬 Shopify 的已發布文章集合與分页切片，並渲染實際 section／snippet；它不是公開測試文章的端到端排序測試。真實商店目前只有居家清潔一篇文章，所以 2 篇上限與 12 篇分頁邊界使用本地 fixture 驗證。

重跑本地測試：外部工具目錄安裝 `liquidjs`，設定 `NODE_PATH` 指向其 `node_modules` 後執行 `node tests/journal.test.cjs`。不用把依賴加入 Theme。

整站購物、加購與結帳冒煙測試依原約定留待所有修改完成後統一執行；本次未下單。

## 交付入口

- [Draft 生活誌總覽](https://apgo.tw/pages/apgo-journal?preview_theme_id=162094055675)
- [Draft 居家清潔](https://apgo.tw/blogs/%E5%B1%85%E5%AE%B6%E6%B8%85%E6%BD%94?preview_theme_id=162094055675)
- [后台文章管理](https://admin.shopify.com/store/a9x0eh-ws/articles)
- [后台 Blog 管理](https://admin.shopify.com/store/a9x0eh-ws/blogs)

下一步由營運新增四個空分類的正式文章與封面即可；不需要先搬動舊知識庫內容。
