import React, { useEffect, useRef, useState } from 'react';
import { BellRing } from 'lucide-react';
import { api } from './api';
import { useBackLayer } from './backNavigation';
import { enablePush, pushEnabled, pushSupportMessage } from './push';

export default function PushOnboarding({ userId, blocked }) {
  const key = `dodam.push.onboarding.${userId}`;
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(key) === 'true');
  const [showDetails, setShowDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef(null);
  const open = available && !dismissed && !blocked && !pushEnabled();

  useEffect(() => {
    if (dismissed || pushEnabled() || pushSupportMessage() ||
        !window.matchMedia('(any-pointer: coarse)').matches) return;
    let active = true;
    api.pushConfig().then(config => {
      if (active) setAvailable(Boolean(config.enabled && config.vapidKey));
    }).catch(() => {});
    return () => { active = false; };
  }, [dismissed]);

  function dismiss() {
    localStorage.setItem(key, 'true');
    setDismissed(true);
  }

  useBackLayer(open, () => {
    if (busy) return false;
    dismiss();
  });

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    element.showModal();
    return () => element.close();
  }, [open]);

  async function activate() {
    setBusy(true);
    setError('');
    try {
      await enablePush({ showDetails, userId });
      dismiss();
    } catch (failure) {
      setError(failure.message || '알림을 켜지 못했어요. 알림 설정에서 다시 시도할 수 있어요.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return <dialog ref={dialog} className="push-onboarding" aria-labelledby="push-onboarding-title"
    onCancel={event => { event.preventDefault(); if (!busy) dismiss(); }}>
    <span className="push-setting-icon" aria-hidden="true"><BellRing size={22}/></span>
    <h2 id="push-onboarding-title">복약·일정 알림을 켤까요?</h2>
    <p>앱을 닫아도 등록한 시간에 알려드려요.</p>
    <label className="push-details-option">
      <input type="checkbox" checked={showDetails} disabled={busy} onChange={event => setShowDetails(event.target.checked)}/>
      <span>알림에 일정·복약 제목 표시<small>잠금 화면에도 제목이 보일 수 있어요.</small></span>
    </label>
    {error && <p className="push-feedback" role="status">{error}</p>}
    <div className="push-onboarding-actions">
      <button className="text-button" disabled={busy} onClick={dismiss}>나중에</button>
      <button className="primary-button" disabled={busy} onClick={activate}>{busy ? '알림 설정 중…' : '알림 켜기'}</button>
    </div>
  </dialog>;
}
