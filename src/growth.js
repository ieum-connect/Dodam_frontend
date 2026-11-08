// Use calendar dates in UTC so daylight saving and browser timezone do not shift measurements.
export const stamp = date => Date.parse(`${date}T00:00:00Z`);
export function growthRange(months, end, records = []) {
  const date = new Date(stamp(end));
  let from;
  if (months) {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - months);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
    from = date.toISOString().slice(0, 10);
  } else {
    from = records.reduce((earliest, row) => row.measuredOn < earliest ? row.measuredOn : earliest, end);
  }
  // A single-day history still needs a meaningful horizontal axis.
  if (from === end) from = new Date(stamp(end) - 86400000).toISOString().slice(0, 10);
  return { from, to: end };
}
export function growthPoints(records, metric, range) {
  return records.filter(row => row.measuredOn >= range.from && row.measuredOn <= range.to && row[metric] != null)
    .slice().sort((a, b) => a.measuredOn.localeCompare(b.measuredOn));
}
export function growthPosition(date, range) {
  return (stamp(date) - stamp(range.from)) / (stamp(range.to) - stamp(range.from));
}

// Normalize API ordering once for the latest cards and history list without mutating the response.
export function newestGrowthFirst(rows) {
  return [...rows].sort((a, b) => b.measuredOn.localeCompare(a.measuredOn));
}
