export function waOrGwa(name) {
  const last = String(name ?? '').trim().normalize('NFC').at(-1);
  const code = last?.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0 ? '과' : '와';
}
