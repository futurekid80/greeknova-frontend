path = "lib/symbols.ts"
text = open(path).read()
new_syms = ["TATAMOTORS","BOSCHLTD","BALKRISIND","APOLLOTYRE","EXIDEIND","LTIM","MPHASIS","LTTS","TATAELXSI","KPITTECH",
"ALKEM","GLENMARK","ZYDUSLIFE","LAURUSLABS","GRANULES","IPCALAB",
"AUBANK","RBLBANK","YESBANK","CANFINHOME","LICHSGFIN","PNBHOUSING","MFSL",
"RVNL","IRCTC","IRFC","CONCOR","NHPC","NLCINDIA","HUDCO","NBCC","NMDC","JINDALSTEL","HINDCOPPER","NATIONALUM",
"IGL","MGL","PETRONET","GUJGASLTD","ADANIGREEN","ADANIENSOL","TORNTPOWER","JSWENERGY",
"ACC","DALBHARAT","JKCEMENT","RAMCOCEM",
"DEEPAKNTR","NAVINFLUOR","AARTIIND","GNFC","UPL","COROMANDEL",
"SUZLON","IDEA","PVRINOX","KFINTECH","CAMS","ABCAPITAL","ABFRL","KALYANKJIL","RAYMOND","RRKABEL"]
assert len(new_syms) == 60, len(new_syms)
addition = "  // Added Sep 2026 -- phase-1 capacity expansion batch (60 stocks), matches\n  // backend's api/iv_analysis.py SYMBOLS.\n  '" + "','".join(new_syms) + "',\n"
marker = "  'MANAPPURAM','BIOCON','VMM','LICI','LTF','HINDPETRO','SIEMENS',\n"
assert marker in text
text = text.replace(marker, marker + addition)
open(path, "w").write(text)
print("ok")
