import React, { useState } from 'react';
import { BellRing, LoaderCircle, ShieldCheck } from 'lucide-react';
import { enablePush, disablePush, pushEnabled, pushSupportMessage } from './push';

export default function PushSettings() {
  const [enabled, setEnabled] = useState(pushEnabled);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const hint = pushSupportMessage();
  async function toggle() {
    setBusy(true); setMessage('');
    try {
      if (enabled) await disablePush(); else await enablePush();
      setEnabled(!enabled);
    } catch (error) { setMessage(error.message || '알림 설정을 저장하지 못했어요.'); }
    finally { setBusy(false); }
  }
  return <section className="push-settings" aria-label="휴대폰 푸시 알림 설정">
    <div className="push-setting-row">
      <span className="push-setting-icon" aria-hidden="true"><BellRing size={20}/></span>
      <div className="push-setting-copy"><strong>복약·일정 알림</strong><p aria-live="polite">{busy ? '설정을 변경하고 있어요' : enabled ? '이 기기에서 알림을 받고 있어요' : '앱을 닫아도 제시간에 알려드려요'}</p></div>
      <button className="push-switch" role="switch" aria-checked={enabled} aria-label="이 기기 복약·일정 푸시 알림" aria-busy={busy} disabled={busy || (!enabled && !!hint)} onClick={toggle}>
        <span className="push-switch-track"><span className="push-switch-thumb">{busy && <LoaderCircle size={12}/>}</span></span>
      </button>
    </div>
    <div className="push-privacy"><ShieldCheck size={14} aria-hidden="true"/><span>잠금 화면에는 개인 정보를 표시하지 않아요.</span></div>
    {(hint || message) && <p className="push-feedback" role="status">{message || hint}</p>}
  </section>;
}
