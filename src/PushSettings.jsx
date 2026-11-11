import React, { useEffect, useRef, useState } from 'react';
import { BellRing, ExternalLink, LoaderCircle, ShieldCheck } from 'lucide-react';
import { enablePush, disablePush, pushEnabled, pushDetailsEnabled, pushSupportMessage } from './push';

function permissionHelp({ android, iphone, installed, samsungInternet, chrome }) {
  if (iphone && installed) return { steps: ['iPhone 설정에서 ‘알림’을 열어요.', '‘도담’을 선택하고 ‘알림 허용’을 켜요.'] };
  if (samsungInternet) return {
    browser: '삼성 인터넷', packageName: 'com.sec.android.app.sbrowser',
    steps: ['삼성 인터넷에서 도담을 열어요.', '메뉴 → 설정 → 사이트 및 다운로드 → 알림에서 도담을 허용해요.'],
  };
  if (chrome) return {
    browser: 'Chrome', packageName: android ? 'com.android.chrome' : '',
    steps: ['Chrome에서 도담을 열어요.', '주소 왼쪽 사이트 정보 → 권한 → 알림에서 허용을 선택해요.'],
  };
  return { steps: ['도담을 연 브라우저의 주소 왼쪽에서 사이트 정보를 열어요.', '사이트 권한에서 알림을 허용해요.'] };
}

export default function PushSettings({ userId }) {
  const [enabled, setEnabled] = useState(pushEnabled);
  const [showDetails, setShowDetails] = useState(() => pushDetailsEnabled(userId));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [waitingPermission, setWaitingPermission] = useState(false);
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);
  const [showBlockedHelp, setShowBlockedHelp] = useState(false);
  const [hint, setHint] = useState(pushSupportMessage);
  const requestRef = useRef(null);
  const blocked = Boolean(hint && window.Notification?.permission === 'denied');
  const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const agent = navigator.userAgent;
  const android = /Android/i.test(agent);
  const iphone = /iPhone|iPad|iPod/i.test(agent) || navigator.standalone === true;
  const samsungInternet = /SamsungBrowser/i.test(agent);
  const chrome = !iphone && /Chrome\//i.test(agent) && !/Edg|OPR|SamsungBrowser|; wv\)/i.test(agent);
  const help = permissionHelp({ android, iphone, installed, samsungInternet, chrome });
  const browserLink = installed && android && help.packageName
    ? `intent://${location.host}/#Intent;scheme=${location.protocol.slice(0, -1)};package=${help.packageName};end`
    : '';

  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    let permission;
    let active = true;
    let previousPermission = window.Notification?.permission;
    const refresh = () => {
      setHint(pushSupportMessage());
      const currentPermission = window.Notification?.permission;
      if (currentPermission === 'granted' && previousPermission !== 'granted') {
        setMessage('');
        setShowBlockedHelp(false);
      }
      previousPermission = currentPermission;
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    navigator.permissions?.query({ name: 'notifications' }).then(result => {
      if (!active) return;
      permission = result;
      permission.addEventListener('change', refresh);
    }).catch(() => {});
    return () => {
      active = false;
      permission?.removeEventListener('change', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  useEffect(() => {
    if (!waitingPermission) return;
    const timer = setTimeout(() => setShowPermissionHelp(true), 8000);
    return () => clearTimeout(timer);
  }, [waitingPermission]);

  async function toggle() {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true); setMessage('');
    try {
      if (enabled) {
        await disablePush();
        setShowDetails(false);
      } else await enablePush({
        userId,
        signal: controller.signal,
        onPermissionPendingChange: setWaitingPermission,
      });
      if (!controller.signal.aborted) setEnabled(!enabled);
    } catch (error) {
      if (!controller.signal.aborted) {
        setMessage(error.message || '알림 설정을 저장하지 못했어요.');
        if (window.Notification?.permission === 'denied') setShowBlockedHelp(true);
      }
    } finally {
      requestRef.current = null;
      setWaitingPermission(false);
      setShowPermissionHelp(false);
      setBusy(false);
      setHint(pushSupportMessage());
    }
  }
  async function changeDetails(event) {
    const checked = event.target.checked;
    setBusy(true); setMessage('');
    try {
      await enablePush({ ask: false, showDetails: checked, userId });
      setShowDetails(checked);
    } catch (error) { setMessage(error.message || '알림 제목 설정을 저장하지 못했어요.'); }
    finally { setBusy(false); }
  }
  return <section className="push-settings" aria-label="휴대폰 푸시 알림 설정">
    <div className="push-setting-row">
      <span className="push-setting-icon" aria-hidden="true"><BellRing size={20}/></span>
      <div className="push-setting-copy"><strong>복약·일정 알림</strong><p aria-live="polite">{waitingPermission ? '휴대폰 안내에서 알림을 허용해주세요' : busy ? '설정을 변경하고 있어요' : blocked ? '이 브라우저에서 도담 알림이 차단돼 있어요' : enabled ? '이 기기에서 알림을 받고 있어요' : '앱을 닫아도 제시간에 알려드려요'}</p></div>
      {blocked && !enabled ? <button type="button" className="notification-settings-link push-blocked-action" aria-controls="push-permission-help" aria-expanded={showBlockedHelp} onClick={() => setShowBlockedHelp(value => !value)}>설정 안내</button> :
      <button className="push-switch" role="switch" aria-checked={enabled} aria-label="이 기기 복약·일정 푸시 알림" aria-busy={busy} disabled={busy || (!enabled && !!hint)} onClick={toggle}>
        <span className="push-switch-track"><span className="push-switch-thumb">{busy && <LoaderCircle size={12}/>}</span></span>
      </button>}
    </div>
    {enabled && <label className="push-details-option">
      <input type="checkbox" checked={showDetails} disabled={busy || !!hint} onChange={changeDetails}/>
      <span>알림에 일정·복약 제목 표시</span>
    </label>}
    <div className="push-privacy"><ShieldCheck size={14} aria-hidden="true"/><span>{enabled && showDetails ? '잠금 화면에도 일정·복약 제목이 표시될 수 있어요.' : '잠금 화면에 표시되는 푸시에는 등록한 제목을 숨겨요.'}</span></div>
    {waitingPermission && showPermissionHelp && <div className="push-feedback" role="status">
      {installed ? '휴대폰의 알림 권한 응답을 기다리고 있어요.' : '권한 안내가 보이지 않으면 주소창 근처의 알림 표시를 확인해주세요.'}
      {' '}<button type="button" className="notification-settings-link" onClick={() => requestRef.current?.abort()}>요청 취소</button>
    </div>}
    {blocked && <div id="push-permission-help" className="push-feedback push-permission-help" hidden={!showBlockedHelp && !enabled}>
      {browserLink && <a className="push-browser-link" href={browserLink}><ExternalLink size={15} aria-hidden="true"/> {help.browser}에서 도담 열기</a>}
      <ol>{help.steps.map(step => <li key={step}>{step}</li>)}</ol>
      <p>{enabled ? '허용한 뒤 도담으로 돌아와 주세요.' : '허용한 뒤 도담으로 돌아와 알림을 켜 주세요.'}</p>
    </div>}
    {!blocked && (hint || message) && <p className="push-feedback" role="status">{message || hint}</p>}
  </section>;
}
