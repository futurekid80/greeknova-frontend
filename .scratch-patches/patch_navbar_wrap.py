import ast

path = "components/Navbar.tsx"
with open(path) as f:
    content = f.read()

old = '''      {/* FIX (Oct 23 2026) cont'd: the inner middle-group fix (min-w-0 +
          overflow-x-auto a few lines down) only contained THAT child's own
          overflow -- this outer row had no boundary of its own, so when the
          middle group's natural content width still exceeded the space
          available next to the right-side (ml-auto) cluster, the excess
          bled out of this row entirely and became page-level horizontal
          scroll (the whole nav, logo included, scrolled instead of just the
          one section meant to). overflow-x-hidden here is the actual
          boundary: nothing can escape this row and drag the rest of the
          page sideways with it; shrink-0 on the right-side cluster below
          keeps VIX/Feedback/profile from ever being squeezed to fit. */}
      <nav className="sticky top-0 z-50 border-b border-gray-800/50 bg-[#07070e]/90 backdrop-blur-xl overflow-x-hidden">'''

new = '''      {/* FIX (Oct 23 2026, 3rd pass): the two overflow-x fixes above this
          (clipping the outer row, then scrolling the middle group) both
          backfired the same way -- the Scanners/Market/Open Interest
          dropdown panels render as position:absolute children inside this
          row, and giving any ancestor overflow-x:auto or overflow-x:hidden
          forces the browser to clip overflow-y too (that's how the CSS
          overflow property works -- you can't scroll/hide one axis and
          leave the other visible), so every dropdown panel got clipped or
          squashed into a sliver instead of opening normally. Switching to
          flex-wrap below instead: nothing is ever clipped, so dropdowns
          always render in full; on a narrow window the nav just wraps to a
          second line instead of hiding or cutting anything off. */}
      <nav className="sticky top-0 z-50 border-b border-gray-800/50 bg-[#07070e]/90 backdrop-blur-xl">'''

assert old in content, "nav tag block not found"
content = content.replace(old, new)

old2 = '''          {/* FIX (Oct 23 2026): with Classic menu on, this row (Dashboard +
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
          <div className="flex items-center gap-6 min-w-0 overflow-x-auto">'''

new2 = '''          {/* FIX (Oct 23 2026, 3rd pass): wraps to a second line instead
              of scrolling or clipping -- see the note on <nav> above for why
              overflow-x-auto had to go (it was clipping the dropdown panels
              that live inside this row). py-2 gives the wrapped second line
              breathing room against the row above it. */}
          <div className="flex items-center gap-6 flex-wrap py-2">'''

assert old2 in content, "middle group div not found"
content = content.replace(old2, new2)

with open(path.replace(".tsx", "_new.tsx"), "w") as f:
    f.write(content)

print("OK - replaced")
