# 麦麦不纠结

**预算你定，吃什么交给它。** 选预算或跳过，一次随机搭一顿主食、小食和饮品，解决“不知道吃什么”的选择困难。

![网页演示](docs/images/web-preview.png)

## 可以做什么

- 20/30/40/50 元快捷预算，自定义金额，也可以跳过预算。
- 每次只给一份搭配；换一份时避开上一份，喜欢的单品可以锁定。
- 演示模式无需账户；实时模式按门店查询官方菜单、套餐默认配置和最终应付。
- 套餐按整体计算，支持确认后的替换组合；固定套餐不能单独锁定子项。
- 复制点餐清单；预算不足或查询失败时明确反馈。
- 提供可独立安装的 [Skill](skills/mcd-bujiejie/SKILL.md)，支持在聊天中完成同一流程。

适合每次打开菜单都拿不定主意、想限定一顿预算的单人用餐者。当前只支持到店取餐的搭配与试算。

## 本地运行

需要 Node.js >=22.9（已在 Node 25.9 实测）。

```bash
npm ci
npm start
```

打开 http://127.0.0.1:3187 。不配置凭证也能完整体验演示。

### 连接真实菜单

从 [麦当劳官方平台](https://open.mcd.cn/mcp) 申请自己的 MCP Token，将 `.env.example` 复制为本机 `.env`，只在 `.env` 填入 `MCD_MCP_TOKEN`。重启 `npm start`，切换“实时菜单”，输入自己的城市和地标并选择门店。

凭证只在服务端读取，`.env` 已忽略；网页不会收到 Token。不要使用作者账户为公众提供共享代理。本机服务只监听 `127.0.0.1`。

```bash
npm run mcp:inspect
```

此命令读取实际工具 schema，只把发现结果保存在忽略的 `.local/` 中。接口定义变化时程序停止推荐，需要重新核验适配。

## 使用示例

网页：选“30 元” → “帮我搭一餐” → 锁定喜欢的饮品 → “换一份”。演示价格不代表实际售价。

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

不自动创建订单、领券、兑换或购买会员卡；本工具不宣称全局最低价或营养最优解。网页仅保存选中门店的编号和名称，不保存输入的原始位置。可用券只用于适用商品的试算，失败时不声称优惠已生效。

## 参赛与来源

参赛材料包含本 README、原样 [CONTEST_DECLARATION.md](CONTEST_DECLARATION.md)、[MCP_INTEGRATION.md](MCP_INTEGRATION.md)、环境变量配置示例及可运行源代码。开发使用 Codex，没有生成 WorkBuddy 开发记录。

- [官方比赛](https://github.com/M-China/mcd-developer-innovation-challenge)
- [完整规则](https://github.com/M-China/mcd-developer-innovation-challenge/blob/main/activityGuidelines.md)
- [接入协议](https://open.mcd.cn/mcp/doc)
- [MCP 使用指南](https://github.com/M-China/mcd-mcp-server)

独立开发的参赛作品，非麦当劳官方产品。原创代码和插画按 MIT 授权；官方声明、商标及第三方材料遵循各自权利与条款，参见 [NOTICE.md](NOTICE.md)。
