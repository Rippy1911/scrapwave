// A plain table for the check cards (?bigcheck=1): a head row and rows of cells. A cell that reads "NO" is a
// failed check and shows in red.
export default function CheckTable({ head, rows }) {
  return (
    <table className="tabular-nums">
      <thead>
        <tr className="text-left uppercase tracking-[0.1em] text-[#a8987f]">{head.map((h) => <th key={h} className="pr-3 font-normal">{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, n) => (
          <tr key={n}>{r.map((c, i) => <td key={i} className={c === "NO" ? "pr-3 text-[#ff7a5c]" : "pr-3"}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}