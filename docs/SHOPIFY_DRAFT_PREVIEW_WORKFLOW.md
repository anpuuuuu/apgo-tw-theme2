# Shopify Draft Theme 预览流程

## 目的

所有主题修改先放在独立 Git 分支，并连接到 Shopify Draft Theme 进行预览。只有在预览通过且收到明确的「上线」指示后，才把分支合并到 `main`。这样可以避免未经确认的代码直接影响 Active theme。

本次验证项目：购物车数量即时更新修复。

## 本次执行资料

| 项目 | 内容 |
| --- | --- |
| 基准分支 | `main` |
| 基准 commit | `9f0784d` |
| 功能 commit | `ac7414f` |
| Preview 分支 | `preview/cart-count-fix-20260901` |
| Shopify Draft Theme | 待建立 |
| Preview URL | 待建立 |
| Active theme | 不修改、不发布 |

> 说明：购物车修复已经在先前操作中进入 `main`。本次 Draft Theme 用于建立并验证以后应采用的分支预览流程；后续新功能必须在合并 `main` 之前走完本流程。

## 1. 建立隔离分支

执行前必须确认工作区干净，而且本地 `main` 与 `origin/main` 一致。

```powershell
git switch main
git fetch origin
git status --short --branch
git rev-list --left-right --count origin/main...main
git switch -c preview/<功能名称>-<日期>
```

检查标准：

- 工作区没有未提交文件。
- `origin/main...main` 的结果为 `0 0`。
- 新分支从当前 `main` 建立。

## 2. 完成功能与代码审查

购物车数量问题的根本原因是：Horizon Header 读取 `cart:update` 的 `detail.data.itemCount`，但部分 APGO 自定义购买流程只发送 `detail.cart` 或空事件，导致 Header 把未知数量误判为 0。

本次修复标准：

- 自定义购买流程发送完整的 `cart:update` 数据。
- `detail.data.itemCount` 使用 Shopify 返回的 `cart.item_count`。
- 同时保留 `detail.cart`，兼容既有 APGO 区块。
- 移除会再次把数量清成 0 的重复 `CartAddEvent`。
- Header 收到没有有效数量的事件时保持当前数量，不得误报为 0。
- 购物车内容组件能够安全忽略不完整的第三方事件。

## 3. 执行本地检查

至少执行以下检查：

```powershell
git diff --check
node --check assets/apgo-bundle.js
node --check assets/apgo-pdp.js
node --check assets/cart-icon.js
node --check assets/component-cart-items.js
```

购物车功能还必须验证：

- 所有自定义 `cart:update` 来源都有 `itemCount`，或会先读取真实购物车。
- 标准事件能设定绝对数量。
- Shopify 原生 Product Form 事件仍以新增数量累加。
- 空事件不会清空 Header 徽章。
- 加入购物车成功后，Shopify 实际 `item_count` 与 Header 显示一致。

## 4. 提交并推送 Preview 分支

```powershell
git add -- <本次文件>
git commit -m "<清楚描述本次修改>"
git push -u origin preview/<功能名称>-<日期>
```

推送后检查：

```powershell
git status --short --branch
git rev-parse HEAD
git rev-parse origin/preview/<功能名称>-<日期>
```

两个 commit 必须完全一致。

## 5. 建立 Shopify Draft Theme

在 Shopify Admin 执行：

1. 打开 `Online Store → Themes`。
2. 选择 `Import`，从 GitHub 导入主题。
3. Repository 选择 `anpuuuuu/apgo-tw-theme2`。
4. Branch 选择本次 Preview 分支。
5. 建立为 Draft Theme；不得点击 `Publish`。
6. 等待 GitHub integration 日志显示所有文件成功、0 failed。
7. 记录 Draft Theme 名称、Theme ID 与 Preview URL。

如果该分支已经连接 Draft Theme，更新代码时只需继续推送同一分支，不要重复建立主题。

## 6. Preview 冒烟测试

使用带有 `preview_theme_id` 的 Preview URL 测试，不使用 Active theme URL 代替。

桌面与手机至少检查：

1. 商品页可以正常加载。
2. 选择规格、组合与香氛正常。
3. 加入购物车按钮可用。
4. 加购请求成功且没有重复加入。
5. Header 数量不刷新页面就立即增加。
6. Header 数量与 Shopify 实际 `item_count` 一致。
7. 购物车页面可以调整数量、删除商品并进入结账。
8. 售罄商品仍维持单一大型「已售完」按钮。

测试购物车应使用隔离的浏览器会话，不建立真实订单。

## 7. 预览通过后的上线流程

只有收到明确的「上线」指示后才执行：

1. `git fetch origin`，确认 `main` 是否有 Shopify 后台产生的新提交。
2. 将最新 `origin/main` 合并到 Preview 分支并重新检查。
3. 把 Preview 分支合并到 `main`。
4. 推送 `main`。
5. 查看 Active theme 的 GitHub integration 日志，确认 `0 failed`。
6. 确认 CDN 已提供新资源，再做一次线上冒烟测试。

如果 Preview 未通过，只修改 Preview 分支和 Draft Theme，不得动 `main` 或 Active theme。

## 8. 完成标准

- Preview 分支已推送且本地、远端同步。
- Shopify Draft Theme 已建立并连接正确分支。
- Preview URL 可打开。
- 桌面与手机冒烟测试结果已记录。
- Active theme 在用户批准前没有被发布或替换。

## 本次执行记录

- [x] `main` 工作区干净。
- [x] 本地 `main` 与 `origin/main` 为 `0 0`。
- [x] 建立 `preview/cart-count-fix-20260901`。
- [x] 本地检查完成：JS 语法、`git diff --check`、购物车事件来源与重复事件审计均通过。
- [ ] Preview 分支已推送。
- [ ] Shopify Draft Theme 已建立。
- [ ] Preview URL 已确认。
- [ ] Preview 冒烟测试通过。
