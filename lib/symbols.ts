// Shared symbol universe — single source of truth.
// Added Jul 22 2026: every page up to this point (dashboard search, sector
// map, OI Profile, OI Heatmap, OI History, EOD, Ask, Watchlist) maintains
// its own separate hardcoded copy of this list, which is exactly why it
// kept drifting out of sync (missing new symbols, delisted tickers left
// in). New pages should import from here instead of adding another copy.
// Existing pages can be migrated to this file in a future cleanup pass.

export const INDICES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY']

export const STOCKS = [
  'RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','HINDUNILVR','ITC','SBIN',
  'BHARTIARTL','KOTAKBANK','LT','AXISBANK','ASIANPAINT','MARUTI','TITAN',
  'SUNPHARMA','ULTRACEMCO','BAJFINANCE','WIPRO','HCLTECH','TATACONSUM',
  'TATASTEEL','ADANIENT','POWERGRID','NTPC','ONGC','JSWSTEEL','COALINDIA',
  'BAJAJFINSV','TECHM','APOLLOHOSP','BAJAJ-AUTO','BPCL','BRITANNIA','CIPLA',
  'DRREDDY','EICHERMOT','GRASIM','HEROMOTOCO','HINDALCO','HDFCLIFE',
  'INDUSINDBK','JIOFIN','M&M','NESTLEIND','SBILIFE','SHRIRAMFIN','TRENT',
  'ADANIPORTS','BANKBARODA','BEL','CANBK','CHOLAFIN','DLF','GAIL',
  'HAVELLS','HAL','INDIGO','PFC','RECLTD','SAIL','TATAPOWER','VEDL',
  'DIXON','NYKAA','PAYTM','PERSISTENT',
  'BSE','MCX','TMPV','GODREJPROP','DIVISLAB','COFORGE','ANGELONE','CDSL','OIL',
  'TVSMOTOR','BHARATFORG','MOTHERSON','LUPIN','TORNTPHARM','AUROPHARMA',
  'GODREJCP','MARICO','DABUR','PIDILITIND','MUTHOOTFIN','SBICARD','ICICIPRULI',
  'IDFCFIRSTB','FEDERALBNK','ETERNAL','POLYCAB','VOLTAS','IEX','ASTRAL',
].sort()

export const ALL_SYMBOLS = [...INDICES, ...STOCKS]
