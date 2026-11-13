import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useBackLayer } from './backNavigation';
import SheetHandle from './SheetHandle';
import './child-sheet.css';

export default function ProfileEditSheet({ title, description, icon: Icon, pending, onClose, children }) {
  const sheet = useRef(null);
  const close = () => pending.current ? false : onClose();
  useBackLayer(true, close);

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheet.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus?.(); };
  }, []);

  function handleKeyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key !== 'Tab') return;
    const controls = [...sheet.current.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]')];
    const first = controls[0], last = controls.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === sheet.current)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return <div className="modal-backdrop child-sheet-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <section className="sheet child-profile-sheet" role="dialog" aria-modal="true" aria-labelledby="profile-edit-title" tabIndex={-1} ref={sheet} onKeyDown={handleKeyDown}>
      <SheetHandle onClose={close}/>
      <header className="child-sheet-header">
        <span className="child-sheet-emblem" aria-hidden="true"><Icon size={26}/></span>
        <div><h2 id="profile-edit-title">{title}</h2><p>{description}</p></div>
        <button type="button" className="child-sheet-close" disabled={pending.current} onClick={close} aria-label="닫기"><X size={22}/></button>
      </header>
      {children}
    </section>
  </div>;
}
