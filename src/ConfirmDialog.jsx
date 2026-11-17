import React, { useId } from 'react';

// 삭제 확인 모달. 뒤로가기(useBackLayer)는 여는 화면이 가진다.
export default function ConfirmDialog({ title, description, confirmLabel, busy, onCancel, onConfirm }) {
  const titleId = useId();
  return <div className="growth-delete-confirm" role="dialog" aria-modal="true" aria-labelledby={titleId}><div>
    <h3 id={titleId}>{title}</h3><p>{description}</p>
    <div className="growth-delete-actions"><button disabled={busy} onClick={onCancel}>취소</button><button disabled={busy} onClick={onConfirm}>{busy ? '삭제 중…' : confirmLabel}</button></div>
  </div></div>;
}
