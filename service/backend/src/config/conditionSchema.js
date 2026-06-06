'use strict';

// Condition JSON schema used by both AI parser and condition evaluator.
// Entry/exit conditions are trees of AND/OR nodes or leaf indicator nodes.
//
// Example:
// {
//   entry: { AND: [
//     { indicator: 'RSI', period: 14, operator: 'crossesBelow', value: 30 },
//     { indicator: 'EMA', fast: 9, slow: 21, operator: 'crossesAbove' }
//   ]},
//   exit: { OR: [
//     { indicator: 'RSI', operator: 'crossesAbove', value: 70 },
//     { type: 'time', time: '15:15' },
//     { type: 'sl', pct: 1.5 }
//   ]}
// }

const SUPPORTED_INDICATORS = ['RSI', 'MACD', 'EMA', 'SMA', 'BB', 'ATR', 'VWAP', 'SUPERTREND'];

const OPERATORS = ['crossesAbove', 'crossesBelow', 'greaterThan', 'lessThan', 'equals'];

// Returns true if condition node shape is valid (shallow check).
function validate(node) {
  if (!node || typeof node !== 'object') return false;
  if (node.AND || node.OR) {
    const children = node.AND || node.OR;
    return Array.isArray(children) && children.every(validate);
  }
  if (node.type === 'time') return typeof node.time === 'string';
  if (node.type === 'sl' || node.type === 'target') return typeof node.pct === 'number';
  if (node.indicator) {
    return SUPPORTED_INDICATORS.includes(node.indicator) &&
           OPERATORS.includes(node.operator);
  }
  return false;
}

module.exports = { SUPPORTED_INDICATORS, OPERATORS, validate };
