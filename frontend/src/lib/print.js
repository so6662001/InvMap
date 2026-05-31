/** 打印：提货单（多明细）与结算单（支持 A4 一式两份，一页两联可裁切）。 */
const STATUS_TEXT = { WAITING: '待提货', PARTIAL: '部分提货', DONE: '已提货', FROZEN: '冻结' };
const mask = (p) => (p && p.length === 11 ? `${p.slice(0, 3)}****${p.slice(7)}` : p);

function openPrint(title, bodyHtml, css) {
  const win = window.open('', '_blank', 'width=900,height=900');
  win.document.write(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"/><title>${title}</title><style>${css}</style></head><body>
  <div class="no-print"><button onclick="window.print()">打印</button></div>${bodyHtml}
  <script>window.onload=()=>setTimeout(()=>window.print(),300);<\/script></body></html>`);
  win.document.close();
}

// ===== 提货单 =====
function itemRow(it) {
  return `<tr><td>${it.goodsName}</td><td>${it.spec}</td><td>${it.weight}${it.weightUnit}/${it.pieces}${it.pieceUnit}</td><td><b>${it.warehouseName}</b></td><td><b>${it.locationText}（${it.locationCode}）</b></td><td>${STATUS_TEXT[it.status] || it.status}</td></tr>`;
}
function billHtml(o) {
  return `<div class="ticket"><div class="t-head"><div class="t-title">提货单</div><div class="t-no">${o.billNo}</div></div>
  <div class="t-meta"><span>货主：<b>${o.customer}</b></span><span>提货码：<b class="code">${o.pickupCode}</b></span><span>明细：${o.items.length} 条 · 涉及 ${o.warehouseCount} 个仓库</span></div>
  <table class="t-table"><thead><tr><th>货物</th><th>规格</th><th>数量</th><th>仓库</th><th>库位</th><th>状态</th></tr></thead><tbody>${o.items.map(itemRow).join('')}</tbody></table>
  <div class="t-foot"><div class="qr">QR<br/>${o.pickupCode}</div><div class="t-tip">请凭本单及提货码到对应库位提货；同一提单多个商品可能分布在不同仓库，请按导航路线依次提货，由库管/门岗核验。</div></div></div>`;
}
export function printOrders(orders, phone) {
  if (!orders || !orders.length) { alert('没有可打印的提单'); return; }
  const now = new Date().toLocaleString('zh-CN');
  const css = `body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;color:#111;margin:24px;}
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
    .no-print{position:fixed;top:10px;right:10px;}.no-print button{padding:8px 16px;cursor:pointer;}`;
  const body = `<div class="meta"><span>提货手机号：${mask(phone)}</span><span>打印时间：${now}</span></div>${orders.map(billHtml).join('')}`;
  openPrint('提货单打印', body, css);
}

// ===== 结算单（A4 一式两份）=====
function settleCopy(s, lian) {
  const itemRows = (s.items || []).map((it) => `<tr><td>${it.goodsName}</td><td>${it.spec}</td><td>${it.warehouseName}</td><td>${it.locationCode}</td><td>${it.weight}${it.weightUnit}</td><td>${it.pieces}${it.pieceUnit}</td></tr>`).join('');
  const feeRows = (s.fees || []).map((f) => `<tr><td>${f.name}</td><td class="amt">¥ ${f.amount.toFixed(2)}</td></tr>`).join('');
  return `<section class="copy">
    <div class="lian">${lian}</div>
    <div class="s-head"><div class="s-title">结算单</div><div class="s-no">No. ${s.settleNo || ''}</div></div>
    <div class="s-meta">
      <span>货主：<b>${s.customer || ''}</b></span>
      <span>提货单号：<b>${s.billNo || ''}</b></span>
      <span>提货码：<b class="code">${s.pickupCode || ''}</b></span>
      <span>时间：${s.time || ''}</span>
      <span>经办：${s.operator || ''}</span>
    </div>
    <table class="s-table"><thead><tr><th>货物</th><th>规格</th><th>仓库</th><th>库位</th><th>重量</th><th>件数</th></tr></thead><tbody>${itemRows}</tbody></table>
    <div class="s-bottom">
      <table class="s-fee"><thead><tr><th>费用项</th><th>金额</th></tr></thead><tbody>${feeRows}</tbody>
        <tr class="grand"><td>合计（重量 ${s.totalWeight || 0} 吨）</td><td class="amt">¥ ${(s.totalAmount || 0).toFixed(2)}</td></tr></table>
      <div class="s-sign"><div>客户签字：________</div><div>仓库（章）：________</div></div>
    </div>
    <div class="s-remark">${s.remark || ''}</div>
  </section>`;
}

/**
 * @param {object} s 结算单数据
 * @param {object} opts { copies: 1|2 }  copies=2 时一页 A4 上下各半张打印两联，便于裁切
 */
export function printSettlement(s, opts = {}) {
  if (!s) { alert('没有结算单数据'); return; }
  const copies = opts.copies === 2 ? 2 : 1;
  const css = `
    @page { size: A4 portrait; margin: 8mm; }
    *{box-sizing:border-box;}
    body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;color:#111;margin:0;}
    .no-print{position:fixed;top:8px;right:8px;}.no-print button{padding:8px 16px;cursor:pointer;}
    /* 每联固定半张 A4 高度，确保两联同页 */
    .copy{height:134mm;border:1px solid #333;border-radius:4px;padding:6mm;position:relative;overflow:hidden;page-break-inside:avoid;}
    .copy + .cut{height:0;border-top:1px dashed #999;margin:4mm 0;position:relative;}
    .copy + .cut::after{content:"✂ 沿虚线裁切";position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:#fff;padding:0 8px;color:#888;font-size:11px;}
    .lian{position:absolute;top:6mm;right:6mm;font-size:12px;color:#666;border:1px solid #bbb;border-radius:10px;padding:1px 8px;}
    .s-head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #333;padding-bottom:4px;}
    .s-title{font-size:20px;font-weight:800;letter-spacing:2px;}.s-no{font-family:monospace;font-size:13px;}
    .s-meta{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:12px;margin:6px 0;}.s-meta .code{letter-spacing:2px;}
    .s-table{width:100%;border-collapse:collapse;font-size:12px;}
    .s-table th{background:#f2f4f7;text-align:left;padding:4px 6px;border:1px solid #ccc;}
    .s-table td{padding:4px 6px;border:1px solid #ddd;}
    .s-bottom{display:flex;gap:10mm;align-items:flex-end;margin-top:6px;}
    .s-fee{border-collapse:collapse;font-size:12px;min-width:60mm;}
    .s-fee th{background:#f2f4f7;text-align:left;padding:4px 6px;border:1px solid #ccc;}
    .s-fee td{padding:4px 6px;border:1px solid #ddd;}.s-fee .amt{text-align:right;font-variant-numeric:tabular-nums;}
    .s-fee .grand td{font-weight:700;background:#fafafa;}
    .s-sign{flex:1;display:flex;flex-direction:column;gap:10px;font-size:12px;color:#333;justify-content:flex-end;}
    .s-remark{position:absolute;bottom:5mm;left:6mm;font-size:11px;color:#888;}
    @media print{.no-print{display:none;}}`;
  let body;
  if (copies === 2) {
    body = settleCopy(s, '第一联 · 客户存执') + '<div class="cut"></div>' + settleCopy(s, '第二联 · 仓库存根');
  } else {
    body = settleCopy(s, '客户存执');
  }
  openPrint('结算单打印', body, css);
}
