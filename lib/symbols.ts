// Shared symbol universe — single source of truth.
// Every page (dashboard search, sector map, OI Profile, OI Heatmap,
// OI History, EOD, Ask, Watchlist, Journal, Historical Chain) imports
// ALL_SYMBOLS/STOCKS/INDICES from here.
//
// Sep 18 2026: this used to be a hand-copied static snapshot that silently
// drifted out of sync with the backend's live F&O universe (new stocks like
// INDHOTEL/NAUKRI missing, delisted ones like RAYMONDLSL still listed).
// Now it fetches the live universe from the backend's /symbols endpoint on
// load and mutates these arrays in place, so every importer picks up the
// live list automatically with zero changes on their end. The lists below
// are only the bundled fallback -- used until that fetch resolves, or if
// it fails outright (offline, backend down, etc).

export const INDICES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY']

// Fallback only -- regenerated Sep 18 2026 from the confirmed-live backend
// F&O universe. Kept only as a safety net; the live fetch below is the
// real source of truth from here on.
const FALLBACK_STOCKS = [
  '360ONE','ABB','ABCAPITAL','ADANIENSOL','ADANIENT','ADANIGREEN','ADANIPORTS',
  'ADANIPOWER','ALKEM','AMBER','AMBUJACEM','ANGELONE','APLAPOLLO','APOLLOHOSP',
  'ASHOKLEY','ASIANPAINT','ASTRAL','ATHERENERG','AUBANK','AUROPHARMA','AXISBANK',
  'BAJAJ-AUTO','BAJAJFINSV','BAJAJHLDNG','BAJFINANCE','BANDHANBNK','BANKBARODA',
  'BANKINDIA','BDL','BEL','BHARATFORG','BHARTIARTL','BHEL','BIOCON','BLUESTARCO',
  'BOSCHLTD','BPCL','BRITANNIA','BSE','CAMS','CANBK','CDSL','CGPOWER','CHOLAFIN',
  'CIPLA','COALINDIA','COCHINSHIP','COFORGE','COLPAL','CONCOR','CROMPTON',
  'CUMMINSIND','DABUR','DELHIVERY','DIVISLAB','DIXON','DLF','DMART','DRREDDY',
  'EICHERMOT','ETERNAL','FEDERALBNK','FORCEMOT','FORTIS','GAIL','GLENMARK',
  'GMRAIRPORT','GODFRYPHLP','GODREJCP','GODREJPROP','GRASIM','GVT&D','HAL',
  'HAVELLS','HCLTECH','HDFCAMC','HDFCBANK','HDFCLIFE','HEROMOTOCO','HINDALCO',
  'HINDPETRO','HINDUNILVR','HINDZINC','HYUNDAI','ICICIBANK','ICICIGI','ICICIPRULI',
  'IDEA','IDFCFIRSTB','IEX','INDHOTEL','INDIANB','INDIGO','INDUSINDBK',
  'INDUSTOWER','INFY','INOXWIND','IOC','IREDA','IRFC','ITC','JINDALSTEL','JIOFIN',
  'JSWENERGY','JSWSTEEL','JUBLFOOD','KALYANKJIL','KAYNES','KEI','KFINTECH',
  'KOTAKBANK','KPITTECH','LAURUSLABS','LICHSGFIN','LICI','LODHA','LT','LTF','LTM',
  'LUPIN','M&M','MAHABANK','MANAPPURAM','MANKIND','MARICO','MARUTI','MAXHEALTH',
  'MAZDOCK','MCX','MFSL','MOTHERSON','MOTILALOFS','MPHASIS','MUTHOOTFIN',
  'NAM-INDIA','NATIONALUM','NAUKRI','NBCC','NESTLEIND','NHPC','NMDC','NTPC',
  'NYKAA','OBEROIRLTY','OFSS','OIL','ONGC','PAGEIND','PATANJALI','PAYTM',
  'PERSISTENT','PETRONET','PFC','PGEL','PHOENIXLTD','PIDILITIND','PIIND','PNB',
  'PNBHOUSING','POLICYBZR','POLYCAB','POWERGRID','POWERINDIA','PREMIERENE',
  'PRESTIGE','RADICO','RBLBANK','RECLTD','RELIANCE','RVNL','SAGILITY','SAIL',
  'SBICARD','SBILIFE','SBIN','SHREECEM','SHRIRAMFIN','SIEMENS','SOLARINDS',
  'SONACOMS','SRF','SUNPHARMA','SUPREMEIND','SUZLON','SWIGGY','TATACONSUM',
  'TATAELXSI','TATAPOWER','TATASTEEL','TCS','TECHM','TIINDIA','TITAN','TMPV',
  'TORNTPHARM','TRENT','TVSMOTOR','ULTRACEMCO','UNIONBANK','UNITDSPR','UNOMINDA',
  'UPL','VBL','VEDL','VMM','VOLTAS','WAAREEENER','WIPRO','YESBANK','ZYDUSLIFE',
].sort()

