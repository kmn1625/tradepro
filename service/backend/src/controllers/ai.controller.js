'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { SUPPORTED_INDICATORS, OPERATORS, validate } = require('../config/conditionSchema');

// System prompt is static — cache it with Anthropic prompt caching to save ~90% tokens on repeated calls.
const SYSTEM_PROMPT_TEXT = `You are a trading strategy parser. Convert plain English strategy descriptions into a structured JSON condition object.

Supported indicators: ${SUPPORTED_INDICATORS.join(', ')}
Supported operators: ${OPERATORS.join(', ')}

Output ONLY valid JSON matching this schema:
{
  "entry": { "AND" | "OR": [ <condition_nodes> ] } | <single_condition_node>,
  "exit":  { "AND" | "OR": [ <condition_nodes> ] } | <single_condition_node>
}

Condition node types:
- Indicator: { "indicator": "RSI", "period": 14, "operator": "crossesBelow", "value": 30 }
- EMA cross: { "indicator": "EMA", "fast": 9, "slow": 21, "operator": "crossesAbove" }
- Time exit: { "type": "time", "time": "15:15" }
- Stop loss: { "type": "sl", "pct": 1.5 }
- Target:    { "type": "target", "pct": 2.0 }

Output only JSON, no explanation.`;

const aiController = {

  // POST /api/ai/stock-summary
  // Body: { symbol: string, price?: number }
  async stockSummary(req, res) {
    const { symbol, price } = req.body || {};
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(501).json({ error: 'ANTHROPIC_API_KEY not set' });

    try {
      const client = new Anthropic({ apiKey });
      const prompt = `Give a brief 80-word analysis of ${symbol}${price ? ` (current price: ₹${price})` : ''} for an Indian retail trader. Cover: trend, key levels, near-term outlook, and one risk. Be direct. Output plain text, no markdown.`;
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      });
      res.json({ symbol, summary: msg.content[0].text.trim() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // POST /api/ai/portfolio
  // Body: { positions: { [symbol]: { qty, avgPrice, ltp } }, orders?: [...] }
  async portfolioAnalysis(req, res) {
    const { positions = {}, orders = [] } = req.body || {};
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(501).json({ error: 'ANTHROPIC_API_KEY not set' });

    const holdingsList = Object.entries(positions)
      .map(([sym, p]) => `${sym}: qty=${p.qty}, avg=₹${p.avgPrice}, ltp=₹${p.ltp || p.avgPrice}`)
      .join('; ') || 'No open positions';

    try {
      const client = new Anthropic({ apiKey });
      const prompt = `You are a portfolio risk advisor for Indian markets. Portfolio: ${holdingsList}. Total trades: ${orders.length}. In 100 words: rate diversification (1-10), identify concentration risk, give 2 specific risk warnings, suggest 1 rebalancing action. Be direct, no fluff.`;
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      });
      res.json({ analysis: msg.content[0].text.trim() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // POST /api/ai/scanner
  // Body: { symbols: string[], marketData?: { [symbol]: { price, pct, volume } } }
  async scanner(req, res) {
    const { symbols = [], marketData = {} } = req.body || {};
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(501).json({ error: 'ANTHROPIC_API_KEY not set' });

    const dataStr = symbols.length
      ? symbols.map(s => {
          const d = marketData[s] || {};
          return `${s}: price=₹${d.price || 'N/A'}, chg=${d.pct || 0}%, vol=${d.volume || 'N/A'}`;
        }).join('; ')
      : 'NIFTY 50, BANK NIFTY, GOLD MCX, TCS, RELIANCE (no live data)';

    try {
      const client = new Anthropic({ apiKey });
      const prompt = `You are a technical analyst. Market data: ${dataStr}. In 100 words: identify top 2 potential breakout setups and top 1 trend-following opportunity from this data. Format: "Symbol — setup type — key level — action". Be specific and direct.`;
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      });
      res.json({ scan: msg.content[0].text.trim() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // POST /api/ai/trade-journal
  // Body: { orders: [...] }  orders shape: { symbol, side, qty, price, timestamp, pnl? }
  async tradeJournal(req, res) {
    const { orders = [] } = req.body || {};
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(501).json({ error: 'ANTHROPIC_API_KEY not set' });

    if (!orders.length) {
      return res.json({ journal: 'No trade history to analyze. Place some trades first and come back for a performance review.' });
    }

    const recentTrades = orders.slice(-20).map(o =>
      `${o.side} ${o.qty} ${o.symbol} @ ₹${o.price}${o.pnl !== undefined ? ` P&L=₹${o.pnl}` : ''}`
    ).join('; ');

    try {
      const client = new Anthropic({ apiKey });
      const prompt = `You are a trading coach analyzing trade history of an Indian retail trader. Recent trades (last 20): ${recentTrades}. Total trades: ${orders.length}. In 120 words: identify the top 2 behavioral mistakes, note 1 positive pattern, give 2 specific actionable improvements. Be direct and honest, like a coach.`;
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 350,
        messages: [{ role: 'user', content: prompt }],
      });
      res.json({ journal: msg.content[0].text.trim() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // POST /api/ai/condition
  // Body: { text: "buy when RSI crosses below 30 and EMA 9 above EMA 21, exit at 15:15 or 1.5% SL" }
  // Returns: { condition: { entry: {...}, exit: {...} } }
  async parseCondition(req, res) {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length < 5) {
      return res.status(400).json({ error: 'text field required (min 5 chars)' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(501).json({
        error: 'AI condition builder not configured',
        hint: 'Set ANTHROPIC_API_KEY in .env',
      });
    }

    try {
      const client = new Anthropic({ apiKey });
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT_TEXT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: text }],
      });

      const raw = msg.content[0].text.trim();
      let condition;
      try {
        condition = JSON.parse(raw);
      } catch {
        throw new Error('AI returned non-JSON response: ' + raw.slice(0, 200));
      }

      if (!condition.entry || !condition.exit) {
        throw new Error('AI response missing entry or exit fields');
      }
      if (!validate(condition.entry) || !validate(condition.exit)) {
        throw new Error('AI returned invalid condition schema');
      }

      return res.json({ condition });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // GET /api/ai/indicators
  // Returns supported indicators + operators for frontend condition builder UI
  getIndicators(req, res) {
    res.json({ indicators: SUPPORTED_INDICATORS, operators: OPERATORS });
  },
};

module.exports = aiController;
