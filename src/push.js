import { api } from './api';

const TOKEN_KEY = 'dodam.push.token';
const ENABLED_KEY = 'dodam.push.enabled';
const DETAILS_OWNER_KEY = 'dodam.push.details-owner';
const PERMISSION_WAIT_MS = 30000;
const SUBSCRIPTION_RETRY_DELAY_MS = 1000;
let messaging;
function requestPushPermission(signal) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const cleanup = () => {
      window.clearInterval(permissionPoll);
      window.clearTimeout(permissionDeadline);
      window.removeEventListener('focus', checkPermission);
      document.removeEventListener('visibilitychange', checkPermission);
      signal?.removeEventListener('abort', cancel);
    };
    let finished = false;
    const finish = (settle, value) => {
      if (finished) return;
      finished = true;
      cleanup();
      settle(value);
    };
    const complete = permission => finish(resolve, permission);
    const fail = error => finish(reject, error);
    const checkPermission = () => {
      const permission = Notification.permission;
      if (permission !== 'default') complete(permission);
      return permission;
    };
    const cancel = () => fail(signal.reason);
    // An installed app can receive an updated permission without changing focus.
    const permissionPoll = window.setInterval(checkPermission, 500);
    const permissionDeadline = window.setTimeout(() => {
      if (checkPermission() === 'default') {
        fail(new Error('알림 권한 응답을 받지 못했어요. 도담을 완전히 닫았다가 홈 화면 아이콘으로 다시 열고 켜주세요.'));
      }
    }, PERMISSION_WAIT_MS);
    window.addEventListener('focus', checkPermission);
    document.addEventListener('visibilitychange', checkPermission);
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      Notification.requestPermission().then(permission => {
        if (checkPermission() === 'default') complete(permission);
      }, fail);
    } catch (error) {
      fail(error);
    }
  });
}
export const pushEnabled = () => localStorage.getItem(ENABLED_KEY) === 'true';
export const pushDetailsEnabled = userId => Boolean(userId && localStorage.getItem(DETAILS_OWNER_KEY) === userId);
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

function isTemporarySubscriptionError(error) {
  return error?.name === 'AbortError'
    && /push service error|could not connect to push server/i.test(error.message);
}

async function getPushToken(sdk, options, signal) {
  try {
    return await sdk.getToken(messaging, options);
  } catch (error) {
    signal?.throwIfAborted();
    if (!isTemporarySubscriptionError(error)) throw error;
  }
  await new Promise(resolve => window.setTimeout(resolve, SUBSCRIPTION_RETRY_DELAY_MS));
  signal?.throwIfAborted();
  try {
    return await sdk.getToken(messaging, options);
  } catch (error) {
    signal?.throwIfAborted();
    if (!isTemporarySubscriptionError(error)) throw error;
    throw new Error('브라우저의 알림 서비스에 연결하지 못했어요. 잠시 뒤 다시 켜 주세요.', { cause: error });
  }
}
export async function enablePush({ ask = true, signal, onPermissionPendingChange, showDetails, userId } = {}) {
  signal?.throwIfAborted();
  const hint = pushSupportMessage();
  if (hint) throw new Error(hint);
  // Must be called directly from the click gesture (important on iOS).
  if (Notification.permission !== 'granted') {
    if (!ask) throw new Error('알림 권한이 허용되지 않았어요.');
    onPermissionPendingChange?.(true);
    const permission = await requestPushPermission(signal).finally(() => onPermissionPendingChange?.(false));
    if (permission !== 'granted') throw new Error(permission === 'denied'
      ? '브라우저 또는 휴대폰 설정에서 도담 알림을 허용해주세요.'
      : '알림 권한 요청이 닫혔어요. 다시 켜고 허용을 눌러주세요.');
  }
  signal?.throwIfAborted();
  const { sdk, config } = await client();
  await navigator.serviceWorker.register('/sw.js');
  const registration = await navigator.serviceWorker.ready;
  const token = await getPushToken(sdk, { vapidKey: config.vapidKey, serviceWorkerRegistration: registration }, signal);
  if (!token) throw new Error('알림 등록에 실패했어요. 다시 시도해주세요.');
  const previous = localStorage.getItem(TOKEN_KEY);
  signal?.throwIfAborted();
  if (previous && previous !== token) await api.unregisterPush(previous);
  signal?.throwIfAborted();
  const details = showDetails ?? (previous !== token && pushDetailsEnabled(userId) ? true : undefined);
  await api.registerPush(token, details);
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ENABLED_KEY, 'true');
  if (showDetails === true) localStorage.setItem(DETAILS_OWNER_KEY, userId);
  if (showDetails === false) localStorage.removeItem(DETAILS_OWNER_KEY);
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
  localStorage.removeItem(DETAILS_OWNER_KEY);
  if (unregisterError && unregisterError.status !== 401) throw unregisterError;
}
