# 麦当劳 MCP 实际接入

## 服务与协议

- 官方 Server：`https://mcp.mcd.cn`
- 协议：Streamable HTTP，官方 TypeScript SDK `@modelcontextprotocol/sdk@1.32.1`。
- 鉴权：服务端环境变量 `MCD_MCP_TOKEN` 进入 Authorization Bearer 请求头。仓库不包含真实凭证。
- 主入口：`src/providers/mcp.mjs`、`src/providers/mcd-adapter.mjs`。
- 协议来源：https://open.mcd.cn/mcp/doc ，核验时间 2026-10-15。

## 已实际调用的工具

| Tool | 实际用途 | 业务价值 |
|---|---|---|
| `query-nearby-stores` | 用户城市＋地标查询营业门店，`beType=1` | 使菜单和价格对应明确取餐门店 |
| `query-meals` | 读取类别、商品编码、当前价格和优惠限制 | 不以模型记忆虚构菜单与价格 |
| `query-meal-detail` | 确认单品规格、套餐轮次与默认特调 | 不重复计套餐，不遗漏必要配置 |
| `query-store-coupons` | 查询当前门店适用券并匹配产品编码 | 只对适用商品试算优惠 |
| `calculate-price` | 完整组合的最终应付试算 | 严格检查预算上限，而非只相加单品标价 |

以上工具均已使用授权账户实调；真实网页流程也已验证。完整结果与限制见 `docs/verification.md`。不调用 `create-order`、领券、兑换等写入工具。

## 调用流程

1. SDK 连接，分页读取 `tools/list`；五个白名单工具的语义 schema 指纹必须匹配本项目已核验定义。
2. 用户输入城市和位置，选择 `query-nearby-stores` 返回的门店。
3. `query-meals` 与只读优惠券查询并行；按官方类别和标签识别角色，跳过随单购会员才能享有的商品。
4. 查询必要餐品详情，保留默认特调与官方允许的套餐选项；只有主食、小食和饮品各一份的完整结构参与搭配。
5. 构造候选；锁定的单品与规格保留，存在其他可行组合时不连续重复。
6. 根据官方菜单价优先尝试可能在预算内的候选，但保留因优惠而可能降价的候选。
7. 调用 `calculate-price`，核验商品编码及数量；只用整数分 `data.price` 作为应付，检查预算和报价时间。
8. 返回一份搭配、价格依据、门店、取餐方式与试算时间。失败不回退成演示。

## 实际字段中的重要区别

- `query-meals.data.meals[code].currentPrice` 是以元计的字符串；`calculate-price.data.price` 为整数分。
- `productPrice` 不是最终应付，不能替代 `price`。
- 到店取餐传 `beType=1, orderType=1`，不传 `beCode`。
- 套餐父商品使用 `roundList` 明确子项，不能再将套餐子项独立添加并重复计费。
- 默认特调使用真实 selectedKey；未选中但带 unselectedKey 的项也保留。
- 实际 schema 的位置搜索只允许 searchType=1/2；未使用网页文档列出但本次 schema 不支持的经纬度模式。

## 隔离与可追溯性

演示数据源使用虚构菜单，前端持续显示演示标识。真实凭证、原始账户券信息、原始接口响应均只在忽略的 `.local/` 或本机 `.env` 中处理；不会加入仓库。

`.local/calls.jsonl` 只记录工具名称、成功与否、耗时和时间；不记录凭证、位置原文、商品入参或账户券标识。公开证据仅保留测试门店、无个人信息的搭配和金额。

接口失败、鉴权失败、限流和 schema 变化均产生明确错误。仅本机使用，校验 Host/Origin、请求大小和只读工具白名单；不允许用户指定远程接口地址，也不提供任意工具调用端点。
