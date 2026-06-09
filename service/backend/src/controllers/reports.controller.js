'use strict';

const { generateCSV, generatePDF } = require('../services/pdfGenerator.service');

// FIFO P&L matching
function computeTrades(orders, from, to) {
  const buyMap = {};
  const trades = [];
  const sorted = [...orders].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  for (const o of sorted) {
    const sym = o.symbol;
    const dt  = new Date(o.timestamp);
    if (o.side === 'BUY') {
      (buyMap[sym] = buyMap[sym] || []).push({ qty: o.qty, price: o.price, date: dt });
    } else if (o.side === 'SELL' && buyMap[sym]?.length) {
      let qty = o.qty;
      while (qty > 0 && buyMap[sym].length) {
        const buy     = buyMap[sym][0];
        const matched = Math.min(qty, buy.qty);
        const holdDays = (dt - buy.date) / (86400 * 1000);
        trades.push({
          symbol:    sym,
          buyDate:   buy.date.toLocaleDateString('en-IN'),
          sellDate:  dt.toLocaleDateString('en-IN'),
          qty:       matched,
          buyPrice:  buy.price,
          sellPrice: o.price,
          pnl:       Math.round(matched * (o.price - buy.price)),
          type:      holdDays >= 365 ? 'LTCG' : 'STCG',
        });
        buy.qty -= matched;
        qty     -= matched;
        if (buy.qty === 0) buyMap[sym].shift();
      }
    }
  }

  return trades.filter(t => {
    const d = new Date(t.sellDate);
    if (from && d < new Date(from)) return false;
    if (to   && d > new Date(to))   return false;
    return true;
  });
}

const MOCK_TRADES = [
  { symbol: 'NIFTY 50',   buyDate: '01/01/2026', sellDate: '15/01/2026', qty: 75,  buyPrice: 22000, sellPrice: 22800, pnl:  60000, type: 'STCG' },
  { symbol: 'TCS',        buyDate: '15/01/2026', sellDate: '20/03/2026', qty: 10,  buyPrice: 3500,  sellPrice: 3750,  pnl:   2500, type: 'STCG' },
  { symbol: 'RELIANCE',   buyDate: '10/06/2025', sellDate: '15/06/2026', qty: 50,  buyPrice: 2800,  sellPrice: 3100,  pnl:  15000, type: 'LTCG' },
  { symbol: 'BANKNIFTY',  buyDate: '01/02/2026', sellDate: '28/02/2026', qty: 25,  buyPrice: 47000, sellPrice: 46500, pnl: -12500, type: 'STCG' },
  { symbol: 'GOLD MCX',   buyDate: '01/03/2026', sellDate: '31/03/2026', qty: 1,   buyPrice: 62000, sellPrice: 63500, pnl:   1500, type: 'STCG' },
];

async function sendReport(res, format, title, subtitle, headers, csvHeaders, rows, filename) {
  if (format === 'csv') {
    const csv = generateCSV(csvHeaders, rows.map(r => r.map(String)));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.send(csv);
  }
  if (format === 'pdf') {
    try {
      const buf = await generatePDF(title, subtitle, headers, rows.map(r => r.map(String)));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      return res.send(buf);
    } catch (err) {
      return res.status(500).json({ error: 'PDF generation failed: ' + err.message });
    }
  }
  return null; // caller handles JSON
}

// POST /api/reports/pnl
exports.pnlReport = async (req, res) => {
  const { orders = [], from, to, format = 'json' } = req.body || {};
  const trades = orders.length ? computeTrades(orders, from, to) : MOCK_TRADES;
  const totalPnL = trades.reduce((s, t) => s + t.pnl, 0);

  const headers    = ['Symbol', 'Buy Date', 'Sell Date', 'Qty', 'Buy ₹', 'Sell ₹', 'P&L ₹', 'Type'];
  const csvHeaders = ['Symbol', 'Buy Date', 'Sell Date', 'Qty', 'Buy Price', 'Sell Price', 'PnL', 'Type'];
  const rows       = trades.map(t => [t.symbol, t.buyDate, t.sellDate, t.qty, t.buyPrice, t.sellPrice, t.pnl, t.type]);
  const subtitle   = `Generated: ${new Date().toLocaleDateString('en-IN')}${from ? ' | From: ' + from : ''}${to ? ' | To: ' + to : ''}`;

  const sent = await sendReport(res, format, 'P&L Report', subtitle, headers, csvHeaders, rows, 'pnl_report');
  if (sent !== null) return;

  res.json({ trades, totals: { realised: totalPnL, count: trades.length }, mode: orders.length ? 'live' : 'mock' });
};

