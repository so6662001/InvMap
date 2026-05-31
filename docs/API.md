# ERP 提单接口契约（InvMap ↔ ERP）

> InvMap 导航系统对提单数据**只读**。以下为建议的接口契约，可按客户 ERP 实际情况调整字段映射。
> 鉴权方式（示例）：请求头 `Authorization: Bearer <token>` 或 `X-Api-Key`。所有时间为 ISO8601。

## 数据模型要点

**一张提单（bill）可包含多条商品明细（items），每条明细各自有仓库与库位。** 导航据此：
- 在厂区总览图标记每条明细的库位；
- 行车路线覆盖该司机所有明细涉及的全部仓库；
- 点击单条明细可进入其所在仓库的库内视图精确定位。

## 1. 按手机号查询待提提单

```
GET /api/pickup/orders?phone={手机号}
```

请求参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| phone | string | 是 | 司机预约手机号（11 位） |
| status | string | 否 | 过滤状态，默认仅返回可提（待提货/部分提货） |

响应示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "phone": "138****8888",
    "driverName": "王师傅",
    "summary": { "orderCount": 2, "itemCount": 5, "warehouseCount": 5, "totalWeight": 88.4 },
    "orders": [
      {
        "billNo": "TD20260531001",
        "customer": "中创钢贸",
        "pickupCode": "8821",
        "status": "WAITING",
        "items": [
          {
            "itemNo": "01",
            "goodsName": "螺纹钢 HRB400E",
            "spec": "Φ20 9m",
            "weight": 26.5, "weightUnit": "吨",
            "pieces": 5, "pieceUnit": "捆",
            "warehouseId": "WH03",
            "warehouseName": "3号库",
            "locationCode": "C-04-03",
            "locationText": "C区 04排 03位",
            "status": "WAITING",
            "frozenReason": null
          },
          {
            "itemNo": "02",
            "goodsName": "热轧卷板 SPHC",
            "spec": "3.0×1500",
            "weight": 18.2, "weightUnit": "吨",
            "pieces": 3, "pieceUnit": "卷",
            "warehouseId": "WH01",
            "warehouseName": "1号库",
            "locationCode": "A-02-06",
            "locationText": "A区 02排 06位",
            "status": "WAITING",
            "frozenReason": null
          }
        ]
      }
    ]
  }
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| billNo | string | 提单号（唯一） |
| customer | string | 货主/客户 |
| pickupCode | string | 提货码，供门岗/库管核验 |
| status | enum | 提单整体状态 `WAITING`/`PARTIAL`/`DONE`/`FROZEN`（由明细汇总） |
| items[] | array | **商品明细数组** |
| items[].itemNo | string | 明细序号（提单内唯一） |
| items[].goodsName / spec | string | 货物名称 / 规格 |
| items[].weight / weightUnit | number / string | 重量及单位 |
| items[].pieces / pieceUnit | number / string | 件数/捆数及单位 |
| items[].warehouseId | string | 库房编码，**用于映射 3D 模型与坐标** |
| items[].warehouseName | string | 库房显示名 |
| items[].locationCode | string | 库位编码（区-排-位），InvMap 据此映射 3D 坐标 |
| items[].locationText | string | 库位可读文本 |
| items[].status | enum | 明细状态 `WAITING`/`PARTIAL`/`DONE`/`FROZEN` |
| items[].frozenReason | string\|null | 该明细冻结/不可提原因 |

> `summary.warehouseCount`/`totalWeight` 等按"可提明细"（排除 FROZEN）统计。

状态码：`0` 成功；`1001` 手机号无提单；`1002` 参数错误；`5xx` ERP 异常（InvMap 走缓存兜底）。

## 2. 厂区与库房基础信息

```
GET /api/warehouses
```

用于 3D 建模与坐标映射（也可由 InvMap 后台独立维护，并支持在「仓库配置」页面可视化定制）。

```json
{
  "code": 0,
  "data": {
    "parkSize": { "width": 340, "depth": 280 },
    "gate": { "id": "GATE_IN", "name": "大门/磅房", "x": -140, "z": 120 },
    "exit": { "id": "GATE_OUT", "name": "出门口", "x": -100, "z": 120 },
    "roads": {
      "horizontals": [ { "z": 80, "x0": -150, "x1": 150 } ],
      "verticals": [ { "x": -140, "z0": -100, "z1": 130 } ]
    },
    "warehouses": [
      {
        "id": "WH03", "name": "3号库",
        "x": 90, "z": 40, "width": 64, "depth": 36,
        "entrance": { "x": 90, "z": 58 },
        "stackType": "bar",
        "grid": { "zones": ["A","B","C"], "rowsPerZone": 6, "colsPerRow": 8 }
      }
    ]
  }
}
```

> `roads` + 各库 `entrance` 即**行车路线规划的输入**（见下方「路线如何生成」）。`grid` 决定库内库位编码到 3D 坐标的换算，库房可单独覆盖。

## 3. 库位坐标映射（InvMap 内部维护，可选由 ERP 提供）

```
GET /api/warehouses/{warehouseId}/locations
```

返回库位编码 → 库内相对坐标，用于把 `locationCode` 精确定位到 3D。

```json
{ "code": 0, "data": [ { "code": "C-07-03", "rx": 0.62, "rz": 0.30 } ] }
```

## 4. 打印/核销日志回写（可选）

```
POST /api/pickup/print-log
{ "billNo": "TD20260531001", "phone": "13800000000", "action": "PRINT", "at": "2026-05-31T09:20:00Z" }
```

## 路线如何生成

行车路线**不是人工逐条画的**，而是由系统根据厂区配置自动规划：

1. **输入**：厂区道路网络 `roads`（横/纵道路段）、各库房入口坐标 `entrance`、大门 `gate` 与出门 `exit`。
2. **建图**：把道路交叉点、各库入口、大门/出门接入一张路网图（节点+带权边，权重为路段实际距离）。
3. **排序**：从大门出发，对"司机所有明细涉及的去重仓库集合"做最近邻排序（开放式 TSP 近似），得到①②③…的提货顺序。
4. **求路径**：相邻两站之间用 Dijkstra 求路网最短路，拼接成完整路线，最后回到出门口。
5. **输出**：有序仓库列表 + 路线几何（带箭头）+ 总里程。

因此要"设置/调整路线"，只需在「仓库配置」中调整**道路网络**或**各库入口位置**（或由 ERP/后台下发 `roads` 与 `entrance`），路线会自动重算。约束（单行道、限高限重、装卸拥堵权重等）可作为边权扩展。

## 5. 对接说明

- InvMap 默认轮询查询；若 ERP 支持，可改为 Webhook 推送库位变更（移库）以实时刷新。
- 字段映射在 InvMap 后台可配置，适配不同 ERP 命名。
- 本仓库 `prototype/js/mockErp.js` 即按上述结构实现的**模拟实现**，联调时替换为真实 `fetch` 即可；厂区/道路/库房配置见 `prototype/js/warehouseConfig.js`。
