const normalizedGender = gender => String(gender || '').toUpperCase();

export const childAgeInMonths = (birthDate, today = new Date()) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(birthDate || ''))) return null;
  const [year, month, day] = birthDate.split('-').map(Number);
  if (!year || !month || !day) return null;
  let months = (today.getFullYear() - year) * 12 + today.getMonth() - (month - 1);
  if (today.getDate() < day) months -= 1;
  return Math.max(0, months);
};

export const childProfileEmoji = (child, today = new Date()) => {
  const months = childAgeInMonths(child?.birthDate, today);
  if (months !== null && months < 24) return '👶🏻';
  const gender = normalizedGender(child?.gender);
  if (gender === 'MALE') return '👦🏻';
  if (gender === 'FEMALE') return '👧🏻';
  return '🧒🏻';
};
