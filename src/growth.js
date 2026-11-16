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

// Calendar ticks share a fixed-width viewport; only well-spaced dates receive labels.
export function growthAxis(range, period) {
  const days = Math.round((stamp(range.to) - stamp(range.from)) / 86400000);
  const unit = period === 1 ? 'day' : period === 6 ? 'week' : period === 12 ? 'month' : days <= 45 ? 'day' : days <= 185 ? 'week' : 'month';
  const ticks = [];
  const start = new Date(stamp(range.from));
  for (let i = 0; ; i++) {
    let time;
    if (unit === 'month') {
      const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
      const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
      date.setUTCDate(Math.min(start.getUTCDate(), last));
      time = date.getTime();
    } else time = stamp(range.from) + i * (unit === 'week' ? 7 : 1) * 86400000;
    if (time > stamp(range.to)) break;
    ticks.push(new Date(time).toISOString().slice(0, 10));
  }
  // Divide the full time span evenly, including both endpoints. Appending the
  // final date to calendar-stepped labels otherwise creates a longer last cell.
  const labelCount = Math.min(5, days + 1);
  const labelDates = Array.from({ length: labelCount }, (_, i) =>
    new Date(stamp(range.from) + Math.round(i * days / Math.max(1, labelCount - 1)) * 86400000).toISOString().slice(0, 10));
  return { unit, ticks, labelDates, plotWidth: 276 };
}

// Aggregate display points only. Keep every source row for details and editing.
export function growthGroups(records, metric, range, unit) {
  const groups = new Map();
  for (const row of growthPoints(records, metric, range)) {
    let from = row.measuredOn, to = row.measuredOn;
    if (unit === 'week') {
      const date = new Date(stamp(row.measuredOn));
      const monday = date.getTime() - ((date.getUTCDay() + 6) % 7) * 86400000;
      from = new Date(monday).toISOString().slice(0, 10);
      to = new Date(monday + 6 * 86400000).toISOString().slice(0, 10);
    } else if (unit === 'month') {
      from = row.measuredOn.slice(0, 7) + '-01';
      const date = new Date(stamp(from));
      to = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    }
    const key = from;
    if (!groups.has(key)) groups.set(key, { key, from: from < range.from ? range.from : from, to: to > range.to ? range.to : to, records: [] });
    const group = groups.get(key);
    group.records.push(row);
    group.representative = row;
  }
  return [...groups.values()];
}
