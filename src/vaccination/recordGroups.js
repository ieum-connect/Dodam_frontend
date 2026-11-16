// 접종 기록 확인 화면의 월령 묶음 계산. 화면 상태와 무관한 순수 함수만 둔다.

// recFrom = 생일 + 일정표 from(0·Nm·Ny)이라 연·월 차이가 곧 from 개월 수다.
// ponytail: 일정표 from에 주(w)·일(d) 단위가 생기면 engine.age_months처럼 일 단위 보정이 필요하다.
export const monthsFrom = (birth, date) => {
  const [y1, m1] = String(birth || '').split('-').map(Number);
  const [y2, m2] = String(date || '').split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
};

export const ageGroupLabel = (m) => m === 0 ? '출생 시' : m < 24 || m % 12 ? `${m}개월` : `만 ${m / 12}세`;

export const CHECKED_LABEL = '체크한 접종';

// 미체크는 now·past만 받는다. soon 같은 미래 미체크 목록은 인자로 받지 않으므로 결과에 나오지 않는다.
// DONE은 권장 시작이 미래여도 넣어 해제할 수 있게 한다(생년월일 수정·미리 체크한 경우).
// recFrom이 없는 DONE(AI 응답에 아직 없음)은 맨 아래 "체크한 접종" 묶음에 둔다.
export const buildRecordGroups = ({ now = [], past = [], done = [], birthDate }) => {
  const groups = [];
  [...now, ...past, ...done].forEach((dose) => {
    const m = dose.recFrom ? monthsFrom(birthDate, dose.recFrom) : NaN;
    const key = Number.isFinite(m) ? m : Infinity;
    let group = groups.find((g) => g.key === key);
    if (!group) groups.push(group = { key, label: Number.isFinite(m) ? ageGroupLabel(m) : CHECKED_LABEL, doses: [] });
    group.doses.push(dose);
  });
  // recFrom은 'YYYY-MM-DD'라 문자열 비교가 날짜 순서와 같다.
  groups.sort((a, b) => a.key - b.key)
    .forEach((g) => g.doses.sort((a, b) => String(a.recFrom || '').localeCompare(String(b.recFrom || '')) || String(a.name).localeCompare(String(b.name), 'ko')));
  return groups;
};
