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
  // Added Sep 2026 -- these matched the backend's canonical api/iv_analysis.py
  // SYMBOLS list (Aug 26 2026 batch) but were missing here, so they couldn't
  // be added on the Watchlist page even though the backend captures them fine.
  'PNB','ADANIPOWER','IOC','ASHOKLEY','BANDHANBNK','INDUSTOWER','IREDA',
  'UNIONBANK','AMBUJACEM','BANKINDIA','BHEL','SWIGGY','CROMPTON','VBL',
  'MANAPPURAM','BIOCON','VMM','LICI','LTF','HINDPETRO','SIEMENS',
  // Added Sep 2026 -- phase-1 capacity expansion batch, matches backend's
  // api/iv_analysis.py SYMBOLS.
  'TATAMOTORS','BOSCHLTD','BALKRISIND','APOLLOTYRE','EXIDEIND','LTIM','MPHASIS','LTTS','TATAELXSI','KPITTECH','ALKEM','GLENMARK','ZYDUSLIFE','LAURUSLABS','GRANULES','IPCALAB','AUBANK','RBLBANK','YESBANK','CANFINHOME','LICHSGFIN','PNBHOUSING','MFSL','RVNL','IRCTC','IRFC','CONCOR','NHPC','NLCINDIA','HUDCO','NBCC','NMDC','JINDALSTEL','HINDCOPPER','NATIONALUM','IGL','MGL','PETRONET','GUJGASLTD','ADANIGREEN','ADANIENSOL','TORNTPOWER','JSWENERGY','ACC','DALBHARAT','JKCEMENT','RAMCOCEM','DEEPAKNTR','NAVINFLUOR','AARTIIND','GNFC','UPL','COROMANDEL','SUZLON','IDEA','PVRINOX','KFINTECH','CAMS','ABCAPITAL','ABFRL','KALYANKJIL','RAYMOND','RRKABEL',
].sort()

export const ALL_SYMBOLS = [...INDICES, ...STOCKS]
