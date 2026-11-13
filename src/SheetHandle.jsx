import React, { useRef } from 'react';

export default function SheetHandle({ onClose }) {
  const drag = useRef(null);

  function finish(event, apply) {
    if (!drag.current || event.pointerId !== drag.current.pointerId) return;
    const { sheet, startY } = drag.current;
    drag.current = null;
    sheet.style.removeProperty('translate');
    if (!apply) return;
    const distance = event.clientY - startY;
    if (distance < -32) sheet.classList.add('sheet-expanded');
    if (distance > 72) {
      if (sheet.classList.contains('sheet-expanded')) sheet.classList.remove('sheet-expanded');
      else onClose();
    }
  }

  return <div className="sheet-handle sheet-drag-handle" aria-hidden="true"
    onPointerDown={event => {
      if (event.button !== 0 || !event.isPrimary) return;
      drag.current = { sheet: event.currentTarget.closest('.sheet'), startY: event.clientY, pointerId: event.pointerId };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      if (drag.current?.pointerId !== event.pointerId) return;
      drag.current.sheet.style.translate = `0 ${Math.max(0, event.clientY - drag.current.startY)}px`;
    }}
    onPointerUp={event => finish(event, true)}
    onPointerCancel={event => finish(event, false)}
    onLostPointerCapture={event => finish(event, false)}
  />;
}
