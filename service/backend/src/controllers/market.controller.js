// market.controller.js
const axios = require('axios');
const marketDataService = require('../services/marketData.service');
const session = require('../brokers/kotak/session');
const kotakConfig = require('../brokers/kotak/config');

const LOT_SIZES = {
  NIFTY: 75, BANKNIFTY: 30, FINNIFTY: 65,
  MIDCPNIFTY: 120, SENSEX: 20, BANKEX: 20,
  NIFTYIT: 50, NIFTYMIDCAP50: 80,
  USDINR: 1000, EURINR: 1000, GBPINR: 1000, JPYINR: 1000,
};

// NSE F&O trading symbol: e.g. NIFTY26JUN2522500CE
// Returns null if required fields missing (caller must validate)
function _buildTradingSymbol(symbol, expiry, strike, type) {
  if (!symbol) return null;
  // No strike/expiry → treat as futures/equity (just symbol name)
  if (!strike && !expiry) return symbol;
  // Has strike but no expiry → cannot build valid NFO symbol
  if (strike && !expiry) return null;
  // Has expiry but no strike → futures
  if (!strike && expiry) return symbol;
  const d = new Date(expiry);
  if (isNaN(d.getTime())) return null;
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const dd  = String(d.getDate()).padStart(2, '0');
  const mmm = months[d.getMonth()];
  const yy  = String(d.getFullYear()).slice(-2);
  return `${symbol}${dd}${mmm}${yy}${strike}${type}`;
}

// Map user-facing orderType → Kotak Neo order_type field
// MKT → MKT, LIMIT → L, SL-M → SL-M, SL-L → SL
function _kotakOrderType(orderType = 'MKT') {
  const map = { MKT: 'MKT', LIMIT: 'L', 'SL-M': 'SL-M', 'SL-L': 'SL' };
  return map[orderType.toUpperCase()] || 'MKT';
}

// Map user-facing product → Kotak Neo product field
// MIS → I, CNC → C, NRML → M, CO → CO, BO → BO
function _kotakProduct(product = 'MIS') {
  const map = { MIS: 'I', CNC: 'C', NRML: 'M', CO: 'CO', BO: 'BO', I: 'I', C: 'C', M: 'M' };
  return map[product.toUpperCase()] || 'I';
}

// Build full Kotak Neo order body from normalized params
function _buildKotakBody(params) {
  const {
    tradingSymbol,
    exchange = 'nse_fo',
    side,
    orderType = 'MKT',
    quantity,
    product = 'MIS',
    price,
    triggerPrice,
    amo = false,
    disclosedQty,
    stopLoss,       // Cover order: SL trigger points
    squareOff,      // Bracket order: target points
    trailingStopLoss, // Bracket order: trailing SL points
  } = params;

  const kt = _kotakOrderType(orderType);
  const kp = _kotakProduct(product);

  const body = {
    trading_symbol:   tradingSymbol,
    exchange_segment: exchange,
    transaction_type: side === 'BUY' ? 'B' : 'S',
    order_type:       kt,
    quantity:         String(quantity),
    product:          kp,
    validity:         'DAY',
    amo:              amo ? 'YES' : 'NO',
    price:            '0',
    trigger_price:    '0',
    disclosed_quantity: '0',
  };

  // Price fields by order type
  if (kt === 'L' && price)         body.price = String(price);
  if (kt === 'SL' && price)        body.price = String(price);
  if (kt === 'SL' && triggerPrice) body.trigger_price = String(triggerPrice);
  if (kt === 'SL-M' && triggerPrice) body.trigger_price = String(triggerPrice);

  // Iceberg: disclosed quantity
  if (disclosedQty && Number(disclosedQty) > 0) {
    body.disclosed_quantity = String(disclosedQty);
  }

  // Cover order
  if (kp === 'CO' && stopLoss) body.stop_loss_value = String(stopLoss);

  // Bracket order
  if (kp === 'BO') {
    if (squareOff)        body.square_off           = String(squareOff);
    if (stopLoss)         body.stop_loss            = String(stopLoss);
    if (trailingStopLoss) body.trailing_stop_loss   = String(trailingStopLoss);
  }

  return body;
}

