import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useBackLayer } from './backNavigation';

export default function RecordDialog({ title, description, onClose, onConfirm, confirmLabel, busy, disabled, children }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialog = useRef(null);
  const cancel = useRef(null);
  useBackLayer(true, () => (busy ? false : onClose()));
  useEffect(() => {
    const previous = document.activeElement;
    (dialog.current.querySelector('input, textarea') || cancel.current)?.focus({ preventScroll: true });
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);

  const handleKey = event => {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      event.stopPropagation();
      if (!busy) onClose();
    }
    if (event.key !== 'Tab') return;
    const controls = [...dialog.current.querySelectorAll('input, select, textarea, button')].filter(control => !control.matches(':disabled'));
    const first = controls[0], last = controls.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return createPortal(<div className="record-dialog-backdrop" onMouseDown={event => {
    if (event.target === event.currentTarget && !busy) onClose();
  }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} onKeyDown={handleKey}>
      <form onSubmit={event => { event.preventDefault(); if (!busy && !disabled) onConfirm(); }}>
        <h3 id={titleId}>{title}</h3>
        {description && <p id={descriptionId}>{description}</p>}
        {children}
        <div className="record-dialog-actions">
          <button ref={cancel} type="button" disabled={busy} onClick={onClose}>취소</button>
          <button type="submit" disabled={busy || disabled}>{confirmLabel}</button>
        </div>
      </form>
    </div>
  </div>, document.body);
}
