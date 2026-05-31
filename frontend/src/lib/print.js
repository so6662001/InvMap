/** 打印提货单（多商品明细），独立打印窗口。 */
const STATUS_TEXT = { WAITING: '待提货', PARTIAL: '部分提货', DONE: '已提货', FROZEN: '冻结' };
const mask = (p) => (p && p.length === 11 ? `${p.slice(0, 3)}****${p.slice(7)}` : p);

function itemRow(it) {
  return `<tr><td>${it.goodsName}</td><td>${it.spec}</td><td>${it.weight}${it.weightUnit}/${it.pieces}${it.pieceUnit}</td><td><b>${it.warehouseName}</b></td><td><b>${it.locationText}（${it.locationCode}）</b></td><td>${STATUS_TEXT[it.status] || it.status}</td></tr>`;
}
function billHtml(o) {
  return `<div class="ticket"><div class="t-head"><div class="t-title">提货单</div><div class="t-no">${o.billNo}</div></div>
  <div class="t-meta"><span>货主：<b>${o.customer}</b></span><span>提货码：<b class="code">${o.pickupCode}</b></span><span>明细：${o.items.length} 条 · 涉及 ${o.warehouseCount} 个仓库</span></div>
  <table class="t-table"><thead><tr><th>货物</th><th>规格</th><th>数量</th><th>仓库</th><th>库位</th><th>状态</th></tr></thead><tbody>${o.items.map(itemRow).join('')}</tbody></table>
  <div class="t-foot"><div class="qr">QR<br/>${o.pickupCode}</div><div class="t-tip">请凭本单及提货码到对应库位提货；同一提单的多个商品可能分布在不同仓库，请按导航路线依次提货，由库管/门岗核验。</div></div></div>`;
}

export function printOrders(orders, phone) {
  if (!orders || !orders.length) { alert('没有可打印的提单'); return; }
  const win = window.open('', '_blank', 'width=900,height=900');
  const now = new Date().toLocaleString('zh-CN');
  win.document.write(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"/><title>提货单打印</title><style>
    body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;color:#111;margin:24px;}
    .meta{display:flex;justify-content:space-between;font-size:13px;color:#555;margin-bottom:12px;}
    .ticket{border:1px solid #333;border-radius:8px;padding:16px;margin-bottom:18px;page-break-inside:avoid;}
    .t-head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #333;padding-bottom:8px;}
    .t-title{font-size:22px;font-weight:700;}.t-no{font-size:16px;font-family:monospace;}
    .t-meta{display:flex;gap:20px;flex-wrap:wrap;font-size:13px;margin:10px 0;}.t-meta .code{font-size:16px;letter-spacing:2px;}
    .t-table{width:100%;border-collapse:collapse;margin-top:6px;font-size:13px;}
    .t-table th{background:#f2f4f7;text-align:left;padding:8px;border:1px solid #ddd;}.t-table td{padding:8px;border:1px solid #ddd;}
    .t-foot{display:flex;align-items:center;gap:16px;margin-top:12px;}
    .qr{width:84px;height:84px;border:1px dashed #333;display:flex;align-items:center;justify-content:center;text-align:center;font-size:12px;font-weight:700;flex:none;}
    .t-tip{font-size:12px;color:#666;}
    @media print{.no-print{display:none;}body{margin:8mm;}}
    .no-print{position:fixed;top:10px;right:10px;}.no-print button{padding:8px 16px;font-size:14px;cursor:pointer;}
  </style></head><body>
  <div class="no-print"><button onclick="window.print()">打印</button></div>
  <div class="meta"><span>提货手机号：${mask(phone)}</span><span>打印时间：${now}</span></div>
  ${orders.map(billHtml).join('')}
  <script>window.onload=()=>setTimeout(()=>window.print(),300);<\/script></body></html>`);
  win.document.close();
}

/** 打印结算单（按提单/明细汇总重量；金额由 ERP 结算，演示留占位）。 */
function settleBill(o) {
  const rows = o.items.map((it) => `<tr><td>${it.goodsName}</td><td>${it.spec}</td><td>${it.warehouseName}</td><td>${it.weight}${it.weightUnit}</td><td>${it.pieces}${it.pieceUnit}</td><td>—</td></tr>`).join('');
  return `<div class="ticket"><div class="t-head"><div class="t-title">结算单</div><div class="t-no">${o.billNo}</div></div>
  <div class="t-meta"><span>货主：<b>${o.customer}</b></span><span>提货码：<b class="code">${o.pickupCode}</b></span><span>合计重量：<b>${o.weight} 吨</b></span></div>
  <table class="t-table"><thead><tr><th>货物</th><th>规格</th><th>仓库</th><th>重量</th><th>件数</th><th>金额</th></tr></thead><tbody>${rows}</tbody></table>
  </div>`;
}

export function printSettlement(orders, phone) {
  if (!orders || !orders.length) { alert('没有可结算的提单'); return; }
  const total = orders.reduce((s, o) => s + (o.weight || 0), 0).toFixed(1);
  const win = window.open('', '_blank', 'width=900,height=900');
  const now = new Date().toLocaleString('zh-CN');
  win.document.write(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"/><title>结算单打印</title><style>
    body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;color:#111;margin:24px;}
    .meta{display:flex;justify-content:space-between;font-size:13px;color:#555;margin-bottom:12px;}
    .ticket{border:1px solid #333;border-radius:8px;padding:16px;margin-bottom:18px;page-break-inside:avoid;}
    .t-head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #333;padding-bottom:8px;}
    .t-title{font-size:22px;font-weight:700;}.t-no{font-size:16px;font-family:monospace;}
    .t-meta{display:flex;gap:20px;flex-wrap:wrap;font-size:13px;margin:10px 0;}.t-meta .code{font-size:16px;letter-spacing:2px;}
    .t-table{width:100%;border-collapse:collapse;margin-top:6px;font-size:13px;}
    .t-table th{background:#f2f4f7;text-align:left;padding:8px;border:1px solid #ddd;}.t-table td{padding:8px;border:1px solid #ddd;}
    .grand{font-size:15px;font-weight:700;text-align:right;margin-top:8px;}
    @media print{.no-print{display:none;}body{margin:8mm;}}
    .no-print{position:fixed;top:10px;right:10px;}.no-print button{padding:8px 16px;font-size:14px;cursor:pointer;}
  </style></head><body>
  <div class="no-print"><button onclick="window.print()">打印</button></div>
  <div class="meta"><span>提货手机号：${mask(phone)}</span><span>打印时间：${now}</span></div>
  ${orders.map(settleBill).join('')}
  <div class="grand">本次合计重量：${total} 吨（金额以 ERP 结算为准）</div>
  <script>window.onload=()=>setTimeout(()=>window.print(),300);<\/script></body></html>`);
  win.document.close();
}
