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
