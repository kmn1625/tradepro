'use strict';

const NEWS = [
  { id: 1,  symbol: 'RELIANCE',  headline: 'Reliance Jio Acquires 5G Spectrum in 13 Circles',                       source: 'Economic Times',   time: '2 hours ago',  category: 'Corporate',  sentiment: 'positive' },
  { id: 2,  symbol: 'NIFTY50',   headline: 'Nifty scales new high on FII buying; IT and Banking lead rally',         source: 'Moneycontrol',     time: '3 hours ago',  category: 'Market',     sentiment: 'positive' },
  { id: 3,  symbol: 'HDFCBANK',  headline: 'HDFC Bank Q4 Net Profit beats estimate at ₹16,512 Cr',                  source: 'Business Standard', time: '5 hours ago',  category: 'Earnings',   sentiment: 'positive' },
  { id: 4,  symbol: 'INFY',      headline: 'Infosys FY26 revenue guidance revised upward to 4.5–6.5%',              source: 'Reuters',          time: '1 day ago',    category: 'Earnings',   sentiment: 'positive' },
  { id: 5,  symbol: 'RBI',       headline: 'RBI holds repo rate at 6.5% in June policy review',                     source: 'RBI Official',     time: '1 day ago',    category: 'Macro',      sentiment: 'neutral'  },
  { id: 6,  symbol: 'TATASTEEL', headline: 'Tata Steel UK unit reports quarterly loss on weak demand',               source: 'Bloomberg',        time: '1 day ago',    category: 'Corporate',  sentiment: 'negative' },
  { id: 7,  symbol: 'SBIN',      headline: 'SBI launches ₹20,000 Cr QIP to shore up capital',                       source: 'Mint',             time: '2 days ago',   category: 'Corporate',  sentiment: 'neutral'  },
  { id: 8,  symbol: 'GOLD',      headline: 'Gold prices at record ₹73,500/10g on safe-haven demand',                source: 'MCX',              time: '2 days ago',   category: 'Commodity',  sentiment: 'positive' },
  { id: 9,  symbol: 'TCS',       headline: 'TCS announces 1:1 bonus share; ex-date set for June 10',                source: 'NSE',              time: '2 days ago',   category: 'Corporate',  sentiment: 'positive' },
  { id: 10, symbol: 'CRUDEOIL',  headline: 'Crude slips below $78 on demand concerns from China PMI miss',          source: 'Bloomberg',        time: '3 days ago',   category: 'Commodity',  sentiment: 'negative' },
  { id: 11, symbol: 'WIPRO',     headline: 'Wipro announces 1:5 stock split; effective June 18',                    source: 'BSE',              time: '3 days ago',   category: 'Corporate',  sentiment: 'positive' },
  { id: 12, symbol: 'NIFTY50',   headline: 'India GDP growth at 7.2% in Q4 FY26; beats 7.0% estimate',             source: 'MOSPI',            time: '4 days ago',   category: 'Macro',      sentiment: 'positive' },
];

const EARNINGS = [
  { date: '2026-06-10', symbol: 'TCS',      event: 'Q4 FY26 Results', estimate: 'EPS ₹30.50',  time: 'Post-market' },
  { date: '2026-06-11', symbol: 'WIPRO',    event: 'Q4 FY26 Results', estimate: 'EPS ₹6.80',   time: 'Pre-market'  },
  { date: '2026-06-12', symbol: 'INFY',     event: 'Dividend Ex-Date', estimate: '₹21 per share', time: 'EOD'       },
  { date: '2026-06-15', symbol: 'HDFCBANK', event: 'AGM',             estimate: '',             time: '11:00 AM'    },
  { date: '2026-06-18', symbol: 'RELIANCE', event: 'Q4 FY26 Results', estimate: 'EPS ₹64.20',  time: 'Post-market' },
  { date: '2026-06-20', symbol: 'SBIN',     event: 'Board Meeting',   estimate: 'Rights Issue', time: '3:00 PM'     },
  { date: '2026-06-25', symbol: 'AXISBANK', event: 'Q4 FY26 Results', estimate: 'EPS ₹22.50',  time: 'Post-market' },
  { date: '2026-06-30', symbol: 'ICICIBANK', event: 'Q4 FY26 Results', estimate: 'EPS ₹18.90', time: 'Post-market' },
];

const ECONOMIC = [
  { date: '2026-06-10', event: 'India CPI Inflation',   forecast: '4.2%',        previous: '4.8%',        importance: 'High'   },
  { date: '2026-06-12', event: 'India IIP Data',        forecast: '5.1%',        previous: '4.9%',        importance: 'Medium' },
  { date: '2026-06-18', event: 'US FOMC Decision',      forecast: 'Hold 5.25%',  previous: '5.25%',       importance: 'High'   },
  { date: '2026-06-20', event: 'India WPI Inflation',   forecast: '1.8%',        previous: '2.1%',        importance: 'Medium' },
  { date: '2026-06-25', event: 'US GDP Q1 2026',        forecast: '2.8%',        previous: '3.2%',        importance: 'High'   },
  { date: '2026-06-27', event: 'India Fiscal Deficit',  forecast: '5.1% of GDP', previous: '5.6% of GDP', importance: 'Medium' },
  { date: '2026-06-30', event: 'India GST Collections', forecast: '₹1.85L Cr',   previous: '₹1.82L Cr',   importance: 'Medium' },
];

const CORPORATE_ACTIONS = [
  { date: '2026-06-10', symbol: 'TCS',      action: 'Bonus Issue',   details: '1:1 bonus shares',      exDate: '2026-06-10' },
  { date: '2026-06-12', symbol: 'INFY',     action: 'Dividend',      details: '₹21/share (Final)',      exDate: '2026-06-12' },
  { date: '2026-06-15', symbol: 'HDFCBANK', action: 'Dividend',      details: '₹19.50/share',           exDate: '2026-06-15' },
  { date: '2026-06-18', symbol: 'WIPRO',    action: 'Stock Split',   details: '1:5 split',              exDate: '2026-06-18' },
  { date: '2026-06-20', symbol: 'SBIN',     action: 'Rights Issue',  details: '1:15 at ₹780',           exDate: '2026-06-20' },
  { date: '2026-06-22', symbol: 'RELIANCE', action: 'Rights Issue',  details: '1:15 at ₹1,222',         exDate: '2026-06-22' },
  { date: '2026-06-25', symbol: 'TATAMOTORS', action: 'Dividend',    details: '₹6/share',               exDate: '2026-06-25' },
];

// GET /api/news
exports.getNews = (req, res) => {
  const { symbol, category } = req.query;
  let news = NEWS;
  if (symbol)   news = news.filter(n => n.symbol.toUpperCase().includes(symbol.toUpperCase()));
  if (category) news = news.filter(n => n.category === category);
  res.json(news);
};

// GET /api/news/earnings
exports.getEarnings = (req, res) => res.json(EARNINGS);

// GET /api/news/economic
exports.getEconomic = (req, res) => res.json(ECONOMIC);

// GET /api/news/corporate-actions
exports.getCorporateActions = (req, res) => {
  const { symbol } = req.query;
  const actions = symbol
    ? CORPORATE_ACTIONS.filter(a => a.symbol.toUpperCase() === symbol.toUpperCase())
    : CORPORATE_ACTIONS;
  res.json(actions);
};
