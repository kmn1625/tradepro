// futures.controller.js

function lastThursday(year, month) {
  const d = new Date(year, month + 1, 0);
  while (d.getDay() !== 4) d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function getExpiryDates(count = 3) {
  const now = new Date();
  const dates = [];
  let y = now.getFullYear();
  let m = now.getMonth();
  while (dates.length < count) {
    const lt = lastThursday(y, m);
    if (new Date(lt + 'T23:59:59') >= now) dates.push(lt);
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return dates;
}

function daysTo(dateStr) {
  const diff = new Date(dateStr + 'T23:59:59') - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function monthCode(dateStr) {
  const d = new Date(dateStr);
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const dd  = String(d.getDate()).padStart(2, '0');
  const mmm = months[d.getMonth()];
  const yy  = String(d.getFullYear()).slice(-2);
  return `${dd}${mmm}${yy}`;
}

const UNDERLYINGS = [
  { symbol: 'NIFTY',      name: 'Nifty 50',      lotSize: 75,  basePrice: 22453, margin: 140000, segment: 'INDEX' },
  { symbol: 'BANKNIFTY',  name: 'Bank Nifty',     lotSize: 30,  basePrice: 47285, margin: 105000, segment: 'INDEX' },
  { symbol: 'FINNIFTY',   name: 'Fin Nifty',      lotSize: 65,  basePrice: 22100, margin: 95000,  segment: 'INDEX' },
  { symbol: 'MIDCPNIFTY', name: 'MidCap Nifty',   lotSize: 75,  basePrice: 12200, margin: 70000,  segment: 'INDEX' },
  { symbol: 'RELIANCE',   name: 'Reliance Ind.',   lotSize: 250, basePrice: 2840,  margin: 110000, segment: 'STOCK' },
  { symbol: 'TCS',        name: 'TCS',             lotSize: 150, basePrice: 3520,  margin: 82000,  segment: 'STOCK' },
  { symbol: 'INFY',       name: 'Infosys',         lotSize: 300, basePrice: 1420,  margin: 66000,  segment: 'STOCK' },
  { symbol: 'HDFCBANK',   name: 'HDFC Bank',       lotSize: 550, basePrice: 1685,  margin: 145000, segment: 'STOCK' },
];

// Seeded noise so prices don't jump on every request
const _seed = {};
function stableNoise(key) {
  if (!_seed[key]) _seed[key] = (Math.random() - 0.5) * 0.02;
  return _seed[key];
}

function buildContracts() {
  const expiries = getExpiryDates(3);
  const contracts = [];
  for (const u of UNDERLYINGS) {
    for (let i = 0; i < expiries.length; i++) {
      const expiry = expiries[i];
      const mc     = monthCode(expiry);
      const tradingSymbol = `${u.symbol}${mc}FUT`;
      const dte    = daysTo(expiry);
      const noise  = stableNoise(tradingSymbol);
      const ltp    = Math.round(u.basePrice * (1 + noise));
      const change = Math.round((noise * u.basePrice) * 100) / 100;
      const changePct = Math.round(noise * 100 * 100) / 100;
      contracts.push({
        tradingSymbol,
        underlying:    u.symbol,
        name:          u.name,
        segment:       u.segment,
        expiry,
        daysToExpiry:  dte,
        lotSize:       u.lotSize,
        contractValue: ltp * u.lotSize,
        margin:        u.margin,
        ltp,
        change,
        changePct,
        openInterest:  300000 + (u.symbol.length * 37841),
        volume:        120000 + (u.symbol.length * 18420),
        rolloverAlert: dte <= 5,
        expiryType:    i === 0 ? 'near' : i === 1 ? 'mid' : 'far',
      });
    }
  }
  return contracts;
}

class FuturesController {
  getContracts(req, res) {
    try {
      const { symbol, segment } = req.query;
      let contracts = buildContracts();
      if (symbol)  contracts = contracts.filter(c => c.underlying === symbol.toUpperCase());
      if (segment) contracts = contracts.filter(c => c.segment === segment.toUpperCase());
      res.json(contracts);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }

  getExpiries(req, res) {
    try {
      const expiries = getExpiryDates(3).map((e, i) => ({
        expiry: e,
        daysToExpiry: daysTo(e),
        monthCode: monthCode(e),
        type: i === 0 ? 'near' : i === 1 ? 'mid' : 'far',
      }));
      res.json(expiries);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }

  getUnderlyings(req, res) {
    try {
      res.json(UNDERLYINGS.map(u => ({
        symbol: u.symbol, name: u.name, segment: u.segment, lotSize: u.lotSize,
      })));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
}

module.exports = new FuturesController();
