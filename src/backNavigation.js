import { useEffect, useRef } from 'react';

// 앱 안의 화면 단계(시트·상세·탭)를 브라우저 기록과 맞춘다.
// URL은 바꾸지 않고 history.state에는 깊이 숫자만 넣는다(개인정보 없음).
const KEY = 'dodamBack';
const layers = []; // 열린 단계. 마지막이 맨 위
let guard = false; // 홈에서 뒤로 가기를 받을 기록(깊이 0)이 있는지
let skipPops = 0; // 앱이 스스로 부른 history.go가 만든 popstate 수
let pendingBack = 0; // 같은 순간에 닫힌 단계 수(한 번의 history.go로 모은다)

const depthOf = (state) => (Number.isInteger(state?.[KEY]) ? state[KEY] : null);
const push = () => window.history.pushState({ [KEY]: layers.length }, '');
const go = (delta) => { skipPops += 1; window.history.go(delta); };
const ensureGuard = () => {
  if (guard) return;
  guard = true;
  window.history.pushState({ [KEY]: 0 }, '');
};
const backLater = () => {
  if (pendingBack++ > 0) return;
  queueMicrotask(() => { const n = pendingBack; pendingBack = 0; go(-n); });
};

// active가 true인 동안 한 단계로 쌓는다. 뒤로 가기가 오면 close()를 부르고, close()가 false면 닫지 않는다.
export function useBackLayer(active, close) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!active) return undefined;
    const layer = { close: () => closeRef.current() };
    ensureGuard();
    layers.push(layer);
    push();
    return () => {
      const index = layers.indexOf(layer);
      if (index < 0) return; // 뒤로 가기로 이미 빠진 단계
      layers.splice(index, 1); // 앱 안 버튼·탭 이동·아이 전환으로 닫힘: 그만큼 기록도 되돌린다
      backLater();
    };
  }, [active]);
}

// App에서 한 번 호출한다. 단계가 없을 때 뒤로 가기가 오면 onRoot()를 부르고, 2초 안에 다시 누르면 브라우저에 맡긴다(종료).
export function useRootBack(onRoot) {
  const rootRef = useRef(onRoot);
  rootRef.current = onRoot;
  useEffect(() => {
    // 같은 창에서 다른 페이지(원본 문서 등)를 보고 돌아와 앱이 새로 로드되면 옛 단계 기록 위에서 시작한다.
    // 한 칸씩 되돌리지 않고 history.go 한 번으로 옛 guard(깊이 0)로 간다.
    const depth = depthOf(window.history.state);
    if (depth === null) ensureGuard();
    else { guard = true; if (depth > 0) go(-depth); }

    let timer;
    const onPop = (event) => {
      if (skipPops > 0) { skipPops -= 1; return; }
      const layer = layers.pop();
      if (layer) {
        if (layer.close() === false) { layers.push(layer); push(); }
        return;
      }
      guard = false; // 홈: guard 기록이 빠졌다
      const left = depthOf(event.state);
      if (left !== null) go(-(left + 1)); // 옛 단계 기록 위라면 한 번에 처음 기록으로
      rootRef.current();
      window.clearTimeout(timer);
      timer = window.setTimeout(ensureGuard, 2000);
    };
    window.addEventListener('popstate', onPop);
    return () => { window.removeEventListener('popstate', onPop); window.clearTimeout(timer); };
  }, []);
}
