path = "app/straddle-chart/page.tsx"
with open(path, "r") as f:
    content = f.read()

old = '''                        {badge && (
                          <span className={`absolute top-3 right-3 text-[9px] font-bold tracking-wide ${badge === 'Decaying fastest' ? 'text-emerald-400' : 'text-gray-500'}`}>
                            {badge.toUpperCase()}
                          </span>
                        )}
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-black text-white">{cs.strike}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: ROLE_COLOR[cs.role], background: `${ROLE_COLOR[cs.role]}1a` }}>
                            {ROLE_LABEL[cs.role]}
                          </span>
                        </div>'''

new = '''                        <div className="flex items-center justify-between mb-2 gap-2">
                          <span className="font-black text-white">{cs.strike}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {badge && (
                              <span className={`text-[9px] font-bold tracking-wide whitespace-nowrap ${badge === 'Decaying fastest' ? 'text-emerald-400' : 'text-gray-500'}`}>
                                {badge.toUpperCase()}
                              </span>
                            )}
                            <span className="text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap" style={{ color: ROLE_COLOR[cs.role], background: `${ROLE_COLOR[cs.role]}1a` }}>
                              {ROLE_LABEL[cs.role]}
                            </span>
                          </div>
                        </div>'''

assert old in content, "old block not found"
content = content.replace(old, new, 1)

with open("app/straddle-chart/page_new.tsx", "w") as f:
    f.write(content)
print("OK - written to app/straddle-chart/page_new.tsx")
