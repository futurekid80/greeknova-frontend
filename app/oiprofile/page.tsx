// REPLACE the entire wall migration LineChart section in app/oiprofile/page.tsx
// Find: <ResponsiveContainer width="100%" height={320}>
// Replace that entire ResponsiveContainer block with this:

<ResponsiveContainer width="100%" height={320}>
  <LineChart data={data.wall_migration} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false}
      tickFormatter={fmtDate}/>
    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false}
      domain={['auto', 'auto']}
      tickFormatter={v => v.toLocaleString()}/>
    <Tooltip content={<MigrationTooltip/>}/>
    <Line type="monotone" dataKey="ce_wall" name="CE Wall (Resistance)"
      stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }}
      activeDot={{ r: 5 }} connectNulls/>
    <Line type="monotone" dataKey="pe_wall" name="PE Wall (Support)"
      stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }}
      activeDot={{ r: 5 }} connectNulls/>
    <Line type="monotone" dataKey="cmp" name="Price"
      stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 3"
      dot={{ fill: '#f59e0b', r: 2 }} activeDot={{ r: 4 }}
      connectNulls/>
  </LineChart>
</ResponsiveContainer>

// ALSO update the legend text below the chart (find the <p> tag with the legend):
// Add this line to the legend paragraph:
// · <span className="text-amber-400">── Price (CMP)</span> = closing price each day
