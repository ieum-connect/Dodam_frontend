export function scheduleValidation(startsAt, rule = {}, requireEndDate = false) {
  if (!startsAt) return '복용 시작 날짜와 시간을 모두 입력해 주세요.';
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/.exec(startsAt);
  const date = new Date(startsAt);
  if (!match || !Number.isFinite(date.getTime()) || +match[1] < 1 || +match[1] > 9998
      || date.getFullYear() !== +match[1] || date.getMonth() + 1 !== +match[2]
      || date.getDate() !== +match[3] || date.getHours() !== +match[4] || date.getMinutes() !== +match[5]) {
    return '올바른 날짜와 시간을 입력해 주세요. 연도는 1~9998년까지 가능해요.';
  }
  if (!rule.repeatMode || rule.repeatMode === 'ONCE') return '';
  if (rule.repeatMode === 'WEEKLY' && !(rule.weekdayMask & 127)) return '매주 복용할 요일을 한 개 이상 선택해 주세요.';
  if (requireEndDate && !rule.endDate) return '매일·매주 복용은 처방받은 마지막 날짜를 반복 종료일에 입력해 주세요.';
  if (rule.endDate) {
    const end = new Date(`${rule.endDate}T12:00`);
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rule.endDate);
    if (!parts || !Number.isFinite(end.getTime()) || +parts[1] < 1 || +parts[1] > 9998
        || end.getFullYear() !== +parts[1] || end.getMonth() + 1 !== +parts[2] || end.getDate() !== +parts[3]) {
      return '올바른 반복 종료일을 입력해 주세요.';
    }
    if (rule.endDate < startsAt.slice(0, 10)) return '반복 종료일은 복용 시작일과 같거나 이후여야 해요.';
    if (rule.repeatMode === 'WEEKLY') {
      const day = new Date(`${startsAt.slice(0, 10)}T12:00`);
      let included = false;
      for (let i = 0; i < 7 && day <= end; i++, day.setDate(day.getDate() + 1)) {
        if (rule.weekdayMask & (1 << ((day.getDay() + 6) % 7))) included = true;
      }
      if (!included) return '선택한 기간에 복용 요일이 없어요. 요일이나 종료일을 바꿔 주세요.';
    }
  }
  return '';
}
