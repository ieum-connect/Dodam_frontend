// 국민건강보험공단 2024 건강검진통계, 전국 영유아 수검자 산술평균.
// Source transcription and coverage: docs/GROWTH_AVERAGE_SOURCE.md.
export const growthReferenceSources = {
  heightCm: 'https://kosis.kr/statHtml/statHtml.do?orgId=350&tblId=DT_35007_N131&conn_path=I3',
  weightKg: 'https://kosis.kr/statHtml/statHtml.do?orgId=350&tblId=DT_35007_N133&conn_path=I3',
};
export const growthAverageYear = 2024;
const groups = [
  { label: '생후 14~35일', days: [14, 35] },
  ...[[4,6],[9,12],[18,24],[30,36],[42,48],[54,60],[66,71]].map(months => ({ label: `${months[0]}~${months[1]}개월`, months })),
];
const averages = {
  heightCm: {
    MALE: [53.81,67.04,75.91,86.43,94.61,101.69,108.58,115.12],
    FEMALE: [52.88,65.31,74.40,85.09,93.37,100.54,107.39,113.88],
  },
  weightKg: {
    MALE: [4.71,8.52,10.43,12.47,14.55,16.68,19.00,21.62],
    FEMALE: [4.47,7.96,9.90,11.86,14.00,16.18,18.44,20.88],
  },
};
const DAY = 86400000;
function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value ? date : null;
}
function monthBirthday(birth, months) {
  const first = new Date(Date.UTC(birth.getUTCFullYear(), birth.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(birth.getUTCDate(), last));
  return first.getTime();
}
function bounds(group, birth) {
  return group.days
    ? [birth.getTime() + group.days[0] * DAY, birth.getTime() + group.days[1] * DAY]
    : [monthBirthday(birth, group.months[0]), monthBirthday(birth, group.months[1] + 1) - DAY];
}
export function growthAverageByAge(metric, gender, birthDate, measuredOn) {
  const data = averages[metric]?.[gender];
  const birth = parseDate(birthDate), measured = parseDate(measuredOn);
  if (!data || !birth || !measured || measured < birth) return null;
  const index = groups.findIndex(group => {
    const [from, to] = bounds(group, birth);
    return measured.getTime() >= from && measured.getTime() <= to;
  });
  if (index < 0) return null;
  return { mean: data[index], groupLabel: groups[index].label, year: growthAverageYear };
}
export function growthAverageComparison(metric, gender, birthDate, measuredOn) {
  const measured = parseDate(measuredOn);
  if (!measured) return null;
  const previousDay = new Date(measured.getTime() - DAY).toISOString().slice(0, 10);
  const nextDay = new Date(measured.getTime() + DAY).toISOString().slice(0, 10);
  const segment = growthAverageSegments(metric, gender, birthDate, { from: previousDay, to: nextDay })
    .find(item => item.from <= measuredOn && item.to >= measuredOn);
  if (!segment) return null;
  const left = parseDate(segment.from).getTime(), right = parseDate(segment.to).getTime();
  const mean = segment.fromMean + (segment.toMean - segment.fromMean)
    * (measured.getTime() - left) / (right - left);
  return { mean, estimated: true, year: growthAverageYear };
}
// Connect band midpoint means for a visual estimate, not published monthly data.
// Interpolate before clipping so the curve is stable across period selections.
export function growthAverageSegments(metric, gender, birthDate, range) {
  const data = averages[metric]?.[gender], birth = parseDate(birthDate);
  const from = parseDate(range.from), to = parseDate(range.to);
  if (!data || !birth || !from || !to || from > to) return [];
  const bands = groups.map(group => bounds(group, birth));
  const anchors = bands.map(([start, end], index) => ({
    time: Math.floor((start + end) / (2 * DAY)) * DAY, mean: data[index],
  }));
  anchors.unshift({ time: bands[0][0], mean: data[0] });
  anchors.push({ time: bands.at(-1)[1], mean: data.at(-1) });
  return anchors.slice(1).flatMap((end, index) => {
    const start = anchors[index];
    const left = Math.max(start.time, from.getTime()), right = Math.min(end.time, to.getTime());
    const interpolate = time => start.mean + (end.mean - start.mean) * (time - start.time) / (end.time - start.time);
    return left >= right ? [] : [{
      from: new Date(left).toISOString().slice(0,10),
      to: new Date(right).toISOString().slice(0,10),
      fromMean: interpolate(left), toMean: interpolate(right),
    }];
  });
}
