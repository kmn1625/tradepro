'use strict';

// AI condition builder — converts plain English strategy description to condition JSON.
// Uses Claude Haiku (claude-haiku-4-5) via Anthropic SDK.
// TODO: npm install @anthropic-ai/sdk in backend, set ANTHROPIC_API_KEY in .env

const { SUPPORTED_INDICATORS, OPERATORS, validate } = require('../config/conditionSchema');

const SYSTEM_PROMPT = `You are a trading strategy parser. Convert plain English strategy descriptions into a structured JSON condition object.

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
        status: 'COMING_SOON',
      });
    }

    try {
      // TODO: integrate Anthropic SDK
      // const Anthropic = require('@anthropic-ai/sdk');
      // const client = new Anthropic({ apiKey });
      // const msg = await client.messages.create({
      //   model: 'claude-haiku-4-5-20251001',
      //   max_tokens: 1024,
      //   system: SYSTEM_PROMPT,
      //   messages: [{ role: 'user', content: text }],
      // });
      // const raw = msg.content[0].text;
      // const condition = JSON.parse(raw);
      // if (!validate(condition.entry) || !validate(condition.exit)) throw new Error('AI returned invalid condition schema');
      // return res.json({ condition });

      return res.status(501).json({ error: 'Anthropic SDK not yet installed', status: 'COMING_SOON' });
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
