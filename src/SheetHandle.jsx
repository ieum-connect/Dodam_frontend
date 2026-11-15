import React, { useRef } from 'react';

export default function SheetHandle({ onClose, disabled = false }) {
  const drag = useRef(null);

  function finish(event, apply) {
    if (!drag.current || event.pointerId !== drag.current.pointerId) return;
    const { sheet, startY } = drag.current;
    drag.current = null;
    if (!apply || disabled) return;
    const distance = event.clientY - startY;
    if (distance < -32) sheet.classList.add('sheet-expanded');
    if (distance > 72) {
      if (sheet.classList.contains('sheet-expanded')) sheet.classList.remove('sheet-expanded');
      else onClose();
    }
  }

  return <div className="sheet-handle sheet-drag-handle" aria-hidden="true"
    onPointerDown={event => {
      if (disabled || event.button !== 0 || !event.isPrimary) return;
      event.preventDefault();
      drag.current = { sheet: event.currentTarget.closest('.sheet'), startY: event.clientY, pointerId: event.pointerId };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerUp={event => finish(event, true)}
    onPointerCancel={event => finish(event, false)}
    onLostPointerCapture={event => finish(event, false)}
  />;
}