function _kotakHeaders(accessToken) {
  return {
    Authorization:  `Bearer ${accessToken}`,
    consumerKey:    process.env.KOTAK_CONSUMER_KEY,
    'Content-Type': 'application/json',
  };
}

function _parseKotakResponse(data, tradingSymbol) {
  const rd      = data?.data || data || {};
  const orderId = rd.nOrdNo || rd.orderId || null;
  const ordSt   = (rd.ordSt || rd.status || '').toLowerCase();
  if (ordSt === 'rejected' || ordSt === 'rej') {
    return {
      status:          'rejected',
      mode:            'live',
      tradingSymbol,
      orderId,
      rejectionReason: rd.rejRsn || rd.rejectionReason || 'unknown',
      timestamp:       new Date().toISOString(),
    };
  }
  return {
    status:      'ok',
    mode:        'live',
    tradingSymbol,
    orderId,
    orderStatus: ordSt || 'placed',
    timestamp:   new Date().toISOString(),
  };
}

class MarketController {
  async getQuotes(req, res) {
    try {
      const { symbols } = req.query;
      const symbolArray = symbols ? symbols.split(',') : undefined;
      const result = await marketDataService.getLiveQuotes(symbolArray);
      if (result.success) res.json(result.data);
      else res.status(500).json({ error: result.error });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getHistory(req, res) {
    try {
      const { symbol } = req.params;
      const { interval = '5m', limit = 100 } = req.query;
      const result = await marketDataService.getHistoricalData(symbol, interval, parseInt(limit));
      if (result.success) res.json(result.data);
      else res.status(500).json({ error: result.error });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async searchSymbols(req, res) {
    try {
      const { q } = req.query;
      const results = marketDataService.searchSymbols(q || '');
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getDepth(req, res) {
    try {
      const { symbol } = req.params;
      const depth = marketDataService.getMarketDepth(decodeURIComponent(symbol));
      res.json(depth);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getIndicators(req, res) {
    try {
      const { symbol, indicator = 'RSI', interval = '5m', period = 14 } = req.body;
      const historyResult = await marketDataService.getHistoricalData(symbol, interval, 100);
      if (!historyResult.success) return res.status(500).json({ error: historyResult.error });
      const indicatorResult = marketDataService.calculateIndicator(historyResult.data, indicator, parseInt(period));
      res.json(indicatorResult);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getMultipleIndicators(req, res) {
    try {
      const { symbol, interval = '5m' } = req.body;
      const historyResult = await marketDataService.getHistoricalData(symbol, interval, 100);
      if (!historyResult.success) return res.status(500).json({ error: historyResult.error });
      res.json({
        symbol,
        interval,
        timestamp: new Date().toISOString(),
        indicators: {
          rsi:   marketDataService.calculateIndicator(historyResult.data, 'RSI', 14),
          macd:  marketDataService.calculateIndicator(historyResult.data, 'MACD'),
          sma20: marketDataService.calculateIndicator(historyResult.data, 'SMA', 20),
          sma50: marketDataService.calculateIndicator(historyResult.data, 'SMA', 50),
          ema20: marketDataService.calculateIndicator(historyResult.data, 'EMA', 20),
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getSignals(req, res) {
    try {
      const { symbol, interval = '5m' } = req.body;
      const historyResult = await marketDataService.getHistoricalData(symbol, interval, 100);
      if (!historyResult.success) return res.status(500).json({ error: historyResult.error });

      const rsi   = marketDataService.calculateIndicator(historyResult.data, 'RSI', 14);
      const macd  = marketDataService.calculateIndicator(historyResult.data, 'MACD');
      const ema20 = marketDataService.calculateIndicator(historyResult.data, 'EMA', 20);
      const ema50 = marketDataService.calculateIndicator(historyResult.data, 'EMA', 50);

      const signals = [];
      let confidence = 0;

      if (rsi.signal === 'OVERSOLD')   { signals.push({ indicator: 'RSI',  signal: 'BUY',  reason: 'RSI below 30 - Oversold' });    confidence += 25; }
      else if (rsi.signal === 'OVERBOUGHT') { signals.push({ indicator: 'RSI',  signal: 'SELL', reason: 'RSI above 70 - Overbought' }); confidence += 25; }

      if (macd.signal === 'BULLISH')   { signals.push({ indicator: 'MACD', signal: 'BUY',  reason: 'MACD bullish crossover' });     confidence += 25; }
      else if (macd.signal === 'BEARISH')  { signals.push({ indicator: 'MACD', signal: 'SELL', reason: 'MACD bearish crossover' });    confidence += 25; }

      if (ema20.current !== null && ema50.current !== null) {
        if (ema20.current > ema50.current) { signals.push({ indicator: 'EMA', signal: 'BUY',  reason: 'EMA20 above EMA50 - Uptrend' });   confidence += 25; }
        else                               { signals.push({ indicator: 'EMA', signal: 'SELL', reason: 'EMA20 below EMA50 - Downtrend' }); confidence += 25; }
      }

      const buyCount  = signals.filter(s => s.signal === 'BUY').length;
      const sellCount = signals.filter(s => s.signal === 'SELL').length;
      let overallSignal = 'NEUTRAL';
      if      (buyCount  > sellCount && buyCount  >= 2) overallSignal = 'STRONG_BUY';
      else if (buyCount  > sellCount)                   overallSignal = 'BUY';
      else if (sellCount > buyCount  && sellCount >= 2) overallSignal = 'STRONG_SELL';
      else if (sellCount > buyCount)                    overallSignal = 'SELL';

      res.json({
        symbol, interval,
        timestamp: new Date().toISOString(),
        overallSignal,
        confidence: Math.min(confidence, 100),
        signals,
        indicators: { rsi: rsi.current, macd: macd.current, ema20: ema20.current, ema50: ema50.current },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/market/order
  // Body: {
  //   symbol, side, type, strike, expiry, lots,
  //   orderType?: MKT|LIMIT|SL-M|SL-L  (default MKT)
  //   product?:   MIS|CNC|NRML|CO|BO   (default MIS)
  //   price?:     number  (required for LIMIT, SL-L)
  //   triggerPrice?: number  (required for SL-M, SL-L)
  //   amo?:       boolean  (After Market Order)
  //   disclosedQty?: number  (Iceberg: disclosed slice size)
  //   stopLoss?:  number  (Cover/Bracket: SL points)
  //   squareOff?: number  (Bracket: target points)
  //   trailingStopLoss?: number  (Bracket: trailing SL points)
  //   exchange?:  nse_fo|nse_cm  (default nse_fo)
  //   confirmLive?: boolean  (M4 safety gate, must be true for live)
  // }
  async placeOrder(req, res) {
    const {
      symbol, side, type, strike, expiry, lots, ltp,
      orderType = 'MKT', product = 'MIS',
      price, triggerPrice, amo = false, disclosedQty,
      stopLoss, squareOff, trailingStopLoss,
      exchange = 'nse_fo',
      confirmLive,
    } = req.body;

    if (!symbol || !side || !lots) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields: symbol, side, lots' });
    }

    const ot = orderType.toUpperCase();
    if ((ot === 'LIMIT' || ot === 'SL-L') && !price) {
      return res.status(400).json({ status: 'error', message: `orderType ${ot} requires price` });
    }
    if ((ot === 'SL-M' || ot === 'SL-L') && !triggerPrice) {
      return res.status(400).json({ status: 'error', message: `orderType ${ot} requires triggerPrice` });
    }
    const pd = (product || 'MIS').toUpperCase();
    if (pd === 'CO' && !stopLoss) {
      return res.status(400).json({ status: 'error', message: 'Cover order (CO) requires stopLoss' });
    }
    if (pd === 'BO' && (!squareOff || !stopLoss)) {
      return res.status(400).json({ status: 'error', message: 'Bracket order (BO) requires squareOff and stopLoss' });
    }

    const quantity      = (LOT_SIZES[symbol] || 1) * Number(lots);
    const tradingSymbol = _buildTradingSymbol(symbol, expiry, strike, type);

    if (!tradingSymbol) {
      return res.status(400).json({
        status: 'error',
        message: `Cannot build trading symbol: strike provided (${strike}) but expiry missing. Provide expiry for options orders.`,
      });
    }

    if (session.isAuthenticated()) {
      // M4: Safety gate — preview before committing live order
      if (!confirmLive) {
        return res.status(428).json({
          status:  'confirmation_required',
          mode:    'live',
          message: 'Set confirmLive: true to place a REAL order. This cannot be undone.',
          preview: {
            tradingSymbol, side, quantity, orderType: ot, product: pd,
            price, triggerPrice, amo, disclosedQty, exchange,
            ...(pd === 'CO' ? { stopLoss } : {}),
            ...(pd === 'BO' ? { squareOff, stopLoss, trailingStopLoss } : {}),
          },
        });
      }

      try {
        const { accessToken } = session.getSession();
        const body = _buildKotakBody({
          tradingSymbol, exchange, side, orderType: ot, quantity, product: pd,
          price, triggerPrice, amo, disclosedQty,
          stopLoss, squareOff, trailingStopLoss,
        });
        const kotakRes = await axios.post(
          `${kotakConfig.BASE_URL}/rest/neo/v1/order`,
          body,
          { headers: _kotakHeaders(accessToken), timeout: 8000 }
        );
        return res.json(_parseKotakResponse(kotakRes.data, tradingSymbol));
      } catch (err) {
        console.warn('[market] Kotak order failed:', err.message);
        return res.status(502).json({ status: 'error', mode: 'live', message: err.message, tradingSymbol });
      }
    }

    // No live session — paper simulation
    res.json({
      status:        'ok',
      mode:          'simulated',
      tradingSymbol,
      side,
      quantity,
      orderType:     ot,
      product:       pd,
      ltp:           Number(ltp) || 0,
      timestamp:     new Date().toISOString(),
    });
  }

  // POST /api/market/basket — sequenced multi-leg order execution (M18)
  // Each leg can include all order-type params (orderType, price, triggerPrice, product, etc.)
  // Body: { legs: [{...orderParams}], confirmLive?, rollbackOnFail? }
  async placeBasketOrder(req, res) {
    const { legs, confirmLive, rollbackOnFail = true } = req.body;
    if (!Array.isArray(legs) || legs.length === 0) {
      return res.status(400).json({ status: 'error', message: 'legs array required' });
    }

    const live = session.isAuthenticated();

    if (live && !confirmLive) {
      const preview = legs.map(l => ({
        tradingSymbol: l.symbol && l.strike ? _buildTradingSymbol(l.symbol, l.expiry, l.strike, l.type) : (l.tradingSymbol || l.symbol),
        side:      l.side,
        quantity:  (LOT_SIZES[l.symbol] || 1) * Number(l.lots || 1),
        orderType: (l.orderType || 'MKT').toUpperCase(),
        product:   (l.product   || 'MIS').toUpperCase(),
      }));
      return res.status(428).json({
        status:  'confirmation_required',
        mode:    'live',
        message: `Set confirmLive: true to place ${legs.length} REAL order(s). Cannot be undone.`,
        preview,
      });
    }

    const fills  = [];
    const failed = [];

    for (const leg of legs) {
      const {
        symbol, side, type, strike, expiry, lots = 1, ltp,
        orderType = 'MKT', product = 'MIS',
        price, triggerPrice, amo = false, disclosedQty,
        stopLoss, squareOff, trailingStopLoss,
        exchange = 'nse_fo',
        tradingSymbol: rawTradingSymbol,
      } = leg;

      if (!symbol || !side) {
        failed.push({ leg, error: 'Missing symbol or side' });
        if (rollbackOnFail) break;
        continue;
      }

      const quantity      = (LOT_SIZES[symbol] || 1) * Number(lots);
      const tradingSymbol = rawTradingSymbol || (strike ? _buildTradingSymbol(symbol, expiry, strike, type) : symbol);
      const ot = (orderType || 'MKT').toUpperCase();
      const pd = (product   || 'MIS').toUpperCase();

      if (live) {
        try {
          const { accessToken } = session.getSession();
          const body = _buildKotakBody({
            tradingSymbol, exchange, side, orderType: ot, quantity, product: pd,
            price, triggerPrice, amo, disclosedQty,
            stopLoss, squareOff, trailingStopLoss,
          });
          const kotakRes = await axios.post(
            `${kotakConfig.BASE_URL}/rest/neo/v1/order`,
            body,
            { headers: _kotakHeaders(accessToken), timeout: 8000 }
          );
          const parsed = _parseKotakResponse(kotakRes.data, tradingSymbol);
          if (parsed.status === 'rejected') {
            failed.push({ leg, tradingSymbol, orderId: parsed.orderId, error: parsed.rejectionReason });
          } else {
            fills.push({ leg, tradingSymbol, orderId: parsed.orderId, status: parsed.orderStatus, mode: 'live' });
          }
        } catch (err) {
          failed.push({ leg, tradingSymbol, error: err.message });
        }
      } else {
        fills.push({ leg, tradingSymbol, orderId: null, status: 'simulated',
          fillPrice: Number(ltp) || 0, quantity, mode: 'simulated' });
      }

      if (failed.length > 0 && rollbackOnFail) break;
    }

    // Rollback on failure: reverse filled legs
    const rolledBack = [];
    if (live && rollbackOnFail && failed.length > 0 && fills.length > 0) {
      const { accessToken } = session.getSession();
      for (const fill of fills) {
        const reverseSide = fill.leg.side === 'BUY' ? 'SELL' : 'BUY';
        const qty = (LOT_SIZES[fill.leg.symbol] || 1) * Number(fill.leg.lots || 1);
        try {
          const rb = await axios.post(
            `${kotakConfig.BASE_URL}/rest/neo/v1/order`,
            _buildKotakBody({
              tradingSymbol: fill.tradingSymbol,
              exchange: fill.leg.exchange || 'nse_fo',
              side: reverseSide, orderType: 'MKT', quantity: qty, product: 'MIS',
            }),
            { headers: _kotakHeaders(accessToken), timeout: 8000 }
          );
          rolledBack.push({ tradingSymbol: fill.tradingSymbol,
            rollbackOrderId: rb.data?.data?.nOrdNo || null });
        } catch (err) {
          rolledBack.push({ tradingSymbol: fill.tradingSymbol, rollbackError: err.message });
        }
      }
    }

    const overallStatus = failed.length === 0 ? 'filled'
      : fills.length === 0 ? 'failed' : 'partial';

    return res.status(overallStatus === 'failed' ? 502 : 200).json({
      status: overallStatus,
      mode:   live ? 'live' : 'simulated',
      fills,
      failed,
      ...(rolledBack.length > 0 ? { rolledBack } : {}),
      timestamp: new Date().toISOString(),
    });
  }

  // POST /api/market/bulk — concurrent multi-order placement (all fired simultaneously)
  // Use for same or different instruments where order sequence doesn't matter.
  // Body: { orders: [{...orderParams}], confirmLive? }
  // Unlike basket, no rollback — all placed concurrently, individual results returned.
  async placeBulkOrder(req, res) {
    const { orders, confirmLive } = req.body;
    if (!Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ status: 'error', message: 'orders array required' });
    }

    const live = session.isAuthenticated();

    if (live && !confirmLive) {
      const preview = orders.map(o => ({
        tradingSymbol: o.strike ? _buildTradingSymbol(o.symbol, o.expiry, o.strike, o.type) : (o.symbol),
        side:      o.side,
        quantity:  (LOT_SIZES[o.symbol] || 1) * Number(o.lots || 1),
        orderType: (o.orderType || 'MKT').toUpperCase(),
        product:   (o.product   || 'MIS').toUpperCase(),
      }));
      return res.status(428).json({
        status:  'confirmation_required',
        mode:    'live',
        message: `Set confirmLive: true to place ${orders.length} REAL concurrent order(s). Cannot be undone.`,
        preview,
      });
    }

    // Place all concurrently
    const results = await Promise.allSettled(orders.map(async (o) => {
      const {
        symbol, side, type, strike, expiry, lots = 1, ltp,
        orderType = 'MKT', product = 'MIS',
        price, triggerPrice, amo = false, disclosedQty,
        stopLoss, squareOff, trailingStopLoss,
        exchange = 'nse_fo',
      } = o;

      const quantity      = (LOT_SIZES[symbol] || 1) * Number(lots);
      const tradingSymbol = strike ? _buildTradingSymbol(symbol, expiry, strike, type) : symbol;
      const ot = (orderType || 'MKT').toUpperCase();
      const pd = (product   || 'MIS').toUpperCase();

      if (live) {
        const { accessToken } = session.getSession();
        const body = _buildKotakBody({
          tradingSymbol, exchange, side, orderType: ot, quantity, product: pd,
          price, triggerPrice, amo, disclosedQty,
          stopLoss, squareOff, trailingStopLoss,
        });
        const kotakRes = await axios.post(
          `${kotakConfig.BASE_URL}/rest/neo/v1/order`,
          body,
          { headers: _kotakHeaders(accessToken), timeout: 8000 }
        );
        return { ...o, ...(_parseKotakResponse(kotakRes.data, tradingSymbol)) };
      }
      return { symbol, tradingSymbol, side, quantity, orderType: ot, product: pd,
        status: 'ok', mode: 'simulated', fillPrice: Number(ltp) || 0,
        timestamp: new Date().toISOString() };
    }));

    const filled = [];
    const failed = [];
    for (const r of results) {
      if (r.status === 'fulfilled') filled.push(r.value);
      else                          failed.push({ error: r.reason?.message || 'unknown' });
    }

    return res.status(200).json({
      status:    failed.length === 0 ? 'ok' : filled.length === 0 ? 'failed' : 'partial',
      mode:      live ? 'live' : 'simulated',
      filled,
      failed,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/market/order/:orderId — poll Kotak order status (M1)
  async getOrderStatus(req, res) {
    const { orderId } = req.params;
    if (!session.isAuthenticated()) {
      return res.status(503).json({ error: 'Kotak not authenticated' });
    }
    const { accessToken } = session.getSession();
    try {
      const kotakRes = await axios.get(
        `${kotakConfig.BASE_URL}/rest/neo/v1/order-report`,
        { headers: _kotakHeaders(accessToken), timeout: 8000 }
      );
      const orders = kotakRes.data?.data || [];
      const order  = orders.find(o => (o.nOrdNo || o.orderId) === orderId);
      if (!order) return res.status(404).json({ error: 'Order not found', orderId });

      const filledQty = parseInt(order.fldQty  || order.filledQty  || '0', 10);
      const totalQty  = parseInt(order.qty      || '0', 10);
      return res.json({
        orderId,
        status:          order.ordSt  || order.status,
        filledQty,
        pendingQty:      Math.max(0, totalQty - filledQty),
        avgFillPrice:    parseFloat(order.avgPrc || order.avgPrice || '0'),
        rejectionReason: order.rejRsn || order.rejectionReason || null,
        tradingSymbol:   order.trdSym || order.tradingSymbol,
        timestamp:       new Date().toISOString(),
      });
    } catch (err) {
      return res.status(502).json({ error: 'Kotak order report failed: ' + err.message });
    }
  }

  // DELETE /api/market/order/:orderId — cancel open order (M3)
  async cancelOrder(req, res) {
    const { orderId } = req.params;
    if (!session.isAuthenticated()) {
      return res.status(503).json({ error: 'Kotak not authenticated' });
    }
    const { accessToken } = session.getSession();
    try {
      const kotakRes = await axios.delete(
        `${kotakConfig.BASE_URL}/rest/neo/v1/order`,
        {
          data:    { on: orderId, am: 'NO' },
          headers: _kotakHeaders(accessToken),
          timeout: 8000,
        }
      );
      return res.json({ status: 'cancelled', orderId, raw: kotakRes.data, timestamp: new Date().toISOString() });
    } catch (err) {
      return res.status(502).json({ error: 'Kotak cancel failed: ' + err.message, orderId });
    }
  }

  // PATCH /api/market/order/:orderId — modify qty, price, or orderType (M3)
  // Body: { quantity?, price?, orderType?, triggerPrice? }
  async modifyOrder(req, res) {
    const { orderId } = req.params;
    const { quantity, price, orderType = 'MKT', triggerPrice } = req.body;
    if (!orderId) return res.status(400).json({ error: 'orderId required' });
    if (!quantity && !price && !triggerPrice) {
      return res.status(400).json({ error: 'Provide quantity, price, or triggerPrice to modify' });
    }
    if (!session.isAuthenticated()) {
      return res.status(503).json({ error: 'Kotak not authenticated' });
    }
    const { accessToken } = session.getSession();
    const body = { on: orderId, am: 'NO', pt: _kotakOrderType(orderType) };
    if (quantity)     body.qty = String(quantity);
    if (price)        body.pr  = String(price);
    if (triggerPrice) body.tp  = String(triggerPrice);
    try {
      const kotakRes = await axios.put(
        `${kotakConfig.BASE_URL}/rest/neo/v1/order`,
        body,
        { headers: _kotakHeaders(accessToken), timeout: 8000 }
      );
      return res.json({ status: 'modified', orderId, raw: kotakRes.data, timestamp: new Date().toISOString() });
    } catch (err) {
      return res.status(502).json({ error: 'Kotak modify failed: ' + err.message, orderId });
    }
  }

  // GET /api/market/orders — list all today's orders (M1)
  async listOrders(req, res) {
    if (!session.isAuthenticated()) {
      return res.status(503).json({ error: 'Kotak not authenticated' });
    }
    const { accessToken } = session.getSession();
    try {
      const kotakRes = await axios.get(
        `${kotakConfig.BASE_URL}/rest/neo/v1/order-report`,
        { headers: _kotakHeaders(accessToken), timeout: 8000 }
      );
      const orders = (kotakRes.data?.data || []).map(o => ({
        orderId:         o.nOrdNo || o.orderId,
        status:          o.ordSt  || o.status,
        tradingSymbol:   o.trdSym || o.tradingSymbol,
        side:            o.trnsTp === 'B' ? 'BUY' : 'SELL',
        quantity:        parseInt(o.qty    || '0', 10),
        filledQty:       parseInt(o.fldQty || '0', 10),
        avgFillPrice:    parseFloat(o.avgPrc || '0'),
        rejectionReason: o.rejRsn || null,
        orderTime:       o.ordDttm || o.orderTime || null,
      }));
      return res.json({ orders, count: orders.length, timestamp: new Date().toISOString() });
    } catch (err) {
      return res.status(502).json({ error: 'Kotak order list failed: ' + err.message });
    }
  }
}

module.exports = new MarketController();
