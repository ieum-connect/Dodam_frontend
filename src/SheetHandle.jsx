import React, { useRef, useEffect } from 'react';

export default function SheetHandle({ onClose, disabled = false }) {
  const drag = useRef(null);
  const reset = sheet => {
    sheet.classList.remove('sheet-dragging');
    sheet.style.removeProperty('transform');
  };
  useEffect(() => () => { if (drag.current) reset(drag.current.sheet); }, []);

  function finish(event, apply) {
    if (!drag.current || event.pointerId !== drag.current.pointerId) return;
    const { sheet, startY } = drag.current;
    drag.current = null;
    reset(sheet);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!apply || disabled) return;
    const distance = event.clientY - startY;
    if (distance < -32) sheet.classList.add('sheet-expanded');
    if (distance > 72) {
      if (sheet.classList.contains('sheet-expanded')) sheet.classList.remove('sheet-expanded');
      else onClose();
    }
  }

  return <div className="sheet-handle sheet-drag-handle" role="button" tabIndex={disabled ? -1 : 0}
    aria-label="아래로 끌어 닫기, 키보드는 Enter" aria-disabled={disabled}
    onKeyDown={event => {
      if (!disabled && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onClose(); }
    }}
    onPointerDown={event => {
      if (disabled || event.button !== 0 || !event.isPrimary) return;
      const sheet = event.currentTarget.closest('.sheet');
      if (!sheet) return;
      event.preventDefault();
      drag.current = { sheet, startY: event.clientY, pointerId: event.pointerId };
      sheet.classList.add('sheet-dragging');
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      if (!drag.current || event.pointerId !== drag.current.pointerId || disabled) return;
      const { sheet, startY } = drag.current;
      sheet.style.transform = `translateY(${Math.max(0, event.clientY - startY)}px)`;
    }}
    onPointerUp={event => finish(event, true)}
    onPointerCancel={event => finish(event, false)}
    onLostPointerCapture={event => finish(event, false)}
  />;
}
