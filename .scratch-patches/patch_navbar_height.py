path = "components/Navbar.tsx"
with open(path) as f:
    content = f.read()

old = '''      <nav className="sticky top-0 z-50 border-b border-gray-800/50 bg-[#07070e]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-8">'''
new = '''      <nav className="sticky top-0 z-50 border-b border-gray-800/50 bg-[#07070e]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 min-h-14 flex items-center gap-8">'''
assert old in content
content = content.replace(old, new)

old2 = '''            <Link href="/dashboard"
              className={`text-sm font-semibold transition-colors relative ${
                active === '/dashboard' ? 'text-white' : 'text-emerald-400 hover:text-emerald-300'
              }`}>'''
new2 = '''            <Link href="/dashboard"
              className={`text-sm font-semibold transition-colors relative shrink-0 whitespace-nowrap ${
                active === '/dashboard' ? 'text-white' : 'text-emerald-400 hover:text-emerald-300'
              }`}>'''
assert old2 in content
content = content.replace(old2, new2)

old3 = '''            <Link href="/demo"
              className={`text-sm font-semibold transition-colors relative ${
                active === '/demo' ? 'text-white' : 'text-cyan-400 hover:text-cyan-300'
              }`}>'''
new3 = '''            <Link href="/demo"
              className={`text-sm font-semibold transition-colors relative shrink-0 whitespace-nowrap ${
                active === '/demo' ? 'text-white' : 'text-cyan-400 hover:text-cyan-300'
              }`}>'''
assert old3 in content
content = content.replace(old3, new3)

with open(path.replace(".tsx", "_new.tsx"), "w") as f:
    f.write(content)
print("OK")
