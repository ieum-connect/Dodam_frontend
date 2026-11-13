import reference from './growthReferenceData.json';

// 질병관리청·대한소아청소년과학회, 2017 소아청소년 성장도표 데이터 테이블.
export const growthReferenceSource = 'https://knhanes.kdca.go.kr/knhanes/grtcht/dwnld/dtDtl.do?dataNo=7';
const percentiles = [3, 10, 25, 50, 75, 90, 97];

export function growthPositionByAge(metric, gender, birthDate, measuredOn, value) {
  if (!birthDate || !measuredOn || measuredOn < birthDate || !Number.isFinite(value)) return null;
  const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number);
  const [year, month, day] = measuredOn.split('-').map(Number);
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const age = (year - birthYear) * 12 + month - birthMonth
    - Number(day < Math.min(birthDay, lastDayOfMonth));
  const cutoffs = reference[metric]?.[gender]?.[age];
  if (!cutoffs) return null;
  const index = cutoffs.findIndex(cutoff => value <= cutoff);
  const label = index < 0 ? '97백분위 초과'
    : value === cutoffs[index] ? `약 ${percentiles[index]}백분위`
    : index === 0 ? '3백분위 미만'
    : `${percentiles[index - 1]}~${percentiles[index]}백분위`;
  return { age, label, median: cutoffs[3] };
}