// Live, mutable exports -- consumers keep importing these same names.
// Start out as the fallback; get overwritten in place once the live fetch
// below resolves (arrays are mutated, not reassigned, so every importer's
// reference stays valid and up to date).
export const STOCKS: string[] = [...FALLBACK_STOCKS]
export const ALL_SYMBOLS: string[] = [...INDICES, ...STOCKS]

// Fallback only -- NSE lot sizes as of Sep 18 2026, used until the live
// fetch below resolves or if it fails. NSE revises these quarterly, which
// is exactly why the live fetch (from Kite's own instrument data via the
// backend) is the real source of truth from here on, not this list.
const FALLBACK_LOT_SIZES: Record<string, number> = {
  NIFTY: 65, BANKNIFTY: 30, FINNIFTY: 60,
  RELIANCE: 500, TCS: 225, HDFCBANK: 650, INFY: 400, ICICIBANK: 700,
  HINDUNILVR: 300, ITC: 1725, SBIN: 750, BHARTIARTL: 475,
  KOTAKBANK: 2000, LT: 175, AXISBANK: 625, ASIANPAINT: 250,
  MARUTI: 50, TITAN: 175, SUNPHARMA: 350, ULTRACEMCO: 50,
  BAJFINANCE: 750, WIPRO: 3000, HCLTECH: 350, TATACONSUM: 550,
  TATASTEEL: 2750, ADANIENT: 309, POWERGRID: 1900, NTPC: 1500,
  ONGC: 2250, JSWSTEEL: 675, COALINDIA: 1350, BAJAJFINSV: 250,
  TECHM: 600, APOLLOHOSP: 125, 'BAJAJ-AUTO': 75, BPCL: 1975,
  BRITANNIA: 125, CIPLA: 425, DRREDDY: 625, EICHERMOT: 100,
  GRASIM: 250, HEROMOTOCO: 150, HINDALCO: 700, HDFCLIFE: 1100,
  INDUSINDBK: 700, JIOFIN: 2350, 'M&M': 200, NESTLEIND: 500,
  SBILIFE: 375, SHRIRAMFIN: 825, TRENT: 225, ADANIPORTS: 475,
  BANKBARODA: 2925, BEL: 1425, CANBK: 6750, CHOLAFIN: 625,
  DLF: 950, GAIL: 3550, HAVELLS: 500, HAL: 150, INDIGO: 150,
  PFC: 1300, RECLTD: 1575, SAIL: 4700, TATAPOWER: 1450, VEDL: 1150,
  PAYTM: 725, NYKAA: 3125, PERSISTENT: 100, DIXON: 50,
  BSE: 100, MCX: 75, TMPV: 1425, GODREJPROP: 475,
  DIVISLAB: 150, COFORGE: 150, ANGELONE: 250, CDSL: 1500, OIL: 1900,
}

// Live, mutable export -- consumers get the same object reference, its
// contents get replaced in place once the live fetch resolves.
export const LOT_SIZES: Record<string, number> = { ...FALLBACK_LOT_SIZES }

export function getLotSize(symbol: string): number {
  return LOT_SIZES[symbol] || 500
}

const API = 'https://api.greeknova.com'

function applyLiveStocks(liveStocks: string[]) {
  const sorted = [...new Set(liveStocks)].sort()
  STOCKS.length = 0
  STOCKS.push(...sorted)
  ALL_SYMBOLS.length = 0
  ALL_SYMBOLS.push(...INDICES, ...STOCKS)
}

if (typeof window !== 'undefined') {
  fetch(`${API}/symbols`)
    .then(res => (res.ok ? res.json() : Promise.reject(new Error(`/symbols returned ${res.status}`))))
    .then((data: { stocks?: string[]; lot_sizes?: Record<string, number> }) => {
      if (Array.isArray(data.stocks) && data.stocks.length > 0) {
        applyLiveStocks(data.stocks)
      }
      if (data.lot_sizes && Object.keys(data.lot_sizes).length > 0) {
        Object.assign(LOT_SIZES, data.lot_sizes)
      }
    })
    .catch(err => {
      // Bundled fallback list stays in place -- stale is far better than empty.
      console.warn('[symbols] live /symbols fetch failed, using bundled fallback list:', err)
    })
}
