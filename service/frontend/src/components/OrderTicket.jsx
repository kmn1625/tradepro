import { useState, useCallback } from 'react';
import { X, ChevronDown, ChevronUp, Plus, Trash2, Zap } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const LOT_SIZES = { NIFTY: 65, BANKNIFTY: 30, FINNIFTY: 60 };

const ORDER_TYPES = ['MKT', 'LIMIT', 'SL-M', 'SL-L'];
const PRODUCTS    = ['MIS', 'CNC', 'NRML', 'CO', 'BO'];

const PRODUCT_LABELS = {
  MIS:  'MIS (Intraday)',
  CNC:  'CNC (Delivery)',
  NRML: 'NRML (Carry forward)',
  CO:   'CO (Cover)',
  BO:   'BO (Bracket)',
};

function _needsPrice(ot)    { return ot === 'LIMIT' || ot === 'SL-L'; }
function _needsTrigger(ot)  { return ot === 'SL-M'  || ot === 'SL-L'; }

// ─── Single order form state ──────────────────────────────────────────────────
function useOrderForm(defaults = {}) {
  const [side,             setSide]             = useState(defaults.side      || 'BUY');
  const [lots,             setLots]             = useState(defaults.lots      || 1);
  const [orderType,        setOrderType]        = useState(defaults.orderType || 'MKT');
  const [product,          setProduct]          = useState(defaults.product   || 'MIS');
  const [price,            setPrice]            = useState('');
  const [triggerPrice,     setTriggerPrice]     = useState('');
  const [amo,              setAmo]              = useState(false);
  const [disclosedQty,     setDisclosedQty]     = useState('');
  const [stopLoss,         setStopLoss]         = useState('');
  const [squareOff,        setSquareOff]        = useState('');
  const [trailingStopLoss, setTrailingStopLoss] = useState('');
  const [showAdvanced,     setShowAdvanced]     = useState(false);

  return {
    side, setSide, lots, setLots, orderType, setOrderType, product, setProduct,
    price, setPrice, triggerPrice, setTriggerPrice, amo, setAmo,
    disclosedQty, setDisclosedQty, stopLoss, setStopLoss,
    squareOff, setSquareOff, trailingStopLoss, setTrailingStopLoss,
    showAdvanced, setShowAdvanced,
  };
}

function buildOrderPayload(form, symbol, expiry, strike, optType) {
  const base = {
    symbol,
    side:      form.side,
    lots:      form.lots,
    orderType: form.orderType,
    product:   form.product,
    amo:       form.amo,
  };
  if (expiry)  base.expiry = expiry;
  if (strike)  base.strike = strike;
  if (optType) base.type   = optType;
  if (_needsPrice(form.orderType)   && form.price)        base.price        = Number(form.price);
  if (_needsTrigger(form.orderType) && form.triggerPrice) base.triggerPrice = Number(form.triggerPrice);
  if (form.disclosedQty)     base.disclosedQty     = Number(form.disclosedQty);
  if (form.product === 'CO' && form.stopLoss)  base.stopLoss  = Number(form.stopLoss);
  if (form.product === 'BO') {
    if (form.squareOff)        base.squareOff        = Number(form.squareOff);
    if (form.stopLoss)         base.stopLoss         = Number(form.stopLoss);
    if (form.trailingStopLoss) base.trailingStopLoss = Number(form.trailingStopLoss);
  }
  return base;
}

