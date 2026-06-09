// Mock IPO data — replace with NSE/BSE API integration when available

const MOCK_IPOS = [
  {
    id: 1,
    company: 'Ola Electric Mobility',
    symbol: 'OLAELEC',
    priceBand: { min: 72, max: 76 },
    lotSize: 195,
    openDate: '2024-08-02',
    closeDate: '2024-08-06',
    listingDate: '2024-08-09',
    status: 'listed',
    subscriptionTimes: 4.27,
    listingGain: 76,
    category: 'mainboard',
    sector: 'EV / Auto',
    issueSize: '6145 Cr',
    gmp: 12,
  },
  {
    id: 2,
    company: 'Premier Energies',
    symbol: 'PREMIERENE',
    priceBand: { min: 427, max: 450 },
    lotSize: 33,
    openDate: '2024-08-27',
    closeDate: '2024-08-29',
    listingDate: '2024-09-03',
    status: 'listed',
    subscriptionTimes: 74.12,
    listingGain: 119.6,
    category: 'mainboard',
    sector: 'Solar Energy',
    issueSize: '2830 Cr',
    gmp: 0,
  },
  {
    id: 3,
    company: 'Bajaj Housing Finance',
    symbol: 'BAJAJHFL',
    priceBand: { min: 66, max: 70 },
    lotSize: 214,
    openDate: '2024-09-09',
    closeDate: '2024-09-11',
    listingDate: '2024-09-16',
    status: 'listed',
    subscriptionTimes: 63.61,
    listingGain: 114.3,
    category: 'mainboard',
    sector: 'Housing Finance',
    issueSize: '6560 Cr',
    gmp: 0,
  },
  {
    id: 4,
    company: 'Hyundai India',
    symbol: 'HYUNDAI',
    priceBand: { min: 1865, max: 1960 },
    lotSize: 7,
    openDate: '2024-10-15',
    closeDate: '2024-10-17',
    listingDate: '2024-10-22',
    status: 'listed',
    subscriptionTimes: 2.37,
    listingGain: -1.33,
    category: 'mainboard',
    sector: 'Auto',
    issueSize: '27870 Cr',
    gmp: 0,
  },
  {
    id: 5,
    company: 'Swiggy',
    symbol: 'SWIGGY',
    priceBand: { min: 371, max: 390 },
    lotSize: 38,
    openDate: '2024-11-06',
    closeDate: '2024-11-08',
    listingDate: '2024-11-13',
    status: 'listed',
    subscriptionTimes: 3.59,
    listingGain: -7.69,
    category: 'mainboard',
    sector: 'Food Tech',
    issueSize: '11327 Cr',
    gmp: 0,
  },
  {
    id: 6,
    company: 'Vishal Mega Mart',
    symbol: 'VISHALMEGA',
    priceBand: { min: 74, max: 78 },
    lotSize: 192,
    openDate: '2024-12-11',
    closeDate: '2024-12-13',
    listingDate: '2024-12-18',
    status: 'listed',
    subscriptionTimes: 27.27,
    listingGain: 40.38,
    category: 'mainboard',
    sector: 'Retail',
    issueSize: '8000 Cr',
    gmp: 0,
  },
  {
    id: 7,
    company: 'PhysicsWallah (PW)',
    symbol: 'PWEDUCATION',
    priceBand: { min: 0, max: 0 },
    lotSize: 0,
    openDate: '2026-Q3',
    closeDate: '2026-Q3',
    listingDate: 'TBD',
    status: 'upcoming',
    subscriptionTimes: null,
    listingGain: null,
    category: 'mainboard',
    sector: 'EdTech',
    issueSize: '3500 Cr (est)',
    gmp: 80,
  },
  {
    id: 8,
    company: 'Navi Technologies',
    symbol: 'NAVITECH',
    priceBand: { min: 0, max: 0 },
    lotSize: 0,
    openDate: '2026-Q3',
    closeDate: '2026-Q3',
    listingDate: 'TBD',
    status: 'upcoming',
    subscriptionTimes: null,
    listingGain: null,
    category: 'mainboard',
    sector: 'Fintech',
    issueSize: '3350 Cr (est)',
    gmp: 45,
  },
  {
    id: 9,
    company: 'Zepto',
    symbol: 'ZEPTO',
    priceBand: { min: 0, max: 0 },
    lotSize: 0,
    openDate: '2026-Q4',
    closeDate: '2026-Q4',
    listingDate: 'TBD',
    status: 'upcoming',
    subscriptionTimes: null,
    listingGain: null,
    category: 'mainboard',
    sector: 'Quick Commerce',
    issueSize: '4500 Cr (est)',
    gmp: 120,
  },
];

const applications = new Map(); // ipoId → application

exports.listAll = (req, res) => {
  const { status } = req.query;
  const filtered = status
    ? MOCK_IPOS.filter(i => i.status === status)
    : MOCK_IPOS;
  res.json(filtered);
};

exports.getById = (req, res) => {
  const ipo = MOCK_IPOS.find(i => i.id === parseInt(req.params.id));
  if (!ipo) return res.status(404).json({ error: 'IPO not found' });
  res.json(ipo);
};

exports.apply = (req, res) => {
  const { ipoId, qty, upiId } = req.body;
  if (!ipoId || !qty || !upiId) return res.status(400).json({ error: 'ipoId, qty, upiId required' });
  const ipo = MOCK_IPOS.find(i => i.id === parseInt(ipoId));
  if (!ipo) return res.status(404).json({ error: 'IPO not found' });
  if (!['open', 'upcoming'].includes(ipo.status)) {
    return res.status(400).json({ error: 'IPO not open for application' });
  }

  const app = {
    id: Date.now(),
    ipoId: parseInt(ipoId),
    company: ipo.company,
    qty: parseInt(qty),
    price: ipo.priceBand.max || 0,
    upiId,
    amount: parseInt(qty) * (ipo.priceBand.max || 0),
    status: 'pending_upi_mandate',
    appliedAt: new Date().toISOString(),
  };
  applications.set(app.id, app);
  res.json({ success: true, application: app, message: 'UPI mandate sent. Approve in your UPI app within 30 minutes.' });
};

exports.listApplications = (req, res) => {
  res.json(Array.from(applications.values()));
};
