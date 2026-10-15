# 麦麦不纠结

**预算你定，吃什么交给它。** 选预算或跳过，一次随机搭一顿主食、小食和饮品，解决“不知道吃什么”的选择困难。

**[打开公开体验版](https://sognotore.github.io/mcd-bujiejie/)**：可把链接发给朋友或发到微信群，无需安装。公开版使用演示菜单和价格，支持快乐餐、减脂餐、健身餐、预算、随机搭配、锁定和重抽；右上角“真实点餐”可进入已授权的临时个人账户服务，每位使用者须连接自己的 MCP Token。临时入口需开发电脑保持运行。

已获[官方成功参赛确认](https://github.com/M-China/mcd-developer-innovation-challenge/issues/742#issuecomment-6187376552)。喜欢这个工具，欢迎点击仓库右上角 **Star** 支持；比赛按项目公开 Star 数排名。

![网页演示](docs/images/web-preview.png)

## 可以做什么

- 快乐餐自由随机；减脂餐约 400–600 大卡且蛋白质至少 25g；健身餐约 550–800 大卡且蛋白质至少 35g。这是产品筛选参考，不是个人饮食处方。
- 营养按麦当劳中国大陆官网标准份量合计，参考数据版本 2025-04；结果可展开来源。实际门店组合不足时收为两类，未知或不明特调不参与营养筛选。详见 [营养规则与数据来源](docs/nutrition.md)。
- 20/30/40/50 元快捷预算，自定义金额，也可以跳过预算。
- 每次只给一份搭配；换一份时避开上一份，喜欢的单品可以锁定。
- 演示模式无需账户；实时模式按门店查询官方菜单、套餐默认配置和最终应付。
- 套餐按整体计算，支持确认后的替换组合；固定套餐不能单独锁定子项。
- 首屏整合生成插画、预算和开饭签按钮，约一秒揭晓动效；支持减少动态效果设置。
- 实时模式可核对最新价格及官方取餐方式，主动确认后创建待支付订单，再前往官方付款；演示模式不下单。
- 复制点餐清单；预算不足或查询失败时明确反馈。
- 提供可独立安装的 [Skill](skills/mcd-bujiejie/SKILL.md)，支持在聊天中完成同一流程。

适合每次打开菜单都拿不定主意、想限定一顿预算的单人用餐者。当前就餐场景限定到店取餐，包含搭配、试算和用户确认后的下单预览。

## 本地运行

需要 Node.js >=22.9（已在 Node 25.9 实测）。

```bash
npm ci
npm start
```

打开 http://127.0.0.1:3187 。不配置凭证也能完整体验演示。

### 连接真实菜单

从 [麦当劳官方平台](https://open.mcd.cn/mcp) 申请自己的 MCP Token，将 `.env.example` 复制为本机 `.env`，只在 `.env` 填入 `MCD_MCP_TOKEN`。重启 `npm start`，切换“实时点餐”，输入自己的城市和地标并选择门店。

凭证只在服务端读取，`.env` 已忽略；网页不会收到 Token。不要使用作者账户为公众提供共享代理。本机服务只监听 `127.0.0.1`。

```bash
npm run mcp:inspect
```

此命令读取实际工具 schema，只把发现结果保存在忽略的 `.local/` 中。接口定义变化时程序停止推荐，需要重新核验适配。

## 公网体验版

```bash
npm run build:pages
npm run check:pages
```

`dist/` 只包含白名单网页文件和 11 张生成示意图，在浏览器内完成演示搭配，不发送 MCP 或后端 API 请求。部署与验证见 [公开体验版说明](docs/public-demo.md)。

## 个人账户点餐预览

本机实时模式支持“就吃这份，去下单” → 核对门店、最新金额和取餐方式 → “确认下单，去付款” → 官方付款入口。真实下单与支付需用户主动操作；当前已实测到官方确认页，订单创建与支付测试使用模拟响应，尚未进行真实支付。

面向朋友的服务由 `src/server/public-start.mjs` 提供：每人连接自己的 MCP Token，服务端内存会话有效期 30 分钟，网页不保存 Token。它不加载作者 `.env`。需要 HTTPS 反向代理，并设置 `MCD_PUBLIC_ORIGIN` 后运行 `node src/server/public-start.mjs`。临时隧道需电脑持续运行；静态 Pages 演示入口本身没有后端。

完整能力与边界见 [点餐衔接说明](docs/order-handoff.md)。

## 使用示例

网页：选“30 元” → “抽个好吃的” → 锁定喜欢的饮品 → “换一份”。演示价格不代表实际售价。

Skill：

- “30 元以内，帮我随机搭一顿麦当劳。”
- “不设预算，随便搭一餐。”
- “饮品保留，其他换一份。”

### 安装 Skill

将完整 `skills/mcd-bujiejie` 文件夹导入支持 Skills 的客户端。在 Codex 中可复制到自己的 `~/.codex/skills/mcd-bujiejie`，重启或刷新技能列表；使用前在该客户端连接自己的官方麦当劳 MCP。配置格式示例见 [mcp-config.example.json](mcp-config.example.json)，不同客户端的环境变量配置方式可能不同。

Skill 内的脚本只需要 Node，已包含搭配引擎，不依赖本项目其他目录。脚本先生成待核价候选，必须调用官方 `calculate-price` 核验后才输出真实搭配。

## 验证

```bash
npm test
npx playwright install chromium
npm run test:ui
```

业务测试覆盖整数分金额、随机组合、预算上限、锁定、重复、套餐、最终报价变化、schema 变化与本机访问边界；浏览器测试覆盖主要交互、旧请求、手机布局及复制失败。

[验证记录](docs/verification.md) 区分自动化测试与真实 MCP 调用。真实门店、菜单、餐品详情、优惠券查询及计价已于 2026-10-15 实调通过；这不代表所有门店、时段及优惠条件都已验证。

## 项目结构

- `web/`：响应式网页和原创建餐插画。
- `src/domain/`：网页、服务端和 Skill 共用的搭配规则。
- `src/providers/`：演示源、官方 MCP 网关及实际字段适配。
- `src/server/`：本机 API，不提供任意工具转发。
- `skills/mcd-bujiejie/`：独立 Skill。
- `tests/`：业务及浏览器测试。

## 数据与边界

预算是最终应付的上限，跳过预算仍然只搭一人餐。菜单价不是应付价，最终以官方试算确认；单次最多试算 12 份，超过次数只表示暂未找到。没有门店、缺少必要字段或接口失败时不伪造结果、不悄悄切换演示。

仅在实时模式中，用户核对并主动确认后才创建待支付订单；不自动领券、兑换或购买会员卡；本工具不宣称全局最低价或营养最优解。网页仅保存选中门店的编号和名称，不保存输入的原始位置。可用券只用于适用商品的试算，失败时不声称优惠已生效。

## 参赛与来源

参赛材料包含本 README、原样 [CONTEST_DECLARATION.md](CONTEST_DECLARATION.md)、[MCP_INTEGRATION.md](MCP_INTEGRATION.md)、环境变量配置示例及可运行源代码。开发使用 Codex，没有生成 WorkBuddy 开发记录。

- [官方比赛](https://github.com/M-China/mcd-developer-innovation-challenge)
- [完整规则](https://github.com/M-China/mcd-developer-innovation-challenge/blob/main/activityGuidelines.md)
- [接入协议](https://open.mcd.cn/mcp/doc)
- [MCP 使用指南](https://github.com/M-China/mcd-mcp-server)

独立开发的参赛作品，非麦当劳官方产品。本项目代码及自有插画资产按 MIT 授权；官方声明、商标及第三方材料遵循各自权利与条款，参见 [NOTICE.md](NOTICE.md)。
