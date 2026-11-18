import { useLayoutEffect, useRef } from 'react';

// Mobile keyboards resize the visual viewport without necessarily resizing the
// layout viewport (notably Safari and Chrome's default keyboard behavior).
export default function useMobileViewport(enabled) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;
    const viewport = window.visualViewport;
    const mobile = window.matchMedia('(max-width: 820px)');
    let frame;
    const clear = () => {
      element.style.removeProperty('--chat-viewport-height');
      element.style.removeProperty('--chat-viewport-top');
    };
    const measure = () => {
      if (!mobile.matches) { clear(); return; }
      // Do not turn pinch zoom into a relayout of the app.
      if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;
      element.style.setProperty('--chat-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
      element.style.setProperty('--chat-viewport-top', `${viewport?.offsetTop ?? 0}px`);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('pageshow', schedule);
    mobile.addEventListener('change', schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('pageshow', schedule);
      mobile.removeEventListener('change', schedule);
      clear();
    };
  }, [enabled]);
  return ref;
}
