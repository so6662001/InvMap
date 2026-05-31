# ERP 提单接口契约（InvMap ↔ ERP）

> InvMap 导航系统对提单数据**只读**。以下为建议的接口契约，可按客户 ERP 实际情况调整字段映射。
> 鉴权方式（示例）：请求头 `Authorization: Bearer <token>` 或 `X-Api-Key`。所有时间为 ISO8601。

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
    "summary": { "orderCount": 3, "warehouseCount": 3, "totalWeight": 78.6 },
    "orders": [
      {
        "billNo": "TD20260531001",
        "customer": "中创钢贸",
        "goodsName": "螺纹钢 HRB400E",
        "spec": "Φ20 9m",
        "weight": 26.5,
        "weightUnit": "吨",
        "pieces": 5,
        "pieceUnit": "捆",
        "warehouseId": "WH03",
        "warehouseName": "3号库",
        "locationCode": "C-07-03",
        "locationText": "C区 07排 03位",
        "status": "WAITING",
        "pickupCode": "8821",
        "frozenReason": null
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
| goodsName / spec | string | 货物名称 / 规格 |
| weight / weightUnit | number / string | 重量及单位 |
| pieces / pieceUnit | number / string | 件数/捆数及单位 |
| warehouseId | string | 库房编码，**用于映射 3D 模型与坐标** |
| warehouseName | string | 库房显示名 |
| locationCode | string | 库位编码（区-排-位），InvMap 据此映射 3D 坐标 |
| locationText | string | 库位可读文本 |
| status | enum | `WAITING`/`PARTIAL`/`DONE`/`FROZEN` |
| pickupCode | string | 提货码，供门岗/库管核验 |
| frozenReason | string\|null | 冻结/不可提原因 |

状态码：`0` 成功；`1001` 手机号无提单；`1002` 参数错误；`5xx` ERP 异常（InvMap 走缓存兜底）。

## 2. 厂区与库房基础信息

```
GET /api/warehouses
```

用于 3D 建模与坐标映射（也可由 InvMap 后台独立维护，ERP 仅提供编码对应关系）。

```json
{
  "code": 0,
  "data": {
    "parkSize": { "width": 320, "depth": 220 },
    "gate": { "id": "GATE_IN", "name": "大门/磅房", "x": -130, "z": 95 },
    "exit": { "id": "GATE_OUT", "name": "出门口", "x": -130, "z": 70 },
    "warehouses": [
      {
        "id": "WH03",
        "name": "3号库",
        "x": -30, "z": -40, "width": 70, "depth": 36,
        "entrance": { "x": -30, "z": -22 },
        "zones": ["A", "B", "C"], "rowsPerZone": 10, "colsPerRow": 8
      }
    ]
  }
}
```

## 3. 库位坐标映射（InvMap 内部维护，可选由 ERP 提供）

```
GET /api/warehouses/{warehouseId}/locations
```

返回库位编码 → 库内相对坐标，用于把 `locationCode` 精确定位到 3D。

```json
{ "code": 0, "data": [ { "code": "C-07-03", "rx": 0.62, "rz": 0.30 } ] }
```

> `rx/rz` 为库房内部 0~1 归一化相对坐标；InvMap 结合库房位置/尺寸换算为世界坐标。

## 4. 打印/核销日志回写（可选）

```
POST /api/pickup/print-log
{ "billNo": "TD20260531001", "phone": "13800000000", "action": "PRINT", "at": "2026-05-31T09:20:00Z" }
```

## 5. 对接说明

- InvMap 默认轮询查询；若 ERP 支持，可改为 Webhook 推送库位变更（移库）以实时刷新。
- 字段映射在 InvMap 后台可配置，适配不同 ERP 命名。
- 本仓库 `prototype/js/mockErp.js` 即按上述结构实现的**模拟实现**，联调时替换为真实 `fetch` 即可。