// POST /api/reports/capital-gains
exports.capitalGains = async (req, res) => {
  const { orders = [], format = 'json' } = req.body || {};
  const trades = orders.length ? computeTrades(orders) : MOCK_TRADES;

  let stcg = 0, ltcg = 0;
  for (const t of trades) { if (t.type === 'LTCG') ltcg += t.pnl; else stcg += t.pnl; }
  const stcgTax = Math.max(0, Math.round(stcg * 0.15));
  const ltcgTax = Math.max(0, Math.round((ltcg - 100000) * 0.10));
  const gains = { stcg: Math.round(stcg), ltcg: Math.round(ltcg), stcgTax, ltcgTax };

  const headers    = ['Type', 'Gain/Loss (₹)', 'Tax Rate', 'Estimated Tax (₹)'];
  const csvHeaders = ['Type', 'Gain/Loss', 'Tax Rate', 'Estimated Tax'];
  const rows = [
    ['Short-Term (STCG)', gains.stcg, '15%',                    gains.stcgTax],
    ['Long-Term (LTCG)', gains.ltcg,  '10% (above ₹1L exempt)', gains.ltcgTax],
    ['Total Liability',  gains.stcg + gains.ltcg, '',           gains.stcgTax + gains.ltcgTax],
  ];
  const subtitle = `Generated: ${new Date().toLocaleDateString('en-IN')} | FY ${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

  const sent = await sendReport(res, format, 'Capital Gains Report', subtitle, headers, csvHeaders, rows, 'capital_gains');
  if (sent !== null) return;

  res.json({ ...gains, totalTax: stcgTax + ltcgTax, trades, mode: orders.length ? 'live' : 'mock' });
};

// POST /api/reports/contract-note
exports.contractNote = async (req, res) => {
  const { orders = [], format = 'json' } = req.body || {};
  const useMock = !orders.length;

  const items = useMock
    ? [
        { id: 'TRD001', symbol: 'NIFTY 50',  side: 'BUY',  qty: 75, price: 22000, value: 1650000, brokerage: 20, stt: 165,  ts: '01/06/2026 09:15' },
        { id: 'TRD002', symbol: 'NIFTY 50',  side: 'SELL', qty: 75, price: 22800, value: 1710000, brokerage: 20, stt: 171,  ts: '15/06/2026 15:10' },
        { id: 'TRD003', symbol: 'BANKNIFTY', side: 'BUY',  qty: 25, price: 47000, value: 1175000, brokerage: 20, stt: 117,  ts: '01/02/2026 10:05' },
      ]
    : orders.map((o, i) => ({
        id:        `TRD${String(i + 1).padStart(3, '0')}`,
        symbol:    o.symbol,
        side:      o.side,
        qty:       o.qty,
        price:     o.price,
        value:     o.qty * o.price,
        brokerage: 20,
        stt:       Math.round(o.qty * o.price * 0.0001),
        ts:        new Date(o.timestamp).toLocaleString('en-IN'),
      }));

  const headers    = ['Trade ID', 'Symbol', 'Side', 'Qty', 'Price ₹', 'Value ₹', 'Brok ₹', 'STT ₹', 'Time'];
  const csvHeaders = ['Trade ID', 'Symbol', 'Side', 'Qty', 'Price', 'Value', 'Brokerage', 'STT', 'Timestamp'];
  const rows       = items.map(i => [i.id, i.symbol, i.side, i.qty, i.price, i.value, i.brokerage, i.stt, i.ts]);
  const subtitle   = `Generated: ${new Date().toLocaleString('en-IN')}`;

  const sent = await sendReport(res, format, 'Contract Note', subtitle, headers, csvHeaders, rows, 'contract_note');
  if (sent !== null) return;

  res.json({ trades: items, mode: useMock ? 'mock' : 'live' });
};
