# CodeX 项目交接

更新日期：2026-07-17（Asia/Shanghai）

## 1. 项目基本信息

- 仓库：`DavidSun-11/my-test-project`
- 分支：`main`
- 交接基线 HEAD / `origin/main`：`a0df90548c511860c6cae124eab44a635c79c09f`（创建本文档前一致、工作区干净、无本地领先提交）
- 部署：GitHub Pages 静态站；页面入口位于仓库根目录。未发现已跟踪的构建配置或 GitHub Actions Pages workflow；Pages 后台实际 Source 设置待确认。
- 技术栈：原生 HTML、内嵌/本地 CSS、原生 JavaScript、Supabase JS（本地 vendor）、Open-Meteo、Live2D / OhMyLive2D、本地图片和音频资源。

## 2. 当前项目结构

- 主要页面：`index.html` 首页；`price.html` 价格与评价；`my.html` 我的星湖；`redeem.html` 积分兑换；`order.html` 服务预约；`admin.html` 管理后台；`boss-register.html` 老板注册/登录；`boss-reviews*.html` 评价；`contact*.html` 支付解锁；`suggest.html` 建议；`about.html`、`games.html`、咨询页为补充入口。
- 主要脚本：`assets/supabase-client.js` 为 Supabase 客户端；`assets/my.js`、`redeem.js`、`order.js`、`admin.js`、`boss-register.js`、`price-reviews.js` 分别服务核心页面；共享样式主要在页面内，另有 `assets/consult-pages.css`、`assets/music-player.css`。
- Live2D：`assets/live2d-loader.js` → `assets/live2d-interactions.js` → `assets/live2d-interactions-lazy.js`；拖拽在 `assets/live2d-drag.js`；运行时与模型资源在 `live2d/`，本地甘雨模型在 `live2d/models/ganyu/`。
- Supabase：配置/客户端在 `assets/supabase-config.js`、`assets/supabase-client.js`；SQL、RPC、RLS 说明集中在 `SUPABASE_SETUP.md`。
- 规范：`AGENTS.md`、`.codex/skills/junxue-codex-workflow/SKILL.md`；UI 任务还读取 `DESIGN_SYSTEM.md`、`UI_COMPONENT_RULES.md`、`.codex/skills/junxue-ui-polish/SKILL.md`。

## 3. 已完成的重要功能

- 用户可隐藏已拒绝兑换申请：`a0df905`。前端和第 19 节 SQL 已提交；线上 SQL 是否已执行待确认。
- Live2D 天气改为正确区分 Open-Meteo current/daily，并加入城市切换竞态保护：`a1ae065`。
- 管理员后台企业化视觉与真实账号统计/操作列表：`ebce4f7`。
- 服务预约页独立背景层、桌面玻璃结构与手机单列修复：`eedd61c`、`2c0276e`。
- 评分竞猜历史归档和服务端分页：`8d206e2`。
- 我的星湖管理员消息中心、头像压缩上传与云端安全清理：`b37e8b3`、`d99de8a`。
- 价格页右侧月夜玻璃区域优化：`68a7612`。

## 4. 当前正在进行的任务

- 当前网站功能任务：无。
- 最新完成项：兑换申请用户侧归档，涉及 `redeem.html`、`assets/redeem.js`、`SUPABASE_SETUP.md`，已 commit 并 push（`a0df905`）。
- 剩余：在 Supabase SQL Editor 手动执行第 19 节 SQL，并由用户在 GitHub Pages 验收。

## 5. 待处理和待验收事项

- 已知已确认代码 Bug：待确认；仓库未记录未解决 Bug 清单。
- 近期 UI 手动验收：服务预约页桌面/手机背景和布局、价格页右侧月亮玻璃区、管理员后台企业化布局。
- Supabase 部署状态不保存在仓库：第 15、17、18、19 节是否已在线执行均待确认；第 19 节是当前最直接需要执行的 SQL。
- 缓存：页面通过 `?v=` 加载 JS；改动 Live2D 时必须同步 loader、interactions、lazy 和直接引用 loader 的页面版本。GitHub Pages 验收时使用强制刷新。

## 6. 高风险模块

- Live2D：菜单分组、弹窗定位、移动端静态入口、点击逻辑和三段加载链高度耦合。
- Supabase：Auth、RLS、SECURITY DEFINER RPC、脱敏邮箱、`user_id`/UUID 不泄露边界必须保留。
- 积分与评分竞猜：积分增减、pending 占用、奖池结算、积分流水不可随意重构或物理删除。
- 管理员：前端隐藏不是安全边界；权限必须继续由现有管理员表/RPC复核。
- 手机端：重点检查 Grid/Flex 的 `min-width`、固定宽度、弹窗与横向溢出。
- 素材/同步：先执行安全同步检查；用户指定的新文件必须先确认 `origin/main`，不得用旧素材替代。

## 7. 新 CodeX 接手检查

1. 执行 `git status --short`、`git branch --show-current`、`git fetch origin --prune`、`git rev-parse HEAD`、`git rev-parse origin/main`；仅在干净且可 fast-forward 时 `git pull --ff-only origin main`。
2. 读取 `AGENTS.md`、存在时的 `PROJECT_CONTEXT.md`、工作流 Skill；按任务补读设计规范或 `SUPABASE_SETUP.md`。
3. 检查未提交改动、`git status -sb` 的 ahead/behind 状态，以及是否有未 push 的本地提交。
4. 用户声称远程已有文件时，先 `git fetch origin --prune` 和 `git ls-tree -r --name-only origin/main -- <路径>`。
5. 涉及 Supabase 时先确认相关 SQL 节是否已由用户在 SQL Editor 执行；当前优先确认第 19 节。

## 8. 下一步建议

执行 `SUPABASE_SETUP.md` 第 19 节 SQL，然后用已拒绝兑换申请验证用户隐藏、管理员仍可查看，以及刷新失败提示行为。
