# 麦麦不纠结 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task in the current session.

**Goal:** 实现可运行的随机搭配网页、独立 Skill、严格预算规则及可验证的官方 MCP 接入边界。
**Architecture:** 原生网页调用本机 Node API，演示源与 MCP 源共享纯函数搭配引擎。真实源以官方 SDK 发现 schema，经本地经核验适配器读取菜单和价格；没有授权实调不声明接入完成。
**Tech Stack:** Node >=22.9，原生 ES modules，官方 SDK 1.32.1，Ajv 8.20.0，Playwright 1.64.1。
**Spec:** docs/requirements.md（2026-10-15 用户已确认）。

## Global Constraints

- 一人餐固定包含主食、小食、饮品各一份；可用完整套餐，不能重复计算。
- 预算可跳过；所有计算使用整数分；实际应付不超过预算。
- 演示与实时明确标识；没有凭证、适配或报价时不伪造实时结果。
- 仅本机监听；凭证只在服务端环境变量中；只调用五个白名单只读工具。
- 公开声明原样保留；不生成 WorkBuddy 使用记录。

## Review Focus

- 报价上浮或缺失：不能把基础价当实际应付。
- 锁定项或旧请求：条件变更后不能保留过期报价。
- 优惠导致基础价高于预算：不能过早剔除潜在可行组合。
- schema 变化或意外工具：中止并给出安全错误。
- 跨站访问、路径遍历和错误正文：不泄露凭证或本地文件。

### Task 1: 纯函数搭配引擎

**Files:** src/domain/engine.mjs, src/providers/demo.mjs, tests/engine.test.mjs
**Interfaces:** parseBudget(string|null) -> integer|null; buildCandidates(catalog) -> Candidate[]; recommend({catalog,budget,lockedIds,previousKey,quote?}) -> Promise<Result>。

- [x] 写测试并运行 `node --test tests/engine.test.mjs`，先看到缺少模块的失败。
- [x] 实现金额解析、完整组合、锁定和去重；实时报价最多 12 次，检查最终总价。
- [x] 以 `assert.equal(parseBudget('20.01'),2001)`、`assert.rejects(()=>recommend({catalog,budget:'1'}))`、报价上浮及降价的测试验证约束。
- [x] 全部测试通过后提交 `feat: add constrained random meal engine`。

Expected: 任意随机结果结构完整且在预算内；单一组合返回 unchanged；报价失败不伪装成预算不可行。

### Task 2: 本机服务和 MCP 边界

**Files:** src/providers/mcp.mjs, src/server/app.mjs, src/server/start.mjs, scripts/inspect-mcp.mjs, tests/server.test.mjs, tests/mcp.test.mjs
**Interfaces:** createApp({liveProvider?}) -> http.Server; MCPProvider({token,adapterPath}) exposes status/findStores/catalog/quote; gateway exposes listTools/call/close。

- [x] 写授权和白名单测试，先运行失败。
- [x] 实现 SDK 连接、schema 校验、脱敏错误、schema 指纹和必须实调的适配契约。
- [x] 实现 status/stores/recommend API，仅允许已知静态文件，校验 Host/Origin/JSON 大小。
- [x] 测试 `fetch('/api/recommend',{method:'POST',body:JSON.stringify({mode:'demo',budget:'30'})})` 返回完整搭配；跨站访问 403，缺少凭证 503；mock 401/429、错误报价和 schema 变化被拒绝。
- [x] 运行 `node --test tests/*.test.mjs` 后提交服务实现。

Expected: 演示无需 Token；实时没有适配时明确不可用；写工具永远不能调用。

### Task 3: 网页、Skill 与参赛材料

**Files:** web/*, skills/mcd-bujiejie/*, scripts/sync-skill.mjs, tests/ui.spec.mjs, README.md, MCP_INTEGRATION.md, CONTEST_DECLARATION.md, mcp-config.example.json, docs/verification.md
**Interfaces:** 浏览器消费 Task 2 API；Skill 打包 Task 1 引擎，先生成候选再由官方 MCP 试算。

- [x] 写条件变更及陈旧请求的状态测试并运行失败，再实现前端状态模块。
- [x] 实现预算、跳过、抽取、重抽、锁定、复制及实时门店表单，支持窄屏和减少动画。
- [x] Playwright 验证预算 30 元、跳过、全锁定、低预算、非法输入、复制、延迟响应被丢弃，桌面/手机无溢出，并截图。
- [x] 打包独立 Skill，核验引擎副本一致；下载并逐字核验官方声明，记录未完成的实调和报名条件。
- [x] 运行 `npm test` 和 `npm run test:ui`，提交并由独立审查者检查最终变更。

Expected: 本机打开即用，真实与演示不混淆；材料完整但不声称尚未发生的实调、公开发布或报名成功。
