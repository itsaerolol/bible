// Pure SVG, no client JS. The earlier period is drawn in grey, the current period in the accent.
export function Sparkline({ values, split }: { values: Array<number | null>; split?: number }) {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length < 2) return <div className="spark" aria-hidden="true" />;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const n = values.length;
  const X = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const Y = (v: number) => 4 + (1 - (v - min) / (max - min || 1)) * 26;
  const seg = (from: number, to: number) => {
    let d = "";
    let pen = false;
    for (let i = from; i <= to; i++) {
      const v = values[i];
      if (v == null) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${X(i).toFixed(2)} ${Y(v).toFixed(2)}`;
      pen = true;
    }
    return d;
  };
  const s = split ?? 0;
  let last = n - 1;
  while (last > 0 && values[last] == null) last--;
  return (
    <div className="spark" aria-hidden="true">
      <svg viewBox="0 0 100 34" preserveAspectRatio="none">
        {s > 0 && <path d={seg(0, s)} fill="none" stroke="var(--gray-mark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
        <path d={seg(s, n - 1)} fill="none" stroke="var(--s1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="dot" style={{ left: `${X(last)}%`, top: `${(Y(values[last] as number) / 34) * 100}%` }} />
    </div>
  );
}
