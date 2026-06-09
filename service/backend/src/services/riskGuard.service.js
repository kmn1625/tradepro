// riskGuard.service.js — in-memory risk gate, resets daily

class RiskGuardService {
  constructor() {
    this.settings = {
      maxLossPerDay:       10000,
      maxTradesPerDay:     20,
      capitalProtectionPct: 10,
    };
    this.state = {
      dailyPnL:      0,
      tradesCount:   0,
      triggered:     false,
      triggerReason: null,
      lastReset:     new Date().toDateString(),
    };
    this.positionSettings = {};
    this.broadcast = null;
  }

  _resetIfNewDay() {
    const today = new Date().toDateString();
    if (this.state.lastReset !== today) {
      this.state = {
        dailyPnL: 0, tradesCount: 0, triggered: false,
        triggerReason: null, lastReset: today,
      };
    }
  }

  init(broadcastFn) {
    this.broadcast = broadcastFn;
  }

  configure(settings) {
    if (settings.maxLossPerDay      !== undefined) this.settings.maxLossPerDay      = Number(settings.maxLossPerDay);
    if (settings.maxTradesPerDay    !== undefined) this.settings.maxTradesPerDay    = Number(settings.maxTradesPerDay);
    if (settings.capitalProtectionPct !== undefined) this.settings.capitalProtectionPct = Number(settings.capitalProtectionPct);
    return this.getStatus();
  }

  _canTrade() {
    if (this.state.triggered) return { allowed: false, reason: this.state.triggerReason };
    if (this.state.dailyPnL <= -this.settings.maxLossPerDay)
      return { allowed: false, reason: `Max daily loss ₹${this.settings.maxLossPerDay} breached` };
    if (this.state.tradesCount >= this.settings.maxTradesPerDay)
      return { allowed: false, reason: `Max ${this.settings.maxTradesPerDay} trades/day reached` };
    return { allowed: true, reason: null };
  }

  getStatus() {
    this._resetIfNewDay();
    const { allowed, reason } = this._canTrade();
    return {
      settings: { ...this.settings },
      state:    { ...this.state },
      canTrade: allowed,
      reason,
      positionSettings: { ...this.positionSettings },
    };
  }

  recordTrade(pnl = 0) {
    this._resetIfNewDay();
    this.state.dailyPnL    += pnl;
    this.state.tradesCount += 1;
    const { allowed, reason } = this._canTrade();
    if (!allowed && !this.state.triggered) {
      this.state.triggered     = true;
      this.state.triggerReason = reason;
      if (this.broadcast) {
        this.broadcast({ type: 'RISK_GUARD_TRIGGERED', reason, timestamp: new Date().toISOString() });
      }
    }
    return this.getStatus();
  }

  setPositionSettings(symbol, settings) {
    this.positionSettings[symbol] = { ...(this.positionSettings[symbol] || {}), ...settings };
    return this.positionSettings[symbol];
  }

  getPositionSettings(symbol) {
    return this.positionSettings[symbol] || null;
  }

  resetDay() {
    this.state = {
      dailyPnL: 0, tradesCount: 0, triggered: false,
      triggerReason: null, lastReset: new Date().toDateString(),
    };
    return this.getStatus();
  }
}

module.exports = new RiskGuardService();