// ─── Single-leg order form ────────────────────────────────────────────────────
function OrderForm({ form, symbol, ltp }) {
  const ot = form.orderType;
  const pd = form.product;
  const lotSize = LOT_SIZES[symbol] || 1;
  const qty = form.lots * lotSize;

  return (
    <div className="space-y-3">
      {/* Side + Lots row */}
      <div className="flex gap-2">
        <div className="flex rounded-xl overflow-hidden border border-slate-200 flex-1">
          {['BUY', 'SELL'].map(s => (
            <button
              key={s}
              onClick={() => form.setSide(s)}
              className={`flex-1 py-2 text-sm font-black transition-colors ${
                form.side === s
                  ? s === 'BUY' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                  : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >{s}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500 font-bold">Lots</label>
          <input
            type="number" min="1" value={form.lots}
            onChange={e => form.setLots(Math.max(1, Number(e.target.value)))}
            className="border border-slate-200 rounded-xl px-2 py-2 text-sm font-mono w-16 text-center"
          />
          {lotSize > 1 && <span className="text-[10px] text-slate-400 font-mono">={qty} qty</span>}
        </div>
      </div>

      {/* Order type + Product */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Order Type</label>
          <select
            value={ot}
            onChange={e => { form.setOrderType(e.target.value); form.setPrice(''); form.setTriggerPrice(''); }}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {ORDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Product</label>
          <select
            value={pd}
            onChange={e => form.setProduct(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {PRODUCTS.map(p => <option key={p} value={p}>{PRODUCT_LABELS[p]}</option>)}
          </select>
        </div>
      </div>

      {/* Price fields — conditional */}
      {(_needsPrice(ot) || _needsTrigger(ot)) && (
        <div className="grid grid-cols-2 gap-2">
          {_needsPrice(ot) && (
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                Limit Price {ltp ? <span className="text-indigo-400 normal-case">LTP {ltp}</span> : ''}
              </label>
              <input
                type="number" step="0.05" placeholder="0.00" value={form.price}
                onChange={e => form.setPrice(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          )}
          {_needsTrigger(ot) && (
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Trigger Price</label>
              <input
                type="number" step="0.05" placeholder="0.00" value={form.triggerPrice}
                onChange={e => form.setTriggerPrice(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          )}
        </div>
      )}

      {/* Cover order fields */}
      {pd === 'CO' && (
        <div>
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Stop Loss (points)</label>
          <input
            type="number" step="0.5" placeholder="e.g. 10" value={form.stopLoss}
            onChange={e => form.setStopLoss(e.target.value)}
            className="w-full border border-amber-300 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      )}

      {/* Bracket order fields */}
      {pd === 'BO' && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Target (pts)</label>
            <input type="number" step="0.5" placeholder="e.g. 20" value={form.squareOff}
              onChange={e => form.setSquareOff(e.target.value)}
              className="w-full border border-emerald-300 rounded-xl px-2 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">SL (pts)</label>
            <input type="number" step="0.5" placeholder="e.g. 10" value={form.stopLoss}
              onChange={e => form.setStopLoss(e.target.value)}
              className="w-full border border-rose-300 rounded-xl px-2 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rose-400" />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Trail SL (pts)</label>
            <input type="number" step="0.5" placeholder="opt." value={form.trailingStopLoss}
              onChange={e => form.setTrailingStopLoss(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-2 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
        </div>
      )}

      {/* Advanced toggle */}
      <button
        onClick={() => form.setShowAdvanced(v => !v)}
        className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 font-bold transition-colors"
      >
        {form.showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Advanced
      </button>

      {form.showAdvanced && (
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="amo-toggle" checked={form.amo}
              onChange={e => form.setAmo(e.target.checked)}
              className="rounded accent-indigo-600" />
            <label htmlFor="amo-toggle" className="text-xs font-bold text-slate-600">AMO (After Market)</label>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
              Iceberg Qty
            </label>
            <input
              type="number" min="1" placeholder="disclosed" value={form.disclosedQty}
              onChange={e => form.setDisclosedQty(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            {form.disclosedQty && Number(form.disclosedQty) > 0 && (() => {
              const totalQty = (LOT_SIZES[symbol] || 1) * form.lots;
              const slices   = Math.ceil(totalQty / Number(form.disclosedQty));
              return <p className="text-[10px] text-indigo-500 mt-1 font-bold">{slices} slice{slices !== 1 ? 's' : ''} of {form.disclosedQty}</p>;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Confirm preview modal ────────────────────────────────────────────────────
function ConfirmGate({ preview, onConfirm, onCancel, loading }) {
  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 space-y-3">
      <p className="font-black text-amber-800 text-sm">⚠ LIVE ORDER — Cannot be undone</p>
      <div className="space-y-1">
        {(Array.isArray(preview) ? preview : [preview]).map((p, i) => (
          <div key={i} className="font-mono text-xs text-amber-900 bg-amber-100 rounded px-2 py-1">
            {p.side} {p.tradingSymbol || p.symbol} × {p.quantity} [{p.orderType} / {p.product}]
            {p.price ? ` @ ₹${p.price}` : ''}
            {p.triggerPrice ? ` trig ₹${p.triggerPrice}` : ''}
            {p.amo ? ' [AMO]' : ''}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onConfirm} disabled={loading}
          className="bg-rose-600 hover:bg-rose-500 text-white px-5 py-2 rounded-xl text-xs font-black transition-all disabled:opacity-50"
        >{loading ? 'Placing…' : 'Confirm Live Order'}</button>
        <button
          onClick={onCancel} disabled={loading}
          className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-black transition-all"
        >Cancel</button>
      </div>
    </div>
  );
}

// ─── Bulk order row ───────────────────────────────────────────────────────────
const EMPTY_BULK_ROW = () => ({
  id: Date.now() + Math.random(),
  symbol: 'NIFTY', side: 'BUY', lots: 1,
  orderType: 'MKT', product: 'MIS', price: '', triggerPrice: '',
});

function BulkOrderUI({ onClose }) {
  const [rows,         setRows]         = useState([EMPTY_BULK_ROW()]);
  const [loading,      setLoading]      = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [result,       setResult]       = useState(null);

  const addRow    = () => setRows(r => [...r, EMPTY_BULK_ROW()]);
  const removeRow = id  => setRows(r => r.filter(x => x.id !== id));
  const updateRow = (id, field, value) => setRows(r => r.map(x => x.id === id ? { ...x, [field]: value } : x));

  const _sendBulk = async (confirmLive) => {
    const orders = rows.map(r => ({
      symbol:    r.symbol,
      side:      r.side,
      lots:      r.lots,
      orderType: r.orderType,
      product:   r.product,
      ...(r.price        ? { price:        Number(r.price) }        : {}),
      ...(r.triggerPrice ? { triggerPrice: Number(r.triggerPrice) } : {}),
      confirmLive,
    }));
    const res = await fetch(`${API_BASE}/api/market/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders, confirmLive }),
    });
    return { status: res.status, data: await res.json() };
  };

  const submit = async () => {
    setLoading(true);
    setResult(null);
    setConfirmState(null);
    try {
      const { status, data } = await _sendBulk(false);
      if (status === 428) { setConfirmState({ preview: data.preview || [] }); return; }
      setResult({ ok: data.status !== 'failed', msg: data.status === 'ok' ? `${data.filled?.length} order(s) placed` : `Partial: ${data.filled?.length} ok, ${data.failed?.length} failed` });
    } catch (e) {
      setResult({ ok: false, msg: e.message });
    } finally {
      setLoading(false);
    }
  };

  const confirmLive = async () => {
    setLoading(true);
    setConfirmState(null);
    try {
      const { data } = await _sendBulk(true);
      setResult({ ok: data.status !== 'failed', msg: data.status === 'ok' ? `${data.filled?.length} order(s) LIVE` : `Partial: ${data.filled?.length} ok, ${data.failed?.length} failed` });
    } catch (e) {
      setResult({ ok: false, msg: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {rows.map(row => (
          <div key={row.id} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <input
              value={row.symbol} onChange={e => updateRow(row.id, 'symbol', e.target.value.toUpperCase())}
              placeholder="Symbol" className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono w-24 uppercase" />
            <div className="flex rounded-lg overflow-hidden border border-slate-200">
              {['BUY','SELL'].map(s => (
                <button key={s} onClick={() => updateRow(row.id, 'side', s)}
                  className={`px-2 py-1.5 text-xs font-black ${row.side === s ? (s === 'BUY' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white') : 'bg-white text-slate-400'}`}>
                  {s}
                </button>
              ))}
            </div>
            <input type="number" min="1" value={row.lots} onChange={e => updateRow(row.id, 'lots', Number(e.target.value))}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono w-12 text-center" />
            <select value={row.orderType} onChange={e => updateRow(row.id, 'orderType', e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold">
              {ORDER_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <select value={row.product} onChange={e => updateRow(row.id, 'product', e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold">
              {PRODUCTS.slice(0,3).map(p => <option key={p}>{p}</option>)}
            </select>
            {_needsPrice(row.orderType) && (
              <input type="number" step="0.05" placeholder="price" value={row.price}
                onChange={e => updateRow(row.id, 'price', e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono w-20" />
            )}
            {_needsTrigger(row.orderType) && (
              <input type="number" step="0.05" placeholder="trigger" value={row.triggerPrice}
                onChange={e => updateRow(row.id, 'triggerPrice', e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono w-20" />
            )}
            <button onClick={() => removeRow(row.id)} className="ml-auto text-slate-300 hover:text-rose-500 transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <button onClick={addRow}
        className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-black">
        <Plus size={12} /> Add Order
      </button>

      {confirmState && (
        <ConfirmGate preview={confirmState.preview} onConfirm={confirmLive} onCancel={() => setConfirmState(null)} loading={loading} />
      )}

      {result && (
        <div className={`rounded-xl p-3 text-sm font-bold ${result.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
          {result.msg}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        {onClose && <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800">Close</button>}
        <button
          onClick={submit} disabled={loading || rows.length === 0}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-sm font-black transition-all disabled:opacity-50"
        >
          <Zap size={14} /> {loading ? 'Placing…' : `Place ${rows.length} Order${rows.length > 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}

// ─── Main OrderTicket component ───────────────────────────────────────────────
// Props:
//   symbol, expiry?, strike?, optType?  — instrument
//   initialSide?  — pre-select BUY or SELL
//   ltp?          — current market price (shown as hint)
//   onSuccess?    — callback(result) on successful placement
//   onClose?      — callback to dismiss (when used as modal)
//   showBulk?     — show Bulk tab (default true)
const OrderTicket = ({
  symbol,
  expiry,
  strike,
  optType,
  initialSide = 'BUY',
  ltp,
  onSuccess,
  onClose,
  showBulk = true,
}) => {
  const [tab,          setTab]          = useState('single'); // 'single' | 'bulk'
  const [loading,      setLoading]      = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [result,       setResult]       = useState(null);

  const form = useOrderForm({ side: initialSide });

  const label = strike ? `${symbol} ${expiry || ''} ${strike}${optType || ''}` : symbol;

  const _sendOrder = useCallback(async (confirmLive) => {
    const payload = {
      ...buildOrderPayload(form, symbol, expiry, strike, optType),
      ltp,
      confirmLive,
    };
    const res = await fetch(`${API_BASE}/api/market/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { status: res.status, data: await res.json() };
  }, [form, symbol, expiry, strike, optType, ltp]);

  const submit = async () => {
    setLoading(true);
    setResult(null);
    setConfirmState(null);
    try {
      const { status, data } = await _sendOrder(false);
      if (status === 428) { setConfirmState({ preview: data.preview }); return; }
      const ok = data.status === 'ok';
      const r = { ok, msg: ok ? `Order placed — ${data.mode} — ${data.orderId || 'simulated'}` : `Failed: ${data.rejectionReason || data.message || 'unknown'}` };
      setResult(r);
      if (ok && onSuccess) onSuccess(data);
    } catch (e) {
      setResult({ ok: false, msg: e.message });
    } finally {
      setLoading(false);
    }
  };

  const confirmLiveOrder = async () => {
    setLoading(true);
    setConfirmState(null);
    try {
      const { data } = await _sendOrder(true);
      const ok = data.status === 'ok';
      const r = { ok, msg: ok ? `LIVE order placed — ${data.orderId}` : `Failed: ${data.rejectionReason || data.message || 'unknown'}` };
      setResult(r);
      if (ok && onSuccess) onSuccess(data);
    } catch (e) {
      setResult({ ok: false, msg: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden w-full max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
        <div>
          <span className="font-black text-slate-800 text-sm">{label}</span>
          {ltp > 0 && <span className="ml-2 text-xs text-slate-500 font-mono">LTP ₹{ltp}</span>}
        </div>
        <div className="flex items-center gap-3">
          {showBulk && (
            <div className="flex rounded-lg overflow-hidden border border-slate-200 text-xs">
              {['single', 'bulk'].map(t => (
                <button key={t} onClick={() => { setTab(t); setResult(null); setConfirmState(null); }}
                  className={`px-3 py-1.5 font-black capitalize transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                  {t}
                </button>
              ))}
            </div>
          )}
          {onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {tab === 'single' ? (
          <>
            <OrderForm form={form} symbol={symbol} ltp={ltp} />

            {confirmState && (
              <ConfirmGate
                preview={confirmState.preview}
                onConfirm={confirmLiveOrder}
                onCancel={() => setConfirmState(null)}
                loading={loading}
              />
            )}

            {result && (
              <div className={`rounded-xl p-3 text-sm font-bold ${result.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                {result.msg}
              </div>
            )}

            {!confirmState && (
              <button
                onClick={submit} disabled={loading}
                className={`w-full py-3 rounded-xl font-black text-sm transition-all disabled:opacity-50 ${
                  form.side === 'BUY'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                <Zap size={14} className="inline mr-1.5" />
                {loading ? 'Placing…' : `${form.side} ${label}`}
              </button>
            )}
          </>
        ) : (
          <BulkOrderUI onClose={onClose} />
        )}
      </div>
    </div>
  );
};

export default OrderTicket;
