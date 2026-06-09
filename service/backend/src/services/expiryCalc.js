'use strict';

// NSE F&O expiry calculator (P5-R05)
// NIFTY weekly expiry: Thursday (day 4)
// BANKNIFTY weekly expiry: Wednesday (day 3)
// FINNIFTY weekly expiry: Tuesday (day 2)
// 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

const WEEKLY_EXPIRY_DOW = {
  NIFTY:     4,
  BANKNIFTY: 3,
  FINNIFTY:  2,
};

class ExpiryCalc {

  // Nearest upcoming weekly expiry for `underlying` on or after `date`.
  // Returns a Date (midnight UTC of the expiry day).
  getNearestWeeklyExpiry(date, underlying) {
    const target = WEEKLY_EXPIRY_DOW[underlying] ?? 4;
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    const dow = d.getUTCDay();
    let add = target - dow;
    if (add < 0) add += 7;
    d.setUTCDate(d.getUTCDate() + add);
    return d;
  }

  // Last Thursday (or target DOW) of a calendar month — for monthly expiry.
  getMonthlyExpiry(year, month, underlying) {
    const target = WEEKLY_EXPIRY_DOW[underlying] ?? 4;
    const last = new Date(Date.UTC(year, month + 1, 0));  // last day of month
    const dow = last.getUTCDay();
    let diff = dow - target;
    if (diff < 0) diff += 7;
    last.setUTCDate(last.getUTCDate() - diff);
    return last;
  }

  // DTE in years (for Black-Scholes T parameter).
  // Uses calendar days / 365; minimum 1/365 to avoid division-by-zero near expiry.
  getDTE(fromMs, expiryDate) {
    const expiryMs = new Date(expiryDate).getTime();
    const diffMs   = expiryMs - fromMs;
    return Math.max(1 / 365, diffMs / (365 * 24 * 3600 * 1000));
  }

  // Integer calendar days remaining.
  getDaysLeft(fromMs, expiryDate) {
    return Math.max(0, Math.ceil((new Date(expiryDate).getTime() - fromMs) / (24 * 3600 * 1000)));
  }

  // True if the given UTC date string (YYYY-MM-DD) is the expiry day.
  isExpiryDay(dateStr, underlying) {
    const expiry = this.getNearestWeeklyExpiry(dateStr, underlying);
    return expiry.toISOString().slice(0, 10) === dateStr;
  }

  // Check if position should roll: expiry is today and time ≥ force-close threshold (15:20 IST).
  shouldForceClose(candle, expiryDateStr) {
    const istMs     = candle.ts + 5.5 * 3_600_000;
    const istDate   = new Date(istMs);
    const istH      = istDate.getUTCHours();
    const istM      = istDate.getUTCMinutes();
    const dateStr   = istDate.toISOString().slice(0, 10);
    const isExpiry  = dateStr === expiryDateStr;
    const isLateSesh = istH > 15 || (istH === 15 && istM >= 20);
    return isExpiry && isLateSesh;
  }
}

module.exports = new ExpiryCalc();
