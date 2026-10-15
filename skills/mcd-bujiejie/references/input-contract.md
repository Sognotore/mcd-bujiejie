# 脚本输入契约

脚本独立运行，仅需要 Node.js >=22，不依赖仓库外的文件或 npm 包。

`node scripts/choose.mjs < input.json` 从标准输入读取一个 JSON 对象，输出 JSON。

## 菜单

`catalog` 含 `source`（live 或 demo）、`items`、可选的 `bundles`。

每个单品：`id`、官方 `name`、`role`（main/side/drink）、整数分 `priceCents`、`variantId`、明确的 `available=true`。`orderLine` 可携带官方商品及规格参数，供调用 `calculate-price` 使用。

每个完整套餐：`id`、`name`、`available=true`、整个套餐的整数分 `priceCents`、`items`（三个不同角色的组成项）、`orderLine`。套餐内无独立售价的组成项设 `included=true`、`priceCents=0`，不得向用户展示为免费。套餐整体可替换，不能把固定套餐子项当可独立锁定的单品。

## 获取候选

输入 `action=candidates`、`catalog`、`budget`（元的字符串或 null）、`lockedIds`（默认空）、`previousKey`（可选）、`rejectedKeys`（本次已经试算失败的 key）。

输出 `candidate`、`budgetCents`、`requiresOfficialQuote=true`。候选的 `priceCents` 是菜单参考金额，不是实际应付；不得把候选直接展示成已确认推荐。无其他候选时允许返回上一份，并标记 `isPrevious=true`。

## 核验真实报价

输入 `action=verify`、原样 `candidate`、`budget`，以及从真实计价工具转换的 `quote`：

- `totalCents`：官方 `data.price`，整数分。
- `discountCents`：官方 `data.discount`，缺省为 0。
- `feesCents`：返回的配送费和餐具费之和，缺省项为 0。
- `quotedAt`：本次官方试算成功时的毫秒时间戳，不能使用历史截图时间。

输出仅在应付不超预算、完整结构及报价时间有效时成功。失败输出 `error.code`，不可以忽略该错误继续把候选当成预算内结果。

## 显式演示

输入 `action=demo`、`catalog.source=demo` 和预算，返回带 `mode=demo` 的结果。该功能不能冒充官方结果。
