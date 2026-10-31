import ast, re

path = "app/signals/cpr/page.tsx"
with open(path) as f:
    content = f.read()

old1 = '''interface CPRData {
  data: CPRRow[]; total: number; trade_date: string
  confluence_count: number; narrow_count: number; source: string
}'''

new1 = '''interface CPRData {
  data: CPRRow[]; total: number; trade_date: string
  confluence_count: number; narrow_count: number; source: string
  expected_date?: string; is_stale?: boolean
}'''

assert old1 in content, "CPRData interface not found"
content = content.replace(old1, new1, 1)

old2 = '''            {data?.trade_date && (
              <div className="text-xs bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-400">
                Trade date: {data.trade_date}
                {data.source === 'live' && <span className="text-amber-400 ml-1">(live fallback)</span>}
              </div>
            )}'''

new2 = '''            {data?.trade_date && (
              <div className={`text-xs border rounded-lg px-3 py-2 ${data.is_stale ? 'bg-amber-950/40 border-amber-700 text-amber-300' : 'bg-gray-900 border-gray-700 text-gray-400'}`}>
                Data as of: {data.trade_date}
                {data.source === 'live' && <span className="text-amber-400 ml-1">(live fallback)</span>}
                {data.is_stale && (
                  <span className="ml-1.5 font-semibold">
                    ⚠️ Stale — expected {data.expected_date}
                  </span>
                )}
              </div>
            )}'''

assert old2 in content, "trade date badge not found"
content = content.replace(old2, new2, 1)

with open(path.replace(".tsx", "_new.tsx"), "w") as f:
    f.write(content)

print("OK - written")
