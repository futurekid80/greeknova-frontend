import ast

path = "components/Navbar.tsx"
with open(path) as f:
    content = f.read()

old = '''          <div className="flex items-center gap-6">
            {/* Oct 14 2026: new consolidated entry point (see lib/widgetRegistry.ts'''

new = '''          {/* FIX (Oct 23 2026): with Classic menu on, this row (Dashboard +
              Watch Demo + 5 dropdown groups + VIX/Alerts + the toggle itself)
              is wider than most windows at normal widths, and this flex row
              had no wrap/scroll handling -- the overflow just rendered past
              the browser's right edge, silently clipping VIX/Alerts/the
              toggle instead of making them reachable. min-w-0 lets this
              child actually shrink below its content width (flex children
              default to min-width:auto, which is what was forcing the whole
              row wider than the page); overflow-x-auto then makes anything
              that still doesn't fit scrollable in place, so nothing is ever
              truly hidden. The profile/Feedback/VixGauge cluster on the
              right (ml-auto, outside this div) stays pinned and always
              visible either way. */}
          <div className="flex items-center gap-6 min-w-0 overflow-x-auto scrollbar-thin">
            {/* Oct 14 2026: new consolidated entry point (see lib/widgetRegistry.ts'''

assert old in content, "nav middle group opening div not found"
content = content.replace(old, new, 1)

with open(path.replace(".tsx", "_new.tsx"), "w") as f:
    f.write(content)

print("OK - written")
