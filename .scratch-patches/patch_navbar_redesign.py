path = "components/Navbar.tsx"
with open(path) as f:
    content = f.read()

# 1) Insert MegaMenu component after DropdownMenu's closing brace, before Feedback Modal.
old1 = '''         </div>
        </div>
      )}
    </div>
  )
}

// ─── Feedback Modal ───────────────────────────────────────────────────────────'''
# The exact original has different indentation levels per real file -- rebuild from
# known-good anchor text instead (safer than re-typing whitespace from memory).
anchor1 = "// ─── Feedback Modal ───────────────────────────────────────────────────────────"
assert anchor1 in content, "Feedback Modal anchor not found"

mega_menu = '''// ─── Mega Menu (Oct 23 2026, nav redesign) ────────────────────────────────────
// Replaces the old one-trigger-per-group row (Scanners / Market / Open
// Interest / Positional / Intraday / Option Sellers, six separate dropdown
// buttons) with a single "All Tools" trigger that opens one wide panel with
// all six as labeled columns. Same links, same hrefs, nothing moved or
// removed -- this only collapses how many buttons sit in the nav row so
// Classic menu fits on one line instead of wrapping to three. Columns wrap
# responsively (grid-cols-2 below ~900px of panel width) rather than
// overflowing off the right edge of the screen.
function MegaMenu({ groups, active }: { groups: typeof NAV_GROUPS, active: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const isActive = groups.some(g => g.links.some(l =>
    l.href === '/' ? active === '/' : active.startsWith(l.href)
  ))

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 text-sm font-medium transition-colors px-1 py-0.5 rounded whitespace-nowrap ${
          isActive ? 'text-white' : 'text-gray-400 hover:text-white'
        }`}>
        🗂️ All Tools
        <ChevronDown size={13} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        {isActive && <span className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-3 w-[min(92vw,840px)] max-h-[75vh] overflow-y-auto bg-gray-950 border border-gray-800 rounded-xl shadow-2xl z-50 p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 px-2 mb-1">
                  {group.label}
                </p>
                <div>
                  {group.links.map(({ href, label }) => {
                    const isLinkActive = href === '/' ? active === '/' : active.startsWith(href)
                    return (
                      <Link key={href} href={href} onClick={() => setOpen(false)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                          isLinkActive
                            ? 'text-white bg-gray-800/60 font-semibold'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLinkActive ? 'bg-emerald-400' : ''}`} />
                        {label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

''' + anchor1

content = content.replace(anchor1, mega_menu, 1)

# 2) Replace the six-dropdown + STANDALONE render block with a single MegaMenu,
#    and drop the in-row "Classic menu" toggle button (moved into UserMenu).
old2 = '''            {classicNav && (
              <>
                {NAV_GROUPS.map((group) => (
                  <DropdownMenu key={group.label} group={group} active={active} />
                ))}
                {STANDALONE.map(({ href, label }) => (
                  <Link key={href} href={href}
                    className={`text-sm font-medium transition-colors whitespace-nowrap relative ${
                      active.startsWith(href) ? 'text-white' : 'text-gray-400 hover:text-white'
                    }`}>
                    {label}
                    {active.startsWith(href) && <span className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />}
                  </Link>
                ))}
              </>
            )}
            <button
              onClick={toggleClassicNav}
              title={classicNav ? 'Switch to the consolidated Dashboard menu' : 'Switch to the old full dropdown menu'}
              className="text-xs font-medium text-gray-600 hover:text-gray-300 transition-colors whitespace-nowrap">
              {classicNav ? '✕ Classic menu' : '☰ Classic menu'}
            </button>
          </div>'''
new2 = '''            {classicNav && <MegaMenu groups={NAV_GROUPS} active={active} />}
          </div>'''
assert old2 in content, "render block not found"
content = content.replace(old2, new2)

# 3) UserMenu: accept classicNav + onToggleClassicNav props.
old3 = "function UserMenu() {"
new3 = "function UserMenu({ classicNav, onToggleClassicNav }: { classicNav: boolean, onToggleClassicNav: () => void }) {"
assert old3 in content
content = content.replace(old3, new3)

# 4) UserMenu: add the classic-menu toggle as a menu item, between Journal and Sign Out.
old4 = '''          <Link href="/journal" onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800/40 transition-colors">
            <span>📓</span> My Journal
          </Link>
          <button
            onClick={handleLogout}'''
new4 = '''          <Link href="/journal" onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800/40 transition-colors">
            <span>📓</span> My Journal
          </Link>
          <button
            onClick={() => { onToggleClassicNav(); setOpen(false) }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800/40 transition-colors border-t border-gray-800">
            <span>{classicNav ? '📥' : '🗂️'}</span>
            {classicNav ? 'Switch to simple menu' : 'Switch to full menu'}
          </button>
          <button
            onClick={handleLogout}'''
assert old4 in content, "UserMenu journal/logout block not found"
content = content.replace(old4, new4)

# 5) Pass the props at the call site.
old5 = "            <UserMenu />"
new5 = "            <UserMenu classicNav={classicNav} onToggleClassicNav={toggleClassicNav} />"
assert old5 in content
content = content.replace(old5, new5)

with open(path.replace(".tsx", "_new.tsx"), "w") as f:
    f.write(content)
print("OK")
