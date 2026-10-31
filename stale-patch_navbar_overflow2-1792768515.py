import ast

path = "components/Navbar.tsx"
with open(path) as f:
    content = f.read()

old1 = '''      <nav className="sticky top-0 z-50 border-b border-gray-800/50 bg-[#07070e]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-8">'''

new1 = '''      {/* FIX (Oct 23 2026) cont'd: the inner middle-group fix (min-w-0 +
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
      <nav className="sticky top-0 z-50 border-b border-gray-800/50 bg-[#07070e]/90 backdrop-blur-xl overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-8">'''

assert old1 in content, "nav opening tag not found"
content = content.replace(old1, new1, 1)

old2 = '''          <div className="ml-auto flex items-center gap-2">'''
new2 = '''          <div className="ml-auto flex items-center gap-2 shrink-0">'''
assert old2 in content, "right-side cluster div not found"
content = content.replace(old2, new2, 1)

with open(path.replace(".tsx", "_new.tsx"), "w") as f:
    f.write(content)

print("OK - written")
