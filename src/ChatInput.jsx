import React, { useLayoutEffect, useRef } from 'react';

export default function ChatInput({ value, onChange, disabled, onSend }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const input = ref.current;
    const resize = () => {
      input.style.height = 'auto';
      const style = getComputedStyle(input);
      const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      input.style.height = `${Math.min(input.scrollHeight + border, parseFloat(style.maxHeight))}px`;
    };
    resize();
    // Wrapping changes on rotation/window resize even without editing text.
    let width = input.getBoundingClientRect().width;
    const observer = new ResizeObserver(entries => {
      const next = input.getBoundingClientRect().width;
      if (next !== width || entries.some(entry => entry.target !== input)) { width = next; resize(); }
    });
    observer.observe(input);
    const shell = input.closest('.app-shell');
    if (shell) observer.observe(shell);
    window.visualViewport?.addEventListener('resize', resize);
    window.addEventListener('resize', resize);
    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener('resize', resize);
      window.removeEventListener('resize', resize);
    };
  }, [value]);
  return <textarea ref={ref} rows={1} value={value} disabled={disabled}
    aria-label="질문 내용" placeholder="도담이에게 물어보세요"
    onChange={event => onChange(event.target.value)}
    onKeyDown={event => {
      // Enter inserts a line break on mobile; Ctrl/Cmd+Enter is an optional
      // desktop shortcut. Never send an unfinished Korean IME composition.
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing && event.keyCode !== 229) {
        event.preventDefault();
        onSend();
      }
    }}/>;
}
