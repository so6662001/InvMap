/**
 * 模拟 ERP 接口层。
 * 数据模型：一张提单(bill)含多条商品明细(items)，每条明细各自有仓库与库位。
 * 预约信息含车辆（车高/车货总重/车型），用于按限高/限重过滤道路。
 */
import { getPark, VEHICLE_PRESETS } from './warehouseConfig.js';

export { getPark, getRoads } from './warehouseConfig.js';
export { VEHICLE_PRESETS } from './warehouseConfig.js';

const veh = (id) => VEHICLE_PRESETS.find((v) => v.id === id) || VEHICLE_PRESETS[0];

// 每个手机号预约登记的车辆（实际由 ERP/预约系统提供）
const VEHICLE_DB = {
  '13800000000': veh('flat'),
  '13900000000': veh('small'),
  '13700000000': veh('trailer')
};

const ORDER_DB = {
  '13800000000': [
    bill('TD20260531001', '中创钢贸', '8821', [
      ['螺纹钢 HRB400E', 'Φ20 9m', 26.5, 5, '捆', 'WH03', 'C-04-03', 'WAITING'],
      ['热轧卷板 SPHC', '3.0×1500', 18.2, 3, '卷', 'WH01', 'A-02-06', 'WAITING'],
      ['镀锌板卷 DC51D', '1.0×1250', 9.8, 2, '卷', 'WH02', 'B-03-05', 'WAITING']
    ]),
    bill('TD20260531002', '远东物资', '5530', [
      ['中厚板 Q355B', '16×2200', 21.4, 4, '件', 'WH05', 'B-05-02', 'WAITING'],
      ['工字钢 Q235', '200×200', 12.5, 2, '捆', 'WH06', 'A-03-07', 'PARTIAL']
    ])
  ],
  '13900000000': [
    bill('TD20260531010', '宏盛贸易', '3097', [
      ['镀锌板卷', '1.0×1250', 9.8, 2, '卷', 'WH02', 'B-01-04', 'WAITING'],
      ['镀锌板卷', '0.8×1000', 6.4, 1, '卷', 'WH02', 'B-02-01', 'WAITING']
    ])
  ],
  '13700000000': [
    bill('TD20260531020', '金鼎钢铁', '7741', [
      ['角钢', '63×6', 7.6, 3, '捆', 'WH04', 'C-06-01', 'WAITING'],
      ['圆钢', 'Φ50', 15.0, 1, '捆', 'WH06', 'A-01-08', 'FROZEN', '货款未结清']
    ])
  ]
};

function bill(billNo, customer, pickupCode, rows) {
  const items = rows.map((r, i) => {
    const [goodsName, spec, weight, pieces, pieceUnit, warehouseId, locationCode, status, frozenReason] = r;
    const wh = getPark().warehouses.find((w) => w.id === warehouseId);
    const [zone, row, col] = locationCode.split('-');
    return {
      itemNo: String(i + 1).padStart(2, '0'), goodsName, spec,
      weight, weightUnit: '吨', pieces, pieceUnit,
      warehouseId, warehouseName: wh ? wh.name : warehouseId,
      locationCode, locationText: `${zone}区 ${row}排 ${col}位`,
      status, frozenReason: frozenReason || null
    };
  });
  const pickable = items.filter((it) => it.status !== 'FROZEN');
  const status = pickable.length === 0 ? 'FROZEN' : items.some((it) => it.status === 'PARTIAL') ? 'PARTIAL' : items.every((it) => it.status === 'DONE') ? 'DONE' : 'WAITING';
  return { billNo, customer, pickupCode, status, items, itemCount: items.length, warehouseCount: new Set(pickable.map((it) => it.warehouseId)).size, weight: +pickable.reduce((s, it) => s + it.weight, 0).toFixed(1) };
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchOrders(phone) {
  await delay(450);
  const orders = ORDER_DB[phone];
  if (!orders || orders.length === 0) return { code: 1001, message: '未查询到名下提单', data: null };
  const pickableItems = orders.flatMap((o) => o.items.filter((it) => it.status !== 'FROZEN'));
  const warehouseCount = new Set(pickableItems.map((it) => it.warehouseId)).size;
  const totalWeight = +pickableItems.reduce((s, it) => s + it.weight, 0).toFixed(1);
  return {
    code: 0, message: 'ok',
    data: {
      phone: maskPhone(phone), driverName: '司机',
      vehicle: VEHICLE_DB[phone] || veh('flat'),
      summary: { orderCount: orders.length, itemCount: pickableItems.length, warehouseCount, totalWeight },
      orders
    }
  };
}

export function maskPhone(p) { return p && p.length === 11 ? `${p.slice(0, 3)}****${p.slice(7)}` : p; }
export const DEMO_PHONES = ['13800000000', '13900000000', '13700000000'];
