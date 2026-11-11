import { api } from './api';

const TOKEN_KEY = 'dodam.push.token';
const ENABLED_KEY = 'dodam.push.enabled';
let messaging;
function permissionWithTimeout() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('알림 권한 창이 응답하지 않아요. Chrome에서 이 주소를 열고 알림을 허용해주세요.')), 20000);
    Notification.requestPermission().then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
export const pushEnabled = () => localStorage.getItem(ENABLED_KEY) === 'true';
export function pushSupportMessage() {
  if (!window.isSecureContext) return '알림은 HTTPS 연결에서 사용할 수 있어요.';
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window))
    return '이 브라우저에서는 푸시를 지원하지 않아요. iPhone은 Safari에서 홈 화면에 추가한 뒤 열어주세요.';
  if (Notification.permission === 'denied') return '브라우저 또는 휴대폰 설정에서 도담 알림을 허용해주세요.';
  return '';
}
async function client() {
  const config = await api.pushConfig();
  if (!config.enabled || !config.vapidKey) throw new Error('서버의 푸시 연결을 준비하고 있어요.');
  const [{ initializeApp, getApps }, sdk] = await Promise.all([import('firebase/app'), import('firebase/messaging')]);
  if (!(await sdk.isSupported())) throw new Error('이 브라우저는 푸시 알림을 지원하지 않아요.');
  const app = getApps().find(app => app.name === 'dodam-push') || initializeApp(config, 'dodam-push');
  messaging = sdk.getMessaging(app);
  return { sdk, config };
}
export async function enablePush(ask = true) {
  const hint = pushSupportMessage();
  if (hint) throw new Error(hint);
  // Must be called directly from the click gesture (important on iOS).
  if (Notification.permission !== 'granted') {
    if (!ask || await permissionWithTimeout() !== 'granted') throw new Error('알림 권한이 허용되지 않았어요.');
  }
  const { sdk, config } = await client();
  await navigator.serviceWorker.register('/sw.js');
  const registration = await navigator.serviceWorker.ready;
  const token = await sdk.getToken(messaging, { vapidKey: config.vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error('알림 등록에 실패했어요. 다시 시도해주세요.');
  const previous = localStorage.getItem(TOKEN_KEY);
  if (previous && previous !== token) await api.unregisterPush(previous);
  await api.registerPush(token);
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ENABLED_KEY, 'true');
}
export async function disablePush() {
  const token = localStorage.getItem(TOKEN_KEY);
  let unregisterError;
  if (token) { try { await api.unregisterPush(token); } catch (error) { unregisterError = error; } }
  // Unsubscribe the browser too, even when a backend session has expired.
  const registration = await navigator.serviceWorker?.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();
  if (messaging) { const sdk = await import('firebase/messaging'); await sdk.deleteToken(messaging); }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ENABLED_KEY);
  if (unregisterError && unregisterError.status !== 401) throw unregisterError;
}
