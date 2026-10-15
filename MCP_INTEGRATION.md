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

以上工具均已使用授权账户实调；真实网页流程也已验证。完整结果与限制见 `docs/verification.md`。网页新增用户确认后的 `create-order` 与本会话 `query-order`，已从官方实时清单核对 schema；本轮测试未创建真实订单。Skill 保持上述五项只读工具。领券、兑换等其他写入工具仍不开放。

## 调用流程

1. SDK 连接，分页读取 `tools/list`；默认五个只读工具，点餐网关另加 `create-order` 与 `query-order`，相应语义 schema 指纹必须匹配本项目已核验定义。每个选店、推荐与计价事务强制复核，单个工具调用的校验缓存最长 5 秒，并监听工具列表变化通知使旧校验立即失效。
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

接口失败、鉴权失败、限流和 schema 变化均产生明确错误。本机版及个人会话版均校验 Host/Origin、请求大小和明确工具白名单；不允许用户指定远程接口地址，也不提供任意工具调用端点。


## 用户确认下单与付款

服务端保存推荐的精确商品、数量、套餐与特调，前端不能提交任意 SKU 或自报金额。准备确认页和实际创建前分别重新调用 `calculate-price`；到店取餐方式只取 `takeWayList[].code`，实际展示名称使用 `title`。金额或取餐方式变化要求重新确认。

用户点击确认后才调用 `create-order`，发送 `storeCode`、`beType=1`、`orderType=1`、`takeWayCode`、精确 `items` 与 `needTableware=false`。同草稿及重复请求共享或拒绝已有创建动作，不自动重试不确定的提交。返回金额缺失或与确认金额不一致时保留订单号并停止付款跳转。支付链接只允许官方 HTTPS 生产域名的 `/mcp/scanToPay`，测试环境示例不可作为付款入口。

公共个人会话版接收使用者自己的 Token，只放服务端内存，设置 Secure/HttpOnly/SameSite=Strict 会话 Cookie，30 分钟到期；不读取作者 `.env`，不把门店缓存或账户响应写入共享文件。真实写调用和支付尚未实测；模拟测试不计为官方下单成功。

## 餐型与营养参考

快乐餐、减脂餐与健身餐的价格、可售及下单仍使用上述 MCP 流程。营养参考独立来自[麦当劳中国大陆官网](https://www.mcdonalds.com.cn/nutrition_calculator)，官方参考版本 2025-04；不是新增或假定的 MCP 字段。只有明确对应标准餐品及份量的商品才进入营养筛选，配方改变和未知数据不推算。规则、覆盖与组合不足时收为两类的逻辑见 [nutrition.md](docs/nutrition.md)。
