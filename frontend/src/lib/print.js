/** 打印：提货单（多明细）与结算单（份数自定义 + A4一页两联/小票80mm）。 */
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
  <div class="t-foot"><div class="qr">QR<br/>${o.pickupCode}</div><div class="t-tip">请凭本单及提货码到对应库位提货；多个商品可能分布在不同仓库，按导航路线依次提货。</div></div></div>`;
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
  openPrint('提货单打印', `<div class="meta"><span>提货手机号：${mask(phone)}</span><span>打印时间：${now}</span></div>${orders.map(billHtml).join('')}`, css);
}

// ===== 结算单 =====
function itemsTable(s) {
  return `<table class="s-table"><thead><tr><th>货物</th><th>规格</th><th>仓库</th><th>库位</th><th>重量</th><th>件数</th></tr></thead><tbody>${(s.items || []).map((it) => `<tr><td>${it.goodsName}</td><td>${it.spec}</td><td>${it.warehouseName}</td><td>${it.locationCode}</td><td>${it.weight}${it.weightUnit}</td><td>${it.pieces}${it.pieceUnit}</td></tr>`).join('')}</tbody></table>`;
}
function feeRows(s) { return (s.fees || []).map((f) => `<tr><td>${f.name}</td><td class="amt">¥ ${f.amount.toFixed(2)}</td></tr>`).join(''); }
function metaLine(s) {
  const billsTxt = (s.bills && s.bills.length > 1) ? `提单：${s.bills.join('、')}` : `提货单号：<b>${s.billNo || ''}</b>`;
  return `<span>货主：<b>${s.customer || ''}</b></span><span>${billsTxt}</span>${s.pickupCode ? `<span>提货码：<b class="code">${s.pickupCode}</b></span>` : ''}<span>时间：${s.time || ''}</span><span>经办：${s.operator || ''}</span>`;
}

// A4 半张联
function a4Copy(s, lian) {
  return `<section class="copy">
    <div class="lian">${lian}</div>
    <div class="s-head"><div class="s-title">结算单</div><div class="s-no">No. ${s.settleNo || ''}</div></div>
    <div class="s-meta">${metaLine(s)}</div>
    ${itemsTable(s)}
    <div class="s-bottom">
      <table class="s-fee"><thead><tr><th>费用项</th><th>金额</th></tr></thead><tbody>${feeRows(s)}</tbody>
        <tr class="grand"><td>合计（重量 ${s.totalWeight || 0} 吨）</td><td class="amt">¥ ${(s.totalAmount || 0).toFixed(2)}</td></tr></table>
      <div class="s-sign"><div>客户签字：________</div><div>仓库（章）：________</div></div>
    </div>
    <div class="s-remark">${s.remark || ''}</div>
  </section>`;
}
// 80mm 小票
function receiptCopy(s, lian) {
  const items = (s.items || []).map((it) => `<div class="r-item"><div>${it.goodsName} ${it.spec}</div><div class="r-sub">${it.warehouseName} ${it.locationCode} · ${it.weight}${it.weightUnit}/${it.pieces}${it.pieceUnit}</div></div>`).join('');
  const fees = (s.fees || []).map((f) => `<div class="r-row"><span>${f.name}</span><b>¥${f.amount.toFixed(2)}</b></div>`).join('');
  const bills = (s.bills && s.bills.length > 1) ? s.bills.join('、') : (s.billNo || '');
  return `<section class="receipt">
    <div class="r-title">结算单</div>
    <div class="r-line">No.${s.settleNo || ''}</div>
    <div class="r-meta">${lian}</div>
    <div class="r-hr"></div>
    <div class="r-row"><span>货主</span><b>${s.customer || ''}</b></div>
    <div class="r-row"><span>提单</span><b>${bills}</b></div>
    ${s.pickupCode ? `<div class="r-row"><span>提货码</span><b>${s.pickupCode}</b></div>` : ''}
    <div class="r-row"><span>时间</span><b>${s.time || ''}</b></div>
    <div class="r-hr"></div>${items}<div class="r-hr"></div>
    ${fees}
    <div class="r-row total"><span>合计(${s.totalWeight || 0}吨)</span><b>¥${(s.totalAmount || 0).toFixed(2)}</b></div>
    <div class="r-hr"></div>
    <div class="r-sign">客户签字：__________</div>
    <div class="r-foot">${s.remark || ''}</div>
  </section>`;
}

function lianLabel(i, copies) {
  if (copies === 2) return i === 0 ? '第一联 · 客户存执' : '第二联 · 仓库存根';
  return `第 ${i + 1} 份 / 共 ${copies} 份`;
}

/**
 * @param {object} s 结算单数据
 * @param {object} opts { copies:Number(>=1), paper:'a4'|'receipt80' }
 *   a4：每页上下各半张打印两联，N 份按每页 2 联自动分页；receipt80：80mm 小票，每份一段。
 */
export function printSettlement(s, opts = {}) {
  if (!s) { alert('没有结算单数据'); return; }
  const copies = Math.max(1, parseInt(opts.copies, 10) || 1);
  const paper = opts.paper === 'receipt80' ? 'receipt80' : 'a4';

  if (paper === 'receipt80') {
    const css = `@page{size:80mm auto;margin:3mm;} *{box-sizing:border-box;}
      body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;color:#000;margin:0;width:74mm;}
      .receipt{padding:2mm 0;page-break-after:always;}
      .receipt:last-child{page-break-after:auto;}
      .r-title{text-align:center;font-size:18px;font-weight:800;letter-spacing:3px;}
      .r-line{text-align:center;font-size:11px;font-family:monospace;}
      .r-meta{text-align:center;font-size:11px;color:#444;margin-top:2px;}
      .r-hr{border-top:1px dashed #000;margin:4px 0;}
      .r-row{display:flex;justify-content:space-between;font-size:12px;padding:1px 0;}
      .r-row.total{font-size:14px;font-weight:700;}
      .r-item{font-size:12px;padding:2px 0;}.r-sub{color:#444;font-size:11px;}
      .r-sign{font-size:12px;margin-top:8px;}.r-foot{font-size:10px;color:#666;margin-top:4px;}
      @media print{.no-print{display:none;}}`;
    let body = '';
    for (let i = 0; i < copies; i++) body += receiptCopy(s, lianLabel(i, copies));
    openPrint('结算单打印(80mm)', body, css);
    return;
  }

  // A4：每页 2 联
  const css = `@page{size:A4 portrait;margin:8mm;} *{box-sizing:border-box;}
    body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;color:#111;margin:0;}
    .no-print{position:fixed;top:8px;right:8px;}.no-print button{padding:8px 16px;cursor:pointer;}
    .page{page-break-after:always;}.page:last-child{page-break-after:auto;}
    .copy{height:134mm;border:1px solid #333;border-radius:4px;padding:6mm;position:relative;overflow:hidden;page-break-inside:avoid;}
    .cut{height:0;border-top:1px dashed #999;margin:4mm 0;position:relative;}
    .cut::after{content:"✂ 沿虚线裁切";position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:#fff;padding:0 8px;color:#888;font-size:11px;}
    .lian{position:absolute;top:6mm;right:6mm;font-size:12px;color:#666;border:1px solid #bbb;border-radius:10px;padding:1px 8px;}
    .s-head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #333;padding-bottom:4px;}
    .s-title{font-size:20px;font-weight:800;letter-spacing:2px;}.s-no{font-family:monospace;font-size:13px;}
    .s-meta{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:12px;margin:6px 0;}.s-meta .code{letter-spacing:2px;}
    .s-table{width:100%;border-collapse:collapse;font-size:12px;}
    .s-table th{background:#f2f4f7;text-align:left;padding:4px 6px;border:1px solid #ccc;}.s-table td{padding:4px 6px;border:1px solid #ddd;}
    .s-bottom{display:flex;gap:10mm;align-items:flex-end;margin-top:6px;}
    .s-fee{border-collapse:collapse;font-size:12px;min-width:60mm;}
    .s-fee th{background:#f2f4f7;text-align:left;padding:4px 6px;border:1px solid #ccc;}.s-fee td{padding:4px 6px;border:1px solid #ddd;}
    .s-fee .amt{text-align:right;}.s-fee .grand td{font-weight:700;background:#fafafa;}
    .s-sign{flex:1;display:flex;flex-direction:column;gap:10px;font-size:12px;color:#333;justify-content:flex-end;}
    .s-remark{position:absolute;bottom:5mm;left:6mm;font-size:11px;color:#888;}
    @media print{.no-print{display:none;}}`;
  let body = '';
  for (let i = 0; i < copies; i += 2) {
    const first = a4Copy(s, lianLabel(i, copies));
    const hasSecond = i + 1 < copies;
    const second = hasSecond ? '<div class="cut"></div>' + a4Copy(s, lianLabel(i + 1, copies)) : '';
    body += `<div class="page">${first}${second}</div>`;
  }
  openPrint('结算单打印(A4)', body, css);
}
