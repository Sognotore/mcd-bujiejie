# 官方 MCP 接入要点

来源：https://open.mcd.cn/mcp/doc 和 https://github.com/M-China/mcd-mcp-server 。于 2026-10-15 以授权账户实调核验；运行时以当次 schema 为准。

- 到店取餐：`beType=1, orderType=1`，不要传 `beCode`；不默认预约。
- 搜索：`query-nearby-stores({searchType:2,beType:1,city,keyword})`，city、keyword 必须来自用户；响应 `data[]` 的 `storeCode`、`storeName` 是门店编号与名称。
- 菜单：`query-meals({storeCode,orderType:1,beType:1})`；响应 `data.categories[].meals[].code/tags` 关联 `data.meals[code]`。名称、`currentPrice`（元字符串）、优惠条件均在餐品映射内。
- 商品详情：`query-meal-detail({storeCode,orderType:1,beType:1,code})`。`rounds` 包含套餐轮次，`choices` 的 `isDefault=1` 表示默认选中。保持要求的数量和轮次约束；无法确认角色或必选项的商品不进入候选。
- 特调：`modification.items[].values[]`。选中项使用 `selectedKey` 和 `selectedQuantity`；未选中但带 `unselectedKey` 的项也需传入。不要自行拼造 key。可特调的餐品在名称后标记【可特调】，本功能保留默认特调。
- 优惠券：`query-store-coupons({storeCode,orderType:1,beType:1})` 只查询可用券；使用前匹配券的 `products[].productCode`。不自动领券，不承诺叠加；试算成功才应用。
- 计价：`calculate-price({storeCode,orderType:1,beType:1,items,needTableware:false})`。每个 items 条目含 `productCode`、`quantity:1`，必要时携带真实 `modification`、`couponId/couponCode`。套餐使用 `roundList:[{round:String(round.id),comboItemList:[{code,quantity:1,modification?}]}]`。
- 计价响应 `data.price` 是整数分的最终应付；`data.productList` 必须与所选的顶层商品及数量吻合。套餐内项目不重复另计。不要用单品标价之和、`productPrice` 或原价替代应付。
- HTTP 401 需要重新授权，429 需要降低频率；不要把失败视为无优惠或无可售商品。
- 官方协议页面和实时 schema 可能有差异，例如网页列出经纬度搜索，本次实时 schema 仅接受 searchType=1/2。不要调用 schema 不支持的参数。
