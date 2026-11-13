import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bell, CalendarDays, ChevronLeft, ChevronRight, CircleUserRound, FileText,
  HeartPulse, Home, MessageCircleHeart, MoreHorizontal, NotebookPen, Pill,
  Plus, Search, ShieldCheck, Sparkles, Syringe, TrendingUp, Upload, X,
  CheckCircle2, Clock3, MapPin, Send, Baby, Scale, Ruler, Gift, BookOpen,
  Stethoscope, Camera, Menu, Mic, Square, Link2, UserRoundPlus, UsersRound,
  Pencil, Save, Trash2, Settings2, TriangleAlert
} from 'lucide-react';
import './styles.css';
import './care-workspace.css';
import { api, ApiError, errorMessage } from './api';
import { WelfarePrototype } from './welfare/WelfarePrototype';
import LiveCalendarScreen, { TodaySchedules } from './CalendarScreen';
import ChildRequiredState from './ChildRequiredState';
import RecordTimeline from './RecordTimeline';
import GrowthScreen from './GrowthScreen';
import MemoScreen from './MemoScreen';
import ChildSheet from './ChildSheet';
import ProfileEditSheet from './ProfileEditSheet';
import { VaccinationScreen } from './vaccination/VaccinationScreen';
import { currentBackScreen, pushBackScreen, useBackLayer, useRootBack } from './backNavigation';
import { documentDisplayName, documentNoteKey } from './documentName';
import PushSettings from './PushSettings';
import { enablePush, disablePush, pushEnabled } from './push';
import PushOnboarding from './PushOnboarding';
import SheetHandle from './SheetHandle';

function MarkdownText({ text }) {
  const lines = String(text || '').split(/\r?\n/);
  return <div className="markdown-answer">{lines.map((line, index) => {
    const key = `${index}-${line}`;
    if (!line.trim()) return <div className="markdown-gap" key={key} />;
    const heading = line.match(/^#{1,3}\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const content = (heading?.[1] || bullet?.[1] || line).split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part
    );
    if (heading) return <h4 key={key}>{content}</h4>;
    if (bullet) return <div className="markdown-bullet" key={key}>• {content}</div>;
    return <div key={key}>{content}</div>;
  })}</div>;
}

const featureCards = [
  { id: 'records', title: '병원 방문', subtitle: '진료 기록과 예약을 한곳에', icon: Stethoscope, tone: 'rose' },
  { id: 'meds', title: '복용약', subtitle: '놓치지 않는 복약 알림', icon: Pill, tone: 'peach' },
  { id: 'vaccine', title: '예방접종', subtitle: '접종 일정과 이력 관리', icon: Syringe, tone: 'lilac' },
  { id: 'growth', title: '성장 발달', subtitle: '키·몸무게와 발달 기록', icon: TrendingUp, tone: 'mint' },
  { id: 'documents', title: '건강 문서', subtitle: '검사 결과를 AI가 쉽게 설명', icon: FileText, tone: 'sky' },
  { id: 'welfare', title: '복지 서비스', subtitle: '우리 가족에게 맞는 혜택 찾기', icon: Gift, tone: 'butter' },
  { id: 'memo', title: '육아 메모', subtitle: '일상 속 작은 변화 기록', icon: NotebookPen, tone: 'pink' },
  { id: 'chat', title: 'AI 건강 상담', subtitle: '궁금한 점을 편하게 물어보세요', icon: MessageCircleHeart, tone: 'coral' },
];

const detailCopy = {
  records: ['병원 방문 기록', '진료 내용과 다음 예약을 잊지 않도록 정리해드려요.'],
  meds: ['복용약 관리', '복용 시간과 용량을 간편하게 관리해요.'],
  vaccine: ['예방접종 관리', '국가예방접종 일정에 맞춰 미리 알려드려요.'],
  growth: ['성장 발달 기록', '우리 아이의 성장 변화를 한눈에 확인해요.'],
  documents: ['건강 문서', '진료·검사 문서를 올리면 AI가 쉽게 설명해드려요.'],
  welfare: ['복지 서비스', '가족 상황에 맞는 국가 지원 제도를 찾아드려요.'],
  memo: ['육아 메모', '먹고, 자고, 느낀 변화를 가볍게 남겨보세요.'],
};

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authAttempt, setAuthAttempt] = useState(0);
  const [authConfig, setAuthConfig] = useState(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [{tab, detail, calendarFocus}, setScreen] = useState(() => currentBackScreen() ?? {tab:'home', detail:null});
  const [profileOpen, setProfileOpen] = useState(false);
  const [childOpen, setChildOpen] = useState(false);
  const [childEditing, setChildEditing] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const activeChildRef = React.useRef(null);
  const familyRequest = React.useRef(0);
  const [dataRevision, setDataRevision] = useState(0);
  const chooseChild = child => {
    familyRequest.current++;
    if (activeChildRef.current?.id !== child?.id) {
      setVisits([]);
      setDocuments([]);
    }
    activeChildRef.current = child;
    setMedicationDraft(null);
    setActiveChild(child);
  };
  const [activeChild, setActiveChild] = useState(null);
  const [children, setChildren] = useState([]);
  const [me, setMe] = useState(null);
  const [notis, setNotis] = useState({ items: [], unreadCount: 0 });
  const [notiOpen, setNotiOpen] = useState(false);
  const [medicationDraft, setMedicationDraft] = useState(null);
  const screenRef = React.useRef(null);
  const [visits, setVisits] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [toast, setToast] = useState('');
  const [welfareBackHandler, setWelfareBackHandler] = useState(null);

  React.useEffect(() => {
    const node = screenRef.current;
    if (node) node.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    window.scrollTo(0, 0);
  }, [tab, detail, loggedIn]);

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  };

  const childAge = (birthDate) => {
    if (!birthDate) return '';
    const months = Math.max(0, (new Date().getFullYear() - Number(birthDate.slice(0,4))) * 12 + new Date().getMonth() + 1 - Number(birthDate.slice(5,7)));
    return months < 24 ? `생후 ${months}개월` : `만 ${Math.floor(months/12)}세`;
  };
  const normalizeChild = (child, index=0) => {
    const displayName = child.name || child.fullName || child.displayName || (index === 0 ? '박도윤' : `아이 ${index + 1}`);
    return { id: child.id, name: displayName, fullName: displayName, age: childAge(child.birthDate), birthDate: child.birthDate, gender: child.gender, inviteCode: child.inviteCode, parentCount: child.parentCount, emoji: index % 2 ? '👧🏻' : '👶🏻' };
  };

  const isCompleteChild = (child) => Boolean(
    child?.birthDate && child?.name && child.name !== '이름 확인 필요'
  );

  const loadFamilyData = async (preferredId, user = me) => {
    const request = ++familyRequest.current;
    try {
      const childRows = await api.children();
      if (request !== familyRequest.current) return;
      const mapped = childRows.map(normalizeChild);
      const ordered = [...mapped].sort((a, b) => Number(isCompleteChild(b)) - Number(isCompleteChild(a)));
      setChildren(ordered);
      const current = ordered.find((child) => child.id === (typeof preferredId === 'string' ? preferredId : activeChildRef.current?.id));
      const showcaseChild = user?.loginProvider === 'DEMO'
        ? ordered.find(child => child.name === '박도윤 (시연)' && isCompleteChild(child))
        : null;
      const selected = (current && isCompleteChild(current))
        ? current
        : showcaseChild || ordered.find(isCompleteChild) || current || ordered[0];
      chooseChild(selected || null);
      setDataRevision(r => r + 1);
      api.notifications().then(p => setNotis({ items: p?.items || [], unreadCount: p?.unreadCount || 0 })).catch(()=>{});
    } catch (error) {
      if (error.status !== 401) showToast('일부 건강 기록을 불러오지 못했어요');
    }
  };

  React.useEffect(() => {
    api.authConfig().then(setAuthConfig).catch(() => {});
    const restore = event => {
      if (!event.persisted) return;
      setAuthReady(false);
      setAuthAttempt(attempt => attempt + 1);
    };
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, []);

  React.useEffect(() => {
    let active = true;
    setAuthReady(false);
    setAuthError('');
    api.me().then(user => {
      if (!active) return;
      setMe(user);
      setLoggedIn(true);
      setBackendOnline(true);
      void loadFamilyData(undefined, user);
    }).catch(error => {
      if (!active) return;
      if (error.status === 401) {
        setMe(null);
        setLoggedIn(false);
        setBackendOnline(false);
      } else {
        setAuthError('로그인 상태를 확인하지 못했어요. 다시 시도해 주세요.');
      }
    }).finally(() => { if (active) setAuthReady(true); });
    return () => { active = false; };
  }, [authAttempt]);

  const loginDemo = async (account) => {
    try {
      await api.demoLogin(account);
      const user = await api.me();
      setMe(user); setBackendOnline(true); setLoggedIn(true);
      await loadFamilyData(undefined, user);
      showToast(`${user?.name || '테스트 계정'}(으)로 로그인했어요`);
    } catch (error) {
      setLoggedIn(false);
      setBackendOnline(false);
      showToast(error instanceof ApiError ? errorMessage(error, '테스트 계정 로그인에 실패했어요.') : '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.');
    }
  };

  const logout = async () => {
    try {
      await disablePush().catch(() => {});
      if (backendOnline) await api.logout();
    } catch (error) {
      if (error.status !== 401) {
        showToast('로그아웃을 완료하지 못했어요. 다시 시도해 주세요.');
        return;
      }
    }
    window.location.replace('/login?mode=account');
  };

  const withdraw = async () => {
    await api.deleteMe();
    await disablePush().catch(() => {});
    window.location.replace('/login?withdrawn=1');
  };

  React.useEffect(() => {
    if (!loggedIn) return;
    if (pushEnabled()) enablePush({ ask: false, userId: me?.id }).catch(() => {});
    if (new URLSearchParams(location.search).has('push') || sessionStorage.getItem('dodam.open-notifications')) {
      setNotiOpen(true); sessionStorage.removeItem('dodam.open-notifications');
      const url = new URL(location.href); url.searchParams.delete('push'); history.replaceState(history.state, '', url);
    }
  }, [loggedIn, me?.id]);
  React.useEffect(() => {
    const open = event => {
      if (event.data?.type !== 'DODAM_OPEN_NOTIFICATIONS') return;
      if (loggedIn) setNotiOpen(true); else sessionStorage.setItem('dodam.open-notifications', 'true');
    };
    if (new URLSearchParams(location.search).has('push')) sessionStorage.setItem('dodam.open-notifications', 'true');
    navigator.serviceWorker?.addEventListener('message', open);
    return () => navigator.serviceWorker?.removeEventListener('message', open);
  }, [loggedIn]);

  React.useEffect(() => {
    let current = true;
    setVisits([]); setDocuments([]);
    if (!loggedIn || !backendOnline || !activeChild?.id) return;
    Promise.all([api.visits(activeChild.id), api.documents(activeChild.id)])
      .then(([v,d]) => { if(current){setVisits(v?.items||[]); setDocuments(d?.items||[]);} })
      .catch(() => {if(current) showToast('기록을 불러오지 못했어요. 다시 시도해 주세요.');});
    return () => { current = false; };
  }, [activeChild?.id, loggedIn, backendOnline, dataRevision]);

  React.useEffect(() => {
    if (!loggedIn || !backendOnline || !me) return;
    let canceled = false;
    let accessCheck = 0;
    const refreshFamilyAccess = async () => {
      const check = ++accessCheck;
      const familyVersion = familyRequest.current;
      try {
        const rows = await api.children();
        if (canceled || check !== accessCheck || familyVersion !== familyRequest.current) return;
        const next = rows.map(normalizeChild);
        setChildren(next);
        const current = activeChildRef.current;
        const selected = next.find(child => child.id === current?.id);
        if (current && !selected) {
          chooseChild(next.find(isCompleteChild) || next[0] || null);
          showToast('아이 기록 공유가 해제됐어요');
        } else if (selected && selected.inviteCode !== current.inviteCode) {
          const updated = { ...current, inviteCode: selected.inviteCode };
          activeChildRef.current = updated;
          setActiveChild(updated);
        }
      } catch { /* Keep the last confirmed access state when the network is unavailable. */ }
    };
    const refresh = async () => {
      try {
        const page = await api.notifications();
        if (!canceled) setNotis({ items: page?.items || [], unreadCount: page?.unreadCount || 0 });
      } catch { /* Keep the last known notifications during a temporary connection failure. */ }
    };
    refresh();
    const timer = window.setInterval(() => {
      refresh();
      if (document.visibilityState === 'visible') refreshFamilyAccess();
    }, 15000);
    const onVisibility = () => { if (document.visibilityState === 'visible') refreshFamilyAccess(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      canceled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loggedIn, backendOnline, me?.id]);
  const restoreScreen = screen => {
    setScreen(screen ?? {tab:'home', detail:null});
    setMedicationDraft(null);
  };
  const goToScreen = (nextTab, nextDetail = null) => {
    if (nextTab !== tab || nextDetail !== detail) pushBackScreen({tab:nextTab, detail:nextDetail}, setScreen);
  };
  const navigate = (id) => {
    setMedicationDraft(null);
    if (['chat','home','calendar','medical','more'].includes(id)) { goToScreen(id); return; }
    goToScreen('home', id);
  };
  const MEDICAL_IDS = ['records','meds','vaccine','documents'];
  const activeNav = MEDICAL_IDS.includes(detail || tab) ? 'medical' : (detail || tab);

  const openFeature = (id) => {
    setMedicationDraft(null);
    if (id === 'chat' || id === 'calendar') { goToScreen(id); return; }
    goToScreen(tab, id);
  };
  useRootBack(() => showToast('한 번 더 누르면 종료돼요'), restoreScreen);
  useBackLayer(!!welfareBackHandler, () => welfareBackHandler?.());
  useBackLayer(notiOpen || profileOpen, () => {
    if (notiOpen) setNotiOpen(false);
    else setProfileOpen(false);
  });

  return (
    <div className="app-shell">
      <aside className="desktop-rail">
        <Logo />
        <div className="rail-copy">
          <span className="eyebrow">FAMILY HEALTH CARE</span>
          <h1>건강한 매일이<br/>차곡차곡 자라요.</h1>
          <p>흩어진 우리 아이의 건강 정보를<br/>한곳에서 따뜻하고 쉽게 관리하세요.</p>
        </div>
        <div className="rail-illustration" aria-hidden="true">
          <span className="orbit orbit-one"/><span className="orbit orbit-two"/>
          <img className="dodam-brand-icon" src="/favicon.png" alt=""/><span className="mini-dot d1"/><span className="mini-dot d2"/>
        </div>
        <p className="rail-foot">도담 · 우리 가족 건강 동반자</p>
      </aside>

      <main className={`phone-frame ${!loggedIn ? 'login-frame' : ''}`}>
        {!authReady || authError ? <div className="app-loading">
          <span className="login-heart"><img className="dodam-brand-icon" src="/favicon.png" alt=""/></span>
          <p role={authError ? 'alert' : 'status'}>{authError || '로그인 상태를 확인하는 중이에요'}</p>
          {authError && <button type="button" className="primary-button compact" onClick={() => setAuthAttempt(attempt => attempt + 1)}>다시 시도</button>}
        </div> : !loggedIn ? <LoginScreen onDemoLogin={loginDemo} authConfig={authConfig} /> : <>
        <header className="topbar">
          {detail ? (
            <button className="icon-button" onClick={() => welfareBackHandler ? welfareBackHandler() : window.history.back()} aria-label="뒤로"><ChevronLeft/></button>
          ) : <Logo compact />}
          <div className="top-actions">
            <button className={`icon-button ${notis.unreadCount ? 'dot' : ''}`} onClick={() => setNotiOpen(true)} aria-label="알림"><Bell/></button>
            <button className="avatar-button" onClick={() => setProfileOpen(true)} aria-label="내 프로필"><span>{(me?.name || '도담').slice(0,1)}</span></button>
          </div>
        </header>

        <div className="screen-content" ref={screenRef} key={activeChild?.id || 'no-child'}>
          {import.meta.env.VITE_AI_TEST_MODE === 'true' && <p className="ai-test-banner" role="status">연동 테스트 모드 · AI 응답은 검증용 예시입니다.</p>}
          {detail ? <DetailScreen calendarFocus={calendarFocus} medicationDraft={medicationDraft} onMedication={record=>{setMedicationDraft({id:crypto.randomUUID(),patientId:activeChild.id,notes:record.body.slice(0,500),truncated:record.body.length>500});goToScreen('home','meds');}} onWelfareBackChange={setWelfareBackHandler} onOpen={openFeature} type={detail} onCalendar={()=>navigate('calendar')} onToast={showToast} visits={visits} documents={documents} child={activeChild} onDataChange={loadFamilyData} backendOnline={backendOnline} onChildOpen={() => setChildOpen(true)} /> : tab === 'home' ? (

            <HomeScreen onOpen={openFeature} child={activeChild} onChildOpen={() => setChildOpen(true)} />
          ) : tab === 'medical' ? <MedicalHub onOpen={openFeature} visits={visits} documents={documents} />
            : tab === 'calendar' ? <LiveCalendarScreen key={`${activeChild?.id || 'none'}-${calendarFocus || ''}`} initialDate={calendarFocus} child={activeChild} onToast={showToast} onChildOpen={() => setChildOpen(true)} renderVisit={(visit,back,saved)=><VisitItemDetail key={visit.visitId} visit={visit} child={activeChild} documents={documents} backendOnline={backendOnline} onBack={back} onSaved={saved} onToast={showToast}/>} />
            : tab === 'chat' ? <ChatScreen child={activeChild} documents={documents} backendOnline={backendOnline} onToast={showToast} />
            : tab === 'records' ? <DetailScreen type="records" onToast={showToast} visits={visits} documents={documents} child={activeChild} onDataChange={loadFamilyData} backendOnline={backendOnline} onChildOpen={() => setChildOpen(true)} />
            : tab === 'documents' ? <DetailScreen type="documents" onToast={showToast} visits={visits} documents={documents} child={activeChild} onDataChange={loadFamilyData} backendOnline={backendOnline} onChildOpen={() => setChildOpen(true)} />
            : <MoreScreen onOpen={openFeature} me={me} child={activeChild} onProfile={()=>setProfileOpen(true)} onChild={()=>setChildOpen(true)} onLogout={logout} />}
        </div>

        <BottomNav tab={activeNav} setTab={navigate} />
        </>}
      </main>

      {loggedIn && backendOnline && me?.id && <PushOnboarding key={me.id} userId={me.id}
        blocked={notiOpen || profileOpen || childOpen || childEditing} />}
      {notiOpen && <NotificationSheet notis={notis} userId={me?.id} onClose={() => setNotiOpen(false)} onToast={showToast}
        onOpen={notification => {
          if (notification.type.startsWith('RELATION_')) {
            setNotiOpen(false);
            setProfileOpen(true);
            return;
          }
          if (notification.type === 'HEALTH_RECORD_CREATED') {
            setNotiOpen(false);
            navigate('memo');
            return;
          }
          if (notification.type !== 'SCHEDULE_DUE' || !notification.path) return;
          const target = new URL(notification.path, window.location.origin);
          if (target.origin !== window.location.origin || !['/calendar', '/meds'].includes(target.pathname)) return;
          const child = children.find(item => item.id === target.searchParams.get('patientId'));
          if (!child) { showToast('현재 접근할 수 있는 아이의 일정인지 확인해주세요'); return; }
          const date = target.searchParams.get('date');
          if (!date || !Number.isFinite(Date.parse(date))) {
            showToast('알림에 연결된 일정 날짜를 확인할 수 없어요');
            return;
          }
          if (activeChild?.id !== child.id) chooseChild(child);
          const medication = target.pathname === '/meds' || notification.message.endsWith(' — 복용 여부를 확인해주세요.');
          const nextTab = medication ? 'medical' : 'calendar';
          const nextDetail = medication ? 'meds' : null;
          setMedicationDraft(null);
          setNotiOpen(false);
          if (tab !== nextTab || detail !== nextDetail || date !== calendarFocus) {
            pushBackScreen({tab:nextTab, detail:nextDetail, calendarFocus:date}, setScreen);
          }
        }}
        onRead={async (id) => { try { await api.readNotification(id); const p = await api.notifications(); setNotis({ items: p?.items||[], unreadCount: p?.unreadCount||0 }); } catch {} }}
        onReadAll={async () => { try { await api.readAllNotifications(); const p = await api.notifications(); setNotis({ items: p?.items||[], unreadCount: p?.unreadCount||0 }); showToast('모든 알림을 읽음 처리했어요'); } catch { showToast('알림을 처리하지 못했어요'); } }} />}
      {profileOpen && <ProfileSheet hidden={childEditing || profileEditing || withdrawalOpen} child={activeChild} me={me} backendOnline={backendOnline} onClose={() => setProfileOpen(false)} onToast={showToast} onLogout={logout} onWithdraw={() => setWithdrawalOpen(true)} onJoined={loadFamilyData} onEditProfile={setProfileEditing} onEditChild={() => setChildEditing(true)} onChildOpen={() => { setProfileOpen(false); setChildOpen(true); }} />}
      {profileOpen && profileEditing && <GuardianNameSheet me={me} onClose={() => setProfileEditing(false)} onSaved={updated => { setMe(updated); showToast('내 프로필을 수정했어요'); }}/>}
      {profileOpen && withdrawalOpen && <WithdrawalSheet onClose={() => setWithdrawalOpen(false)} onWithdraw={withdraw}/>}
      {(childOpen || childEditing) && <ChildSheet editing={childEditing} active={activeChild} children={children} backendOnline={backendOnline} onSelect={(child) => { chooseChild(child); setChildOpen(false); showToast(`${child.name} 기록으로 전환했어요`); }} onClose={() => {
        if (childEditing) setChildEditing(false);
        else setChildOpen(false);
      }} onToast={showToast} onCreated={loadFamilyData} />}
      {toast && <div className="toast"><CheckCircle2 size={18}/>{toast}</div>}
    </div>
  );
}

const DEMO_ACCOUNTS = [['MINJI','김민지','엄마','민'],['SOONJA','김순자','할머니','순'],['JIHUN','박지훈','아빠','지']];

function LoginScreen({ onDemoLogin, authConfig }) {
  const params = new URLSearchParams(window.location.search);
  const withdrawn = params.get('withdrawn') === '1';
  const chooseAccount = !withdrawn && params.get('mode') === 'account';
  const loginError = params.get('error');
  return <div className="login-screen">
    <div className="login-visual"><span className="login-glow one"/><span className="login-glow two"/><div className="login-heart"><img className="dodam-brand-icon" src="/favicon.png" alt="도담"/></div><div className="login-badge badge-one"><Syringe/><span>예방접종</span></div><div className="login-badge badge-two"><TrendingUp/><span>성장 기록</span></div><div className="login-badge badge-three"><FileText/><span>건강 문서</span></div></div>
    <div className="login-content"><Logo/><span className="eyebrow">FAMILY HEALTH COMPANION</span><h1>아이의 건강한 성장을<br/><strong>도담</strong>과 함께 기록해요.</h1><p>병원 기록부터 예방접종, 성장 발달까지<br/>우리 가족의 건강 정보를 안전하게 관리하세요.</p>
      {withdrawn && <p role="status">도담 회원 탈퇴를 완료했어요.</p>}
      {loginError === 'canceled' && <p role="status">카카오 로그인을 취소했어요.</p>}
      {loginError === 'fail' && <p role="alert">카카오 로그인을 완료하지 못했어요. 다시 시도해 주세요.</p>}
      <div className="login-actions">
        <a className="kakao-button" href={chooseAccount ? api.kakaoAccountLoginUrl : api.kakaoLoginUrl}>
          <span aria-hidden="true">💬</span> 카카오로 시작하기
        </a>
        {authConfig?.demoLogin && <button className="email-button" onClick={() => onDemoLogin()}>체험 계정으로 로그인</button>}
      </div>
      {authConfig?.demoLogin && <div className="demo-login">
        <div className="demo-login-head"><span>테스트 계정</span><em>비밀번호 없이 바로 입장</em></div>
        <div className="demo-list">
          {DEMO_ACCOUNTS.map(([key, name, relation, initial]) => (
            <button key={key} className="demo-main" onClick={() => onDemoLogin(key)}>
              <span className="demo-avatar">{initial}</span>
              <span className="demo-text"><b>{name}</b><small>{relation} · 박도윤, 박다연</small></span>
            </button>
          ))}
        </div>
      </div>}
      <p>처음 이용하시면 카카오 로그인으로 가입할 수 있어요.</p><p className="login-terms">계속하면 도담의 이용약관 및 개인정보 처리방침에 동의하게 됩니다.</p>
    </div>
  </div>;
}

function Logo({ compact = false }) {
  return <div className={`logo ${compact ? 'compact' : ''}`}><img className="dodam-wordmark" src="/dodam-logo.png" alt="도담" /></div>;
}

function HomeScreen({ onOpen, child, onChildOpen }) {
  const todayLabel = new Intl.DateTimeFormat('ko-KR', { month:'long', day:'numeric', weekday:'long' }).format(new Date());
  if (!child?.id) return <div className="page padded"><div className="page-title"><p>{todayLabel}</p><h2>도담에 오신 것을 환영해요</h2><p>아이 프로필을 등록하면 건강 기록 관리를 시작할 수 있어요.</p></div><div className="child-required"><Baby/><h3>첫 아이를 등록해 주세요</h3><p>방문 기록, 건강 문서, AI 상담을<br/>아이별로 안전하게 관리할 수 있어요.</p><button className="primary-button" onClick={onChildOpen}><UserRoundPlus/> 아이 등록하기</button></div></div>;
  return <>
    <section className="welcome">
      <div className="welcome-copy"><p className="muted">{todayLabel}</p><h2><strong>{child.name}</strong>와 오늘도<br/>건강한 하루 보내세요 <span>♡</span></h2></div>
      <button className="child-chip" onClick={onChildOpen}><span className="child-face">{child.emoji}</span><span className="child-chip-copy"><b>{child.fullName}</b><small>{child.age || '생년월일 미등록'} · 아이 전환</small></span><ChevronRight size={17}/></button>
    </section>

    <TodaySchedules child={child} onOpen={onOpen}/>

    <section className="section-block">
      <div className="section-heading"><div><h3>무엇을 도와드릴까요?</h3><p>필요한 건강 관리를 바로 시작해보세요</p></div></div>
      <div className="feature-grid">{featureCards.map(({ id, title, subtitle, icon: Icon, tone }) => (
        <button className={`feature-card${id === 'welfare' || id === 'chat' ? ' feature-title-single-line' : ''}`} key={id} onClick={() => onOpen(id)}>
          <span className={`feature-icon ${tone}`}><Icon/></span><span><b>{title}</b><small>{subtitle}</small></span><ChevronRight className="feature-arrow" size={17}/>
        </button>
      ))}</div>
    </section>

    <section className="record-overview-card">
      <span className="record-overview-icon"><NotebookPen/></span>
      <div><h3>흩어진 기록을 한눈에</h3><p>병원 방문, 건강 문서, 육아 메모와 일정을<br/>날짜별로 함께 살펴보세요.</p><button onClick={() => onOpen('timeline')}>아이 기록 모아보기 <ChevronRight size={16}/></button></div>
    </section>
    <section className="tip-card"><span className="tip-icon"><Sparkles/></span><div><b>작은 변화도 기록해두세요</b><p>육아 메모에 관찰한 시각과 내용을 남기면, 병원 방문 기록과 함께 다시 살펴볼 수 있어요.</p></div></section>
  </>;
}

function BottomNav({ tab, setTab }) {
  const nav = [
    {id:'home',label:'홈',icon:Home},
    {id:'memo',label:'메모',icon:NotebookPen},
    {id:'medical',label:'의료',icon:Stethoscope},
    {id:'chat',label:'AI 도담',icon:MessageCircleHeart,primary:true},
    {id:'growth',label:'성장',icon:TrendingUp},
    {id:'welfare',label:'복지',icon:Gift},
    {id:'more',label:'전체',icon:MoreHorizontal},
  ];
  return <nav className="bottom-nav">{nav.map(({id,label,icon:Icon,primary}) => <button key={id} className={`${tab===id?'active':''} ${primary?'nav-primary':''}`} onClick={()=>setTab(id)}><span className="nav-icon"><Icon/></span><span>{label}</span></button>)}</nav>;
}

function Schedule({icon:Icon,time,title,note,color}) { return <div className="schedule"><span className={`feature-icon ${color}`}><Icon/></span><div><small>{time}</small><b>{title}</b><p>{note}</p></div><ChevronRight/></div> }

function ChatScreen({ child, documents, backendOnline, onToast }) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [docPicker, setDocPicker] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);
  useBackLayer(!historyOpen, () => setHistoryOpen(true));

  const prepareDocumentExplanation = () => {
    setInput('선택한 건강 문서의 내용을 쉽게 설명해줘');
    setDocPicker(true);
  };

  React.useEffect(() => {
    setSelectedDocumentIds((documents || []).slice(0, 1).map(doc => doc.documentId));
  }, [documents]);

  const refreshSessions = React.useCallback(async () => {
    if (!backendOnline || !child?.id) { setSessions([]); return []; }
    const rows = await api.chatSessions(child.id);
    setSessions(rows || []);
    return rows || [];
  }, [backendOnline, child?.id]);

  React.useEffect(() => {
    setActiveSession(null);
    setMessages([]);
    setChatError(null);
    setHistoryOpen(true);
    setSelectedDocumentIds([]);
    refreshSessions().catch(error => onToast(errorMessage(error, '이전 채팅을 불러오지 못했어요.')));
  }, [refreshSessions]);

  const newChat = () => {
    setActiveSession(null);
    setMessages([]);
    setChatError(null);
    setHistoryOpen(false);
    setInput('');
    setSelectedDocumentIds((documents || []).slice(0, 1).map(doc => doc.documentId));
  };

  const openSession = async (session) => {
    if (sending) return;
    setActiveSession(session);
    setHistoryOpen(false);
    setLoadingHistory(true);
    setChatError(null);
    try { setMessages(await api.chatMessages(session.sessionId) || []); }
    catch (error) { const message = errorMessage(error, '대화 기록을 불러오지 못했어요.'); setChatError({ code: error.code || 'CHAT_HISTORY_ERROR', message }); onToast(message); }
    finally { setLoadingHistory(false); }
  };

  const send = () => { if (!input.trim() || sending) return; const q = input.trim(); setInput(''); ask(q); };
  const ask = async (question, docIds) => {
    if (sending) return;
    setChatError(null); setDocPicker(false);
    if (!backendOnline) { setChatError({ code: 'BACKEND_OFFLINE', message: '백엔드 서버에 연결할 수 없어요. 서버 실행 상태를 확인해주세요.' }); return; }
    if (!child?.id) { setChatError({ code: 'PATIENT_REQUIRED', message: '아이를 먼저 등록해 주세요.' }); return; }
    if (!documents?.length) { setChatError({ code: 'DOCUMENT_REQUIRED', message: 'AI가 근거로 확인할 건강 문서가 없어요. 문서를 먼저 업로드해주세요.' }); return; }
    const optimistic = { messageId: `pending-${Date.now()}`, role: 'USER', content: question };
    setMessages(prev => [...prev, optimistic]);
    try {
      setSending(true);
      const session = activeSession || await api.createChatSession(child.id, '새 채팅');
      if (!activeSession) setActiveSession(session);
      // 사용자가 선택을 해제해도 최근 문서로 안전하게 자동 대체한다.
      const targetDocs = docIds?.length ? docIds : (selectedDocumentIds.length ? selectedDocumentIds : documents.slice(0, 1).map(d => d.documentId));
      if (!targetDocs.length) { setMessages(prev => prev.filter(message => message.messageId !== optimistic.messageId)); setChatError({ code: 'DOCUMENT_REQUIRED', message: 'AI가 근거로 확인할 건강 문서가 없어요. 문서를 먼저 업로드해주세요.' }); return; }
      const result = await api.askChat(session.sessionId, question, targetDocs);
      const latestAnswer = [...result].reverse().find(m=>m.role==='ASSISTANT');
      if (!latestAnswer) throw new ApiError('AI 서버에서 답변이 오지 않았어요.', 502, { code: 'AI_EMPTY_RESPONSE' });
      setMessages(result);
      const refreshed = await refreshSessions();
      setActiveSession(refreshed.find(item => item.sessionId === session.sessionId) || session);
      if (latestAnswer.content?.startsWith('AI 답변 생성 실패')) {
        setChatError({ code: 'AI_GENERATION_FAILED', message: latestAnswer.content.replace(/^AI 답변 생성 실패 \(AI_GENERATION_FAILED\):\s*/, '') });
      }
    } catch (error) {
      const message = errorMessage(error, 'AI 답변을 가져오지 못했어요.');
      setChatError({ code: error.code || 'AI_CHAT_ERROR', message }); onToast(message);
    } finally { setSending(false); }
  };

  const dateLabel = value => value ? new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(value)) : '';
  if (historyOpen) return <div className="chat-page chat-lobby">
    <section className="chat-lobby-hero">
      <div className="chat-lobby-copy"><span className="chat-lobby-badge"><Sparkles/> AI 도담</span><h2>{child?.name || '우리 아이'}의 기록,<br/><strong>도담이와 함께 살펴봐요</strong></h2><p>건강 문서를 바탕으로 어려운 표현은 쉽게,<br/>궁금한 내용은 차분하게 설명해드릴게요.</p></div>
      <span className="chat-lobby-orb"><MessageCircleHeart/></span>
      <button className="new-chat-cta" onClick={newChat}><span className="cta-icon"><Plus/></span><span className="cta-text"><b>새 채팅 시작하기</b><small>새로운 주제로 도담이에게 물어보세요</small></span><ChevronRight/></button>
    </section>
    <section className="chat-history-section">
      <div className="chat-history-title"><div><span className="eyebrow">CHAT HISTORY</span><h3>이전 대화</h3></div>{sessions.length ? <span className="list-count">{sessions.length}</span> : null}</div>
      {sessions.length ? <div className="chat-session-list">{sessions.map(session=>(
        <button key={session.sessionId} onClick={()=>openSession(session)}><span className="session-icon"><MessageCircleHeart/></span><span className="session-text"><b>{session.title || '새 채팅'}</b><small><Clock3/>{dateLabel(session.createdAt)} · 대화 이어보기</small></span><ChevronRight/></button>
      ))}</div> : <div className="chat-history-empty"><span><MessageCircleHeart/></span><b>아직 나눈 대화가 없어요</b><p>위의 새 채팅 버튼을 눌러<br/>도담이에게 첫 질문을 해보세요.</p></div>}
    </section>
    <p className="chat-lobby-note"><ShieldCheck/> 건강 기록은 안전하게 보호돼요</p>
  </div>;

  return <div className="chat-page chat-conversation">
    <div className="chat-conversation-bar"><button onClick={()=>setHistoryOpen(true)}><ChevronLeft/> 이전 대화</button><button onClick={newChat}><Plus/> 새 채팅</button></div>
    <div className="chat-hero"><span className="ai-orb"><Sparkles/></span><div><span className="eyebrow">AI CARE ASSISTANT</span><h2>{activeSession?.title || '새 채팅'}</h2><p>{activeSession ? '이전 대화 내용을 이어서 질문할 수 있어요.' : '아이의 건강 기록을 바탕으로 궁금한 점을 쉽게 설명해드릴게요.'}</p></div></div>
    <div className="suggestions"><button onClick={()=>setInput('예방접종 일정을 알려줘')}>예방접종 일정</button><button onClick={()=>setInput('성장 발달이 잘 되고 있나요?')}>성장 발달 확인</button><button className={docPicker?'active':''} onClick={prepareDocumentExplanation}>문서 설명</button></div>
    <div className="selected-documents"><div><span className="eyebrow">REFERENCE DOCUMENTS</span><b>이번 답변에 사용할 문서</b></div><button className="document-select-button" onClick={()=>setDocPicker(v=>!v)}><FileText/> {selectedDocumentIds.length}개 선택 <ChevronRight/></button></div>
    {docPicker && <div className="doc-picker"><div className="doc-picker-head"><div><b>답변 근거를 선택하세요</b><small>선택한 문서만 AI가 참고합니다.</small></div><button onClick={()=>setDocPicker(false)} aria-label="닫기"><X/></button></div>
      {documents?.length ? <div className="doc-picker-list">{documents.map(doc=>(
        <button className={selectedDocumentIds.includes(doc.documentId)?'selected':''} key={doc.documentId} disabled={sending} onClick={()=>setSelectedDocumentIds(ids=>ids.includes(doc.documentId)?ids.filter(id=>id!==doc.documentId):[...ids,doc.documentId])}>
          <span className="doc-picker-check">{selectedDocumentIds.includes(doc.documentId)?'✓':''}</span><span className="doc-picker-icon"><FileText/></span>
          <span className="doc-picker-text"><b>{documentDisplayName(doc)}</b><small>{doc.visitedOn || ''} · {DOC_STATUS[doc.documentStatus]||doc.documentStatus||''}{doc.embeddingStatus==='INDEXING'||doc.embeddingStatus==='PENDING'?' · AI 검색 준비 중':doc.embeddingStatus==='FAILED'?' · AI 검색 준비 실패':''}</small></span>
        </button>))}</div>
      : <p className="doc-picker-empty">등록된 건강 문서가 없어요. 의료 &gt; 건강 문서에서 먼저 업로드해주세요.</p>}
      <div className="doc-picker-footer"><span>{selectedDocumentIds.length}개 문서 선택됨</span><button onClick={()=>setDocPicker(false)}>선택 완료</button></div>
    </div>}
    <div className="messages">{loadingHistory ? <div className="message ai">대화 기록을 불러오고 있어요…</div> : !messages.length && <div className="message ai">무엇이 궁금하신가요? 의료 기록과 성장 데이터를 참고해 함께 살펴볼게요.</div>}{messages.map(message=><div key={message.messageId || `${message.role}-${message.createdAt}-${message.content}`} className={`message ${message.role==='USER'?'user':'ai'}`}>{message.role==='USER'?<span>{message.content}</span>:<MarkdownText text={message.content}/>} {message.warnings?.map(warning=><small className="chat-rag-warning" key={warning.code}>{warning.message}</small>)}</div>)}{chatError&&<div className="message error"><b>{chatError.code}</b><span>{chatError.message}</span><button onClick={()=>setInput(messages.filter(m=>m.role==='USER').at(-1)?.content || '')}>마지막 질문 다시 불러오기</button></div>}{sending&&<div className="message ai">도담이가 의료 기록을 살펴보고 있어요…</div>}</div>
    <div className="chat-composer">
      <div className="chat-input"><button type="button" aria-label="문서 선택" onClick={()=>setDocPicker(true)}><FileText/></button><input value={input} disabled={sending} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="도담이에게 물어보세요"/><button type="button" className="send" disabled={sending||!input.trim()} onClick={send} aria-label="질문 보내기"><Send/></button></div>
      <p className="disclaimer">AI 답변은 참고용이며, 진단을 대신하지 않습니다.</p>
    </div>
  </div>;
}

function DetailScreen({ type, onOpen, onToast, visits = [], documents = [], child, onDataChange, backendOnline, onChildOpen, onCalendar, onMedication, medicationDraft, calendarFocus, onWelfareBackChange }) {
  if(type==='timeline') return <RecordTimeline key={child?.id || 'no-child'} child={child} onOpen={onOpen}/>;
  const [title, desc] = detailCopy[type];
  if(type==='growth') return <GrowthScreen key={child?.id || 'no-child'} child={child} onToast={onToast}/>;
  if(type==='meds') return <LiveCalendarScreen key={`${child?.id || 'none'}-${calendarFocus || ''}`} child={child} onToast={onToast} onChildOpen={onChildOpen} medicationOnly initialDate={calendarFocus} initialDraft={medicationDraft} />;
  if(type==='welfare') return <WelfarePrototype child={child} onChildOpen={onChildOpen} onBackChange={onWelfareBackChange}/>;
  if(type==='memo') return <MemoScreen key={child?.id || 'none'} onToast={onToast} child={child} backendOnline={backendOnline} onMedication={onMedication}/>;
  if(type==='vaccine') return <VaccinationScreen key={child?.id || 'none'} child={child} onToast={onToast} onCalendar={onCalendar} onChildOpen={onChildOpen}/>;

  if(type==='documents') return <DocumentDetail onToast={onToast} visits={visits} documents={documents} child={child} onDataChange={onDataChange} backendOnline={backendOnline} onChildOpen={onChildOpen} onCalendar={onCalendar}/>;
  if(type==='records') return <VisitRecordsDetail onToast={onToast} visits={visits} documents={documents} child={child} onDataChange={onDataChange} backendOnline={backendOnline} onChildOpen={onChildOpen}/>;
  const Icon = featureCards.find(x=>x.id===type)?.icon || FileText;
  const items = {
    vaccine: [['10월 24일','DTaP 4차','오늘 · 동네봄 소아청소년과'],['2027년 3월','일본뇌염 2차','접종 권장 시기']],
    meds: [['매일 08:30','비타민 D','1방울 · 아침 식후'],['필요시','해열제','체온 38.5℃ 이상']],
    records: visits.length ? visits.slice(0,5).map(v=>[v.visitedOn, v.department || '병원 방문', v.hospitalName || '병원 정보 없음']) : [['2026.09.12','감기 진료','동네봄 소아청소년과'],['2026.07.03','영유아 건강검진','튼튼아동병원']],
    documents: [['2026.10.12','혈액검사 결과지','AI 분석 완료'],['2026.09.12','진료 확인서','보관 중']],
    memo: [['오늘 09:10','아침 식사','바나나 반 개, 요거트 잘 먹음'],['어제 20:40','잠들기 전','새 그림책을 아주 좋아했음']],
  }[type] || [];
  return <div className="page padded detail-page"><div className="detail-hero"><span className="detail-icon"><Icon/></span><div><h2>{title}</h2><p>{desc}</p></div></div>
    {type==='vaccine' && <div className="progress-card"><div><span>접종 진행률</span><b>72%</b></div><div className="progress"><i style={{width:'72%'}}/></div><p><ShieldCheck size={16}/> 권장 일정에 맞게 잘 진행하고 있어요.</p></div>}
    <div className="list-header"><h3>{type==='memo'?'최근 메모':'최근 기록'}</h3><button>전체보기</button></div>
    <div className="record-list">{items.map(([date,name,note],i)=><button key={i}><span className="record-date">{date}</span><span><b>{name}</b><small>{note}</small></span><ChevronRight/></button>)}</div>
    <button className="primary-button" onClick={()=>onToast(`${title}에 새 기록을 추가할게요`)}>{type==='documents'?<Upload/>:<Plus/>}{type==='documents'?' 문서 업로드':' 새 기록 추가'}</button>
  </div>;
}

function VisitRecordsDetail({ onToast, visits = [], documents = [], child, onDataChange, backendOnline, onChildOpen }) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [month, setMonth] = useState(() => { const source = visits[0]?.visitedOn || new Date().toISOString().slice(0,10); return new Date(`${source.slice(0,7)}-01T00:00:00`); });
  const [form, setForm] = useState({ visitedOn: new Date().toLocaleDateString('sv-SE'), hospitalName: '', department: '', memo: '' });
  const submit = async () => {
    if (!backendOnline) { onToast('백엔드에 연결된 뒤 방문 기록을 저장할 수 있어요'); return; }
    if (!child?.id) { onToast('아이를 먼저 등록해 주세요'); return; }
    if (!form.hospitalName.trim()) { onToast('병원명을 입력해주세요'); return; }
    try {
      setSaving(true);
      await api.createVisit({ patientId: child.id, ...form, hospitalName: form.hospitalName.trim(), department: form.department.trim(), visitStatus: 'DONE', version: null });
      setAdding(false); setForm({ visitedOn: new Date().toLocaleDateString('sv-SE'), hospitalName: '', department: '', memo: '' });
      await onDataChange?.(); onToast('병원 방문 기록을 저장했어요');
    } catch (error) { onToast(error.message || '방문 기록을 저장하지 못했어요'); }
    finally { setSaving(false); }
  };
  useBackLayer(!!selectedVisit, () => setSelectedVisit(null));
  if (!child?.id) return <ChildRequiredState icon={Stethoscope} title="병원 방문 기록" onChildOpen={onChildOpen}/>;
  if (selectedVisit) return <VisitItemDetail visit={selectedVisit} child={child} documents={documents} backendOnline={backendOnline} onBack={()=>setSelectedVisit(null)} onSaved={async(updated)=>{await onDataChange?.();setSelectedVisit(updated)}} onToast={onToast}/>;
  const visibleVisits = selectedDate ? visits.filter(v=>v.visitedOn===selectedDate) : visits;
  return <div className="page padded detail-page"><div className="detail-hero"><span className="detail-icon"><Stethoscope/></span><div><h2>병원 방문 기록</h2><p>진료 내용과 다음 예약을 잊지 않도록 정리해드려요.</p></div></div>
    <VisitCalendar visits={visits} month={month} setMonth={setMonth} selectedDate={selectedDate} setSelectedDate={setSelectedDate}/>
    <div className="list-header"><h3>{selectedDate ? `${selectedDate.replaceAll('-','.')} 기록` : '전체 방문 기록'}</h3>{selectedDate&&<button onClick={()=>setSelectedDate(null)}>전체보기</button>}</div>
    <div className="record-list">{visibleVisits.length ? visibleVisits.map(v=><button type="button" onClick={()=>setSelectedVisit(v)} key={v.visitId}><span className="record-date">{v.visitedOn}</span><span><b>{v.department || '병원 방문'}</b><small>{v.hospitalName || '병원 정보 없음'}</small></span><ChevronRight/></button>) : <div className="empty-record">{selectedDate?'이 날짜에는 방문 기록이 없어요.':'아직 저장된 병원 방문 기록이 없어요.'}</div>}</div>
    {!adding ? <button className="primary-button" onClick={()=>setAdding(true)}><Plus/> 새 기록 추가</button> : <div className="inline-panel visit-compose"><div className="panel-title"><div><b>새 병원 방문 기록</b><p>아이의 진료 정보를 남겨보세요.</p></div><button onClick={()=>setAdding(false)}><X/></button></div><label className="field-label">방문 날짜<input className="select-field" type="date" value={form.visitedOn} onChange={e=>setForm({...form,visitedOn:e.target.value})}/></label><label className="field-label">병원명<input className="select-field" placeholder="예: 도담소아청소년과" value={form.hospitalName} onChange={e=>setForm({...form,hospitalName:e.target.value})}/></label><label className="field-label">진료 목적<input className="select-field" placeholder="예: 영유아 건강검진" value={form.department} onChange={e=>setForm({...form,department:e.target.value})}/></label><label className="field-label">메모<textarea className="visit-memo" placeholder="진료 내용을 간단히 남겨보세요" value={form.memo} onChange={e=>setForm({...form,memo:e.target.value})}/></label><button className="primary-button compact" disabled={saving} onClick={submit}><CheckCircle2/> {saving?'저장 중…':'방문 기록 저장'}</button></div>}
  </div>;
}

function VisitCalendar({ visits, month, setMonth, selectedDate, setSelectedDate }) {
  const year=month.getFullYear(), monthNo=month.getMonth();
  const firstDay=new Date(year,monthNo,1).getDay(), days=new Date(year,monthNo+1,0).getDate();
  const marked=new Set(visits.map(v=>v.visitedOn));
  const cells=[...Array(firstDay).fill(null),...Array.from({length:days},(_,i)=>i+1)];
  const move=(offset)=>setMonth(new Date(year,monthNo+offset,1));
  return <div className="calendar-card visit-calendar"><div className="calendar-head"><button onClick={()=>move(-1)} aria-label="이전 달"><ChevronLeft/></button><b>{year}년 {monthNo+1}월</b><button onClick={()=>move(1)} aria-label="다음 달"><ChevronRight/></button></div><div className="week-row">{['일','월','화','수','목','금','토'].map(d=><span key={d}>{d}</span>)}</div><div className="date-grid">{cells.map((day,i)=>day===null?<span key={`blank-${i}`}/>:<button key={day} className={`${selectedDate===`${year}-${String(monthNo+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`?'selected':''} ${marked.has(`${year}-${String(monthNo+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`)?'has-event':''}`} onClick={()=>setSelectedDate(`${year}-${String(monthNo+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`)}>{day}</button>)}</div><p className="calendar-legend"><i/> 방문 기록이 있는 날</p></div>;
}

function VisitItemDetail({ visit, child, documents = [], backendOnline, onBack, onSaved, onToast }) {
  const [editing,setEditing]=useState(false), [saving,setSaving]=useState(false);
  const [form,setForm]=useState({visitedOn:visit.visitedOn||'',hospitalName:visit.hospitalName||'',department:visit.department||'',memo:visit.memo||''});
  useScrollTop(visit.visitId);
  const [selectedDocument,setSelectedDocument]=useState(null);
  useBackLayer(!!selectedDocument,()=>setSelectedDocument(null));
  const [linkedDocs,setLinkedDocs]=useState([]), [docsError,setDocsError]=useState(''), [docsLoading,setDocsLoading]=useState(true);
  React.useEffect(()=>{let active=true;setDocsLoading(true);setDocsError('');
    (async()=>{const result=[];const seen=new Set();let cursor;do{const page=await api.documents(visit.patientId||child?.id,visit.visitId,cursor);result.push(...(page.items||[]));if(!page.nextCursor)break;if(seen.has(page.nextCursor))throw new Error('문서 목록을 불러오지 못했어요.');cursor=page.nextCursor;seen.add(cursor);}while(cursor);return result;})().then(v=>{if(active)setLinkedDocs(v);}).catch(e=>{if(active)setDocsError(errorMessage(e));}).finally(()=>{if(active)setDocsLoading(false);});
    return()=>{active=false;};
  },[visit.visitId,child?.id,selectedDocument]);
  const save=async()=>{if(!backendOnline){onToast('백엔드에 연결된 뒤 수정할 수 있어요');return;}try{setSaving(true);const updated=await api.updateVisit(visit.visitId,{patientId:visit.patientId||child?.id,...form,visitStatus:visit.visitStatus||'DONE',version:visit.version});await onSaved(updated);setEditing(false);onToast('방문 기록을 수정했어요');}catch(error){onToast(error.message||'수정하지 못했어요');}finally{setSaving(false)}};
  const remove=async()=>{if(!backendOnline){onToast('백엔드에 연결된 뒤 삭제할 수 있어요');return;}if(!window.confirm('이 방문 기록을 삭제할까요?'))return;try{setSaving(true);await api.deleteVisit(visit.visitId);onToast('방문 기록을 삭제했어요');onBack();}catch(error){onToast(error.message||'방문 기록을 삭제하지 못했어요');}finally{setSaving(false)}};
  if(selectedDocument) return <DocumentItemDetail key={selectedDocument.documentId} document={selectedDocument} visits={[visit]} backLabel="방문 기록으로" onBack={()=>setSelectedDocument(null)} onToast={onToast}/>;
  return <div className="nested-detail visit-detail"><button type="button" className="detail-back" onClick={onBack}><ChevronLeft aria-hidden="true"/> 방문 기록으로</button><div className="detail-title-row"><div><span className="eyebrow">방문 기록 상세</span><h2>{form.department||form.hospitalName||'병원 방문'}</h2><p>{[form.hospitalName,form.visitedOn].filter(Boolean).join(' · ')}</p></div><span className="detail-actions"><button className="edit-button" onClick={()=>setEditing(!editing)}>{editing?<X/>:<Pencil/>}{editing?' 취소':' 수정'}</button><button className="edit-button danger" disabled={saving} onClick={remove}><Trash2/> 삭제</button></span></div>{editing?<div className="inline-panel visit-compose"><label className="field-label">방문 날짜<input className="select-field" type="date" value={form.visitedOn} onChange={e=>setForm({...form,visitedOn:e.target.value})}/></label><label className="field-label">병원명<input className="select-field" value={form.hospitalName} onChange={e=>setForm({...form,hospitalName:e.target.value})}/></label><label className="field-label">진료 목적<input className="select-field" value={form.department} onChange={e=>setForm({...form,department:e.target.value})}/></label><label className="field-label">메모<textarea className="visit-memo" value={form.memo} onChange={e=>setForm({...form,memo:e.target.value})}/></label><button className="primary-button compact" disabled={saving} onClick={save}><Save/>{saving?'저장 중…':'수정 내용 저장'}</button></div>:<><div className="detail-info-card"><InfoRow label="방문 날짜" value={visit.visitedOn}/><InfoRow label="병원" value={visit.hospitalName||'병원 정보 없음'}/><InfoRow label="진료 목적" value={visit.department||'기록 없음'}/><InfoRow label="메모" value={visit.memo||'작성된 메모가 없어요.'}/></div>
    <div className="visit-docs"><div className="visit-docs-head"><b>연결된 문서</b><span>{linkedDocs.length}건</span></div>
      {docsLoading ? <p role="status">문서를 불러오는 중이에요.</p> : docsError ? <p role="alert">{docsError}</p> : linkedDocs.length ? <div className="visit-doc-list">{linkedDocs.map(doc=>(
        <button className="visit-doc visit-doc-link" key={doc.documentId} onClick={()=>setSelectedDocument(doc)}><span className="visit-doc-icon"><FileText/></span><span className="visit-doc-text"><b>{documentDisplayName(doc)}</b><small>문서 상세 및 원본 보기</small></span><ChevronRight size={18}/></button>
      ))}</div> : <p className="visit-doc-empty">이 방문에 연결된 문서가 아직 없어요.</p>}
    </div></>}</div>;
}

function useScrollTop(dep) {
  React.useEffect(() => {
    const node = document.querySelector('.screen-content');
    if (node) node.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [dep]);
}

const DOC_STATUS = { UPLOADED:'분석 대기', PROCESSING:'분석 중', READY:'분석 완료', NEEDS_REVIEW:'일부 분석 완료 · 확인 필요', ANALYZING:'분석 중', DONE:'분석 완료', FAILED:'분석 실패' };

function InfoRow({label,value}) { return <div className="info-row"><span>{label}</span><p>{value}</p></div>; }

function DocumentDetail({ onToast, visits = [], documents = [], child, onDataChange, backendOnline, onChildOpen, onCalendar, onMedication, medicationDraft }) {
  const [uploading, setUploading] = useState(false);
  const [visit, setVisit] = useState('');
  const [newVisit, setNewVisit] = useState(false);
  const [fileName, setFileName] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [tracked, setTracked] = useState(null);
  React.useEffect(()=>{ if(visits.length && !visit) setVisit(visits[0].visitId); },[visits]);
  const complete = async () => {
    if (!child?.id) { onToast('아이를 먼저 등록해 주세요'); return; }
    if (!file) { onToast('먼저 업로드할 문서를 선택해주세요'); return; }
    if (!backendOnline) { onToast('체험 모드에서는 업로드 흐름만 확인할 수 있어요'); return; }
    let createdVisit = false;
    try {
      setSaving(true); let visitId = visit;
      if (newVisit) {
        const inputs = document.querySelectorAll('.new-visit-form input');
        const created = await api.createVisit({ patientId: child?.id, visitedOn: inputs[0]?.value, hospitalName: inputs[1]?.value, department: inputs[2]?.value, memo: '', visitStatus: 'DONE', version: null });
        visitId = created.visitId;
        if (visitId) { setVisit(visitId); setNewVisit(false); createdVisit = true; }
      }
      if (!visitId) { onToast('연결할 방문 기록을 선택해주세요'); return; }
      const uploaded=await api.uploadDocument(visitId, file);
      setTracked(uploaded.documentId);
      onToast('문서를 방문 기록에 연결해 업로드했어요'); setUploading(false); setFileName(''); setFile(null); await onDataChange?.();
    } catch (error) { onToast(error.message || '문서를 업로드하지 못했어요'); if (createdVisit) onDataChange?.(); }
    finally { setSaving(false); }
  };
  const closeSheet = () => { if (!saving) setUploading(false); };
  useBackLayer(!!selectedDocument, () => setSelectedDocument(null));
  useBackLayer(uploading, () => (saving ? false : closeSheet()));
  if (!child?.id) return <ChildRequiredState icon={FileText} title="건강 문서" onChildOpen={onChildOpen}/>;
  if(selectedDocument) return <DocumentItemDetail document={selectedDocument} visits={visits} onBack={()=>setSelectedDocument(null)} onToast={onToast}/>;
  return <div className="page padded detail-page">
    <div className="detail-hero"><span className="detail-icon"><FileText/></span><div><h2>건강 문서</h2><p>진료·검사 문서를 방문 기록과 연결해 맥락까지 함께 보관해요.</p></div></div>
    <div className="link-info"><Link2/><div><b>문서와 방문 기록을 연결하세요</b><p>진료별 문서와 AI 설명을 한 화면에서 다시 확인할 수 있어요.</p></div></div>
    {tracked && <div className="inline-panel" role="status"><b>문서를 올렸어요.</b><p>AI 도담에서 이 문서에 대해 물어볼 수 있어요.</p></div>}
    {onCalendar && <button className="create-link" onClick={onCalendar}><CalendarDays/> 할 일 후보와 캘린더 확인</button>}
    <div className="list-header"><h3>최근 문서</h3><button>전체보기</button></div>
    <div className="record-list">{documents.length ? documents.slice(0,5).map(doc=>{const linked=visits.find(v=>v.visitId===doc.visitId);return <button type="button" onClick={()=>setSelectedDocument(doc)} key={doc.documentId}><span className="record-date">{String(doc.visitedOn||doc.createdAt||'').slice(0,10)}</span><span><b>{documentDisplayName(doc)}</b><small>{doc.visitId?<><Link2/> {linked?.hospitalName||'병원 방문'} 기록에 연결됨</>:'연결된 방문 기록 없음'}</small></span><ChevronRight/></button>}) : <div className="empty-record">아직 등록된 건강 문서가 없어요.</div>}</div>
    <button className="primary-button" onClick={()=>setUploading(true)}><Upload/> 문서 업로드</button>
    {uploading && <div className="modal-backdrop" onMouseDown={closeSheet}><div className="sheet upload-sheet" role="dialog" aria-modal="true" aria-label="문서 업로드" onMouseDown={e=>e.stopPropagation()}>
      <div className="sheet-handle"/><button className="sheet-close" onClick={closeSheet} disabled={saving} aria-label="닫기"><X/></button>
      <div className="sheet-heading"><Upload/><div><h3>문서 업로드</h3><p>문서가 속한 병원 방문 기록을 선택해주세요.</p></div></div>
      <label className={`upload-drop ${fileName?'filled':''}`}><input type="file" onChange={e=>{const picked=e.target.files?.[0];setFile(picked||null);setFileName(picked?.name||'')}} accept="image/*,.pdf"/><Upload/><b>{fileName || '파일을 선택하거나 촬영하세요'}</b><small>PDF, JPG, PNG · 최대 20MB</small></label>
      <label className="field-label">연결할 병원 방문 기록</label>
      {!newVisit ? <select className="select-field" value={visit} onChange={e=>setVisit(e.target.value)}>{visits.length?visits.map(v=><option value={v.visitId} key={v.visitId}>{v.visitedOn} · {v.hospitalName||'병원 방문'}</option>):<option value="">방문 기록이 없습니다</option>}</select> : <div className="new-visit-form"><input type="date" defaultValue="2026-10-24"/><input placeholder="병원명" defaultValue="동네봄 소아청소년과"/><input placeholder="방문 목적 (예: 정기 검진)"/></div>}
      <button className="create-link" onClick={()=>setNewVisit(!newVisit)}>{newVisit?<ChevronLeft/>:<Plus/>}{newVisit?' 기존 방문 기록 선택':' 방문 기록이 없나요? 새로 만들기'}</button>
      <button className="primary-button upload-sheet-submit" disabled={saving || !file} onClick={complete}><Upload/> {saving?'올리는 중…':'업로드'}</button>
      <p className="upload-sheet-hint">방문 기록에 연결해 저장돼요</p>
    </div></div>}
  </div>;
}

function DocumentItemDetail({ document, visits, onBack, onToast, backLabel = "건강 문서로" }) {
  const storageKey=documentNoteKey(document.documentId);
  const [detail,setDetail]=useState(document), [editing,setEditing]=useState(false);
  const [detailError,setDetailError]=useState(''), [detailLoading,setDetailLoading]=useState(true), [detailRetry,setDetailRetry]=useState(0);
  const [ai,setAi]=useState(null); const [removing,setRemoving]=useState(false);
  const [meta,setMeta]=useState(()=>{try{return JSON.parse(localStorage.getItem(storageKey))||{name:document.documentName||'',note:''}}catch{return{name:document.documentName||'',note:''}}});
  React.useEffect(()=>{let active=true;setDetail(document);setDetailError('');
    if(String(document.documentId).startsWith('sample')){setDetailLoading(false);return;}
    setDetailLoading(true);api.document(document.documentId).then(value=>{if(active)setDetail(value);})
      .catch(error=>{if(active)setDetailError(errorMessage(error));}).finally(()=>{if(active)setDetailLoading(false);});
    return()=>{active=false;};
  },[document.documentId,detailRetry]);
  React.useEffect(()=>{if(String(document.documentId).startsWith('sample'))return; Promise.all([api.aiDocument(document.documentId),api.aiDocumentStatus(document.documentId),api.aiDocumentSections(document.documentId),api.aiDocumentFacts(document.documentId),api.aiDocumentCitations(document.documentId)]).then(([doc,status,sections,facts,citations])=>setAi({doc,status,sections,facts,citations})).catch(()=>setAi(null));},[document.documentId]);
  const linked=visits.find(v=>v.visitId===detail.visitId);
  const save=()=>{const name=meta.name.trim()||document.documentName||'';const next={...meta,name};localStorage.setItem(storageKey,JSON.stringify(next));setMeta(next);setEditing(false);onToast('문서 이름과 메모를 수정했어요');};
  const remove=async()=>{if(!window.confirm('이 문서를 삭제할까요?'))return;try{setRemoving(true);await api.deleteDocument(document.documentId);onToast('문서를 삭제했어요');onBack();}catch(e){onToast(e.message||'문서를 삭제하지 못했어요');}finally{setRemoving(false)}};
  return <div className="nested-detail"><button className="detail-back" onClick={onBack}><ChevronLeft/> {backLabel}</button><div className="detail-title-row document-title-row"><div><span className="eyebrow">건강 문서 상세</span><h2>{meta.name||detail.documentName}</h2><p>{String(detail.visitedOn||detail.createdAt||'').slice(0,10)}</p></div><span className="detail-actions"><button className="edit-button" onClick={()=>setEditing(!editing)}>{editing?<X/>:<Pencil/>}{editing?' 취소':' 수정'}</button><button className="edit-button danger" disabled={removing} onClick={remove}><Trash2/> 삭제</button></span></div>{editing?<div className="inline-panel"><label className="field-label">문서 이름<input className="select-field" value={meta.name} onChange={e=>setMeta({...meta,name:e.target.value})}/></label><label className="field-label">메모<textarea className="visit-memo" placeholder="이 문서에 대한 메모를 남겨보세요" value={meta.note} onChange={e=>setMeta({...meta,note:e.target.value})}/></label><button className="primary-button compact" onClick={save}><Save/> 수정 내용 저장</button></div>:<><div className="detail-info-card"><InfoRow label="연결된 방문" value={linked?`${linked.visitedOn} · ${linked.hospitalName||'병원 방문'}`:'연결된 방문 기록 없음'}/><InfoRow label="업로드 상태" value="업로드 완료"/><InfoRow label="메모" value={meta.note||'작성된 메모가 없어요.'}/></div>{ai&&<div className="detail-info-card ai-evidence-card"><InfoRow label="AI 설명 상태" value={ai.status?.status||ai.status?.explanationStatus||'확인 완료'}/><InfoRow label="근거 사실" value={`${ai.facts?.items?.length||ai.facts?.facts?.length||0}건`}/><InfoRow label="출처 인용" value={`${ai.citations?.items?.length||ai.citations?.citations?.length||0}건`}/><InfoRow label="설명 섹션" value={`${ai.sections?.items?.length||ai.sections?.sections?.length||0}개`}/></div>}{detailLoading?<p role="status">원본 문서 정보를 불러오는 중이에요.</p>:detailError?<div role="alert"><p>{detailError}</p><button className="primary-button" onClick={()=>setDetailRetry(value=>value+1)}>다시 불러오기</button></div>:!detail.signedUrl?<p>원본 문서 주소를 불러올 수 없어요.</p>:null}{!detailLoading&&!detailError&&detail.signedUrl&&<a className="primary-button document-open" href={detail.signedUrl}><FileText/> 원본 문서 보기</a>}</>}</div>;
}


const MEDICAL_CARDS = ['records','meds','vaccine','documents'];

function MedicalHub({ onOpen, visits = [], documents = [] }) {
  const cards = MEDICAL_CARDS.map(id => featureCards.find(c => c.id === id)).filter(Boolean);
  const counts = { records: visits.length, documents: documents.length };
  return <div className="page padded"><div className="page-title"><span className="eyebrow">건강 기록</span><h2>의료 기록</h2><p>병원 방문부터 복약·접종·검사 문서까지 한곳에서 관리해요.</p></div>
    <div className="all-list">{cards.map(({id,title,subtitle,icon:Icon,tone})=>(
      <button key={id} onClick={()=>onOpen(id)}><span className={`feature-icon ${tone}`}><Icon/></span><span><b>{title}</b><small>{subtitle}</small></span>{counts[id]!==undefined&&<em className="hub-count">{counts[id]}건</em>}<ChevronRight/></button>
    ))}</div></div>;
}

function MoreScreen({onOpen, me, child, onProfile, onChild, onLogout}) {
  const relation = me?.role === 'PATIENT' ? '아이' : '보호자';
  return <div className="page padded"><div className="page-title"><span className="eyebrow">도담 메뉴</span><h2>전체</h2><p>내 프로필과 도담의 모든 기능을 한곳에서 관리하세요.</p></div>
    <button className="profile-banner" onClick={onProfile}>
      <span className="profile-banner-avatar">{(me?.name||'도').slice(0,1)}</span>
      <span className="profile-banner-text"><b>{me?.name || '보호자'}</b><small>{relation} · {child?.fullName || '아이 미선택'}</small></span>
      <ChevronRight/>
    </button>
    <div className="section-label">내 정보</div>
    <div className="all-list">
      <button onClick={onProfile}><span className="feature-icon rose"><CircleUserRound/></span><span><b>내 프로필 관리</b><small>보호자 정보와 아이 프로필 확인</small></span><ChevronRight/></button>
      <button onClick={onChild}><span className="feature-icon lilac"><UsersRound/></span><span><b>아이 전환 · 추가</b><small>가족 공유 코드로 연결하기</small></span><ChevronRight/></button>
      <button onClick={()=>onOpen('calendar')}><span className="feature-icon mint"><CalendarDays/></span><span><b>가족 건강 일정</b><small>복약·진료·접종 일정 관리</small></span><ChevronRight/></button>
    </div>
    <div className="section-label">전체 기능</div>
    <div className="all-list">{featureCards.map(({id,title,subtitle,icon:Icon,tone})=><button key={id} onClick={()=>onOpen(id)}><span className={`feature-icon ${tone}`}><Icon/></span><span><b>{title}</b><small>{subtitle}</small></span><ChevronRight/></button>)}</div>
    <button className="logout-button wide" onClick={onLogout}>로그아웃</button>
  </div>;
}

function NotificationSheet({ notis, userId, onClose, onRead, onReadAll, onOpen }) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const shown = notis.items.filter(item => !unreadOnly || !item.readAt);
  const fmt = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${d.getMonth()+1}.${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="sheet notification-sheet" onMouseDown={e=>e.stopPropagation()}><SheetHandle onClose={onClose}/><button className="sheet-close" aria-label="알림 닫기" onClick={onClose}><X/></button>
    <div className="notification-header">
      {settingsOpen ? <><button className="notification-back" aria-label="알림 목록으로 돌아가기" onClick={() => setSettingsOpen(false)}><ChevronLeft/></button><div><h3>알림 설정</h3><p>이 기기에서 받을 알림을 관리해요</p></div></> : <><Bell className="notification-header-icon"/><div><h3>알림</h3><p>읽지 않은 알림 {notis.unreadCount}건</p></div><button className="notification-settings-link" onClick={() => setSettingsOpen(true)}><Settings2 size={16}/> 설정</button></>}
    </div>
    {settingsOpen ? <div className="notification-settings-view"><PushSettings key={userId} userId={userId}/><p className="notification-settings-note">기기와 네트워크 상태에 따라 알림이 늦게 도착할 수 있어요.</p></div> : <>
    {notis.items.length ? <>
      <div className="notification-toolbar"><div className="noti-filters"><button aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>전체</button><button aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>안 읽음 <span>{notis.unreadCount}</span></button></div>{notis.unreadCount > 0 && <button className="notification-read-all" onClick={onReadAll}><CheckCircle2 size={14}/> 모두 읽기</button>}</div>
      {!shown.length && <p className="memo-empty">불러온 알림은 모두 확인했어요.</p>}
      <div className="noti-list">{shown.map(n => {
        const splitAt = n.type === 'SCHEDULE_DUE' ? n.message.indexOf('\n') : -1;
        const context = splitAt >= 0 ? n.message.slice(0, splitAt) : '';
        const content = splitAt >= 0 ? n.message.slice(splitAt + 1) : n.message;
        return <button key={n.id} className={n.readAt ? '' : 'unread'} onClick={() => { if (!n.readAt) onRead(n.id); onOpen?.(n); }}>
          <span className="noti-type-icon" aria-hidden="true">{n.type === 'SCHEDULE_DUE' ? <CalendarDays/> : <UsersRound/>}</span>
          <span className="noti-text">
            <span className="notification-meta"><span>{n.type === 'SCHEDULE_DUE' ? '복약·일정' : '가족 소식'}</span><time dateTime={n.createdAt}>{fmt(n.createdAt)}</time>{!n.readAt && <span className="notification-unread" aria-label="읽지 않음"/>}</span>
            <b>{content}</b>
            {context && <span className="notification-context">{context}</span>}
          </span>
          {n.type === 'SCHEDULE_DUE' && <ChevronRight className="notification-row-arrow" size={17} aria-label="일정 확인"/>}
        </button>;
      })}</div>
    </> : <div className="notification-empty"><span className="notification-empty-icon"><Bell size={27} strokeWidth={1.5} aria-hidden="true"/></span><h4>아직 도착한 알림이 없어요</h4><p>복약 시간과 예정된 일정,<br/>가족의 새로운 소식을 여기서 확인해요.</p></div>}
    </>}
  </div></div>;
}

function GuardianNameSheet({ me, onClose, onSaved }) {
  const needsName = me?.name === '이용자';
  const [name, setName] = useState(needsName ? '' : me?.name || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = React.useRef(false);

  async function submit(event) {
    event.preventDefault();
    if (pending.current || !name.trim()) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const updated = await api.updateMyProfile({ name: name.trim() });
      onSaved(updated);
      onClose();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <ProfileEditSheet title="내 프로필 수정" description="도담에서 표시할 이름을 수정할 수 있어요." icon={CircleUserRound} pending={pending} onClose={onClose}>
    <form className="child-profile-form" onSubmit={submit}>
      <fieldset className="child-profile-fields" disabled={busy}>
        <label htmlFor="guardian-name">{needsName ? '도담에서 사용할 이름' : '보호자 이름'} <span>필수</span></label>
        <input id="guardian-name" value={name} autoComplete="name" required maxLength={100} onChange={event => setName(event.target.value)}/>
      </fieldset>
      {error && <p className="child-form-error" role="alert">{error}</p>}
      <div className="child-form-actions">
        <button type="button" disabled={busy} onClick={onClose}>취소</button>
        <button type="submit" className="child-save" disabled={busy || !name.trim()}>{busy ? '저장 중…' : '변경사항 저장'}</button>
      </div>
    </form>
  </ProfileEditSheet>;
}

function WithdrawalSheet({ onClose, onWithdraw }) {
  const pending = React.useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await onWithdraw();
    } catch (error) {
      pending.current = false;
      setBusy(false);
      setError(errorMessage(error, '회원 탈퇴를 완료하지 못했어요.'));
    }
  }

  return <ProfileEditSheet title="회원 탈퇴" description="도담에서 탈퇴할까요?" icon={TriangleAlert} pending={pending} onClose={onClose}>
    <div className="child-profile-form">
      <p className="withdrawal-description">도담 프로필과 가족 연결이 해제돼요. 같은 카카오 계정으로 다시 가입해도 기존 연결은 복구되지 않아요.</p>
      {error && <p className="child-form-error" role="alert">{error}</p>}
      <div className="child-form-actions">
        <button type="button" disabled={busy} onClick={onClose}>취소</button>
        <button type="button" className="withdrawal-confirm" disabled={busy} onClick={confirm}>{busy ? '탈퇴 처리 중…' : '탈퇴하기'}</button>
      </div>
    </div>
  </ProfileEditSheet>;
}

function ProfileSheet({hidden,child,me,backendOnline,onClose,onToast,onLogout,onWithdraw,onJoined,onChildOpen,onEditChild,onEditProfile}) {
  const name = child?.fullName || '아이 미선택';
  const relation = me?.role === 'PATIENT' ? '아이' : '보호자';
  const [needsName] = useState(me?.name === '이용자');
  React.useEffect(() => { if (needsName) onEditProfile(true); }, [needsName, onEditProfile]);
  const [parents,setParents] = useState(null);
  const [disconnecting, setDisconnecting] = useState(null);
  const [disconnectError, setDisconnectError] = useState('');
  const [codeOpen,setCodeOpen] = useState(false);
  const [joinOpen,setJoinOpen] = useState(false);
  const [code,setCode] = useState('');
  const [busy,setBusy] = useState(false);
  const [accounts,setAccounts] = useState([]);
  const [relations,setRelations] = useState([]);
  const [relationBusy,setRelationBusy] = useState(null);
  const pendingRelations = relations.filter(r => r.status === 'REQUESTED' || r.status === 'PENDING');

  React.useEffect(() => {
    if (!child?.id || !backendOnline) { setParents([]); return; }
    let active = true;
    setParents(null);
    api.childParents(child.id).then(result => { if (active) setParents(result); })
      .catch(() => { if (active) setParents([]); });
    return () => { active = false; };
  }, [child?.id, child?.inviteCode, backendOnline]);

  React.useEffect(() => {
    setDisconnecting(null);
    setDisconnectError('');
  }, [child?.id]);

  React.useEffect(() => {
    if (!backendOnline) { setAccounts([]); return; }
    api.accounts().then(result => setAccounts(result?.accounts || [])).catch(() => setAccounts([]));
  }, [backendOnline]);
  React.useEffect(() => {
    if (!backendOnline) { setRelations([]); return; }
    api.careRelations().then(setRelations).catch(() => setRelations([]));
  }, [backendOnline]);

  const switchAccount = async (role) => {
    try { setBusy(true); await disablePush().catch(() => {}); await api.switchAccount(role); onToast('계정을 전환했어요. 알림 설정에서 이 기기 알림을 다시 켜주세요.'); await onJoined?.(); onClose(); }
    catch (e) { onToast(e.message || '계정을 전환하지 못했어요'); }
    finally { setBusy(false); }
  };

  const mutateRelation = async (relationId, action, success) => {
    try { setRelationBusy(relationId); const next = await action(relationId); setRelations(next || []); onToast(success); await onJoined?.(); }
    catch (e) { onToast(e.message || '가족 연결 상태를 변경하지 못했어요'); }
    finally { setRelationBusy(null); }
  };

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(child.inviteCode); onToast('연결 코드를 복사했어요'); }
    catch { onToast('코드를 길게 눌러 복사해주세요'); }
  };
  const disconnectParent = async () => {
    if (!disconnecting || busy) return;
    const target = disconnecting;
    setBusy(true);
    setDisconnectError('');
    try {
      await api.disconnectChildParent(child.id, target.userId);
      setParents(current => current?.filter(parent => parent.userId !== target.userId) ?? null);
      setDisconnecting(null);
      setCodeOpen(false);
      await onJoined?.(child.id);
      onToast('가족 연결을 해제했어요');
    } catch (error) {
      setDisconnectError(errorMessage(error, '연결을 해제하지 못했어요. 다시 시도해 주세요.'));
    } finally { setBusy(false); }
  };
  const join = async () => {
    if (!code.trim()) { onToast('연결 코드를 입력해주세요'); return; }
    if (me?.role && me.role !== 'CAREGIVER') { onToast('아이 기록은 보호자 계정에서 연결할 수 있어요'); return; }
    try { setBusy(true); const linked = await api.joinChild(code.trim().toUpperCase());
      onToast('가족 기록을 연결했어요.'); setCode(''); setJoinOpen(false); await onJoined?.(linked.id); }
    catch (e) { onToast(e.message || '연결 코드가 올바르지 않아요'); }
    finally { setBusy(false); }
  };

  return <div className="modal-backdrop profile-backdrop" hidden={hidden} onMouseDown={onClose}><div className="sheet profile-sheet" onMouseDown={e=>e.stopPropagation()}><div className="sheet-header"><SheetHandle onClose={onClose}/><button className="sheet-close" aria-label="프로필 닫기" onClick={onClose}><X/></button>
    <div className="profile-head"><span className="big-avatar">{(me?.name||'도').slice(0,1)}</span><div><h3>{me?.name || '내 프로필'}</h3><p>{relation} · {name}</p></div></div>
  </div>

    <div className="profile-edit-actions">
      <button className="outline-button" onClick={() => onEditProfile(true)}>내 프로필 수정</button>
      {child?.id && <button className="outline-button" onClick={onEditChild}>아이 정보 수정 · {child.name || child.fullName}</button>}
    </div>
    <div className="family-block">
      <div className="family-block-head"><b>연결된 가족</b><span>{parents===null?'…':`${parents.length}명`}</span></div>
      {parents===null ? <p className="family-empty">불러오는 중…</p>
        : parents.length ? <div className="family-members">{parents.map(p=>{
            const displayName = p.me ? (me?.name ?? p.name) : p.name;
            return <div className="family-member" key={p.userId}><span className="family-avatar">{(displayName||'?').slice(0,1)}</span>
              <span className="family-text"><b>{displayName}{p.me && ' (나)'}</b><small>보호자</small></span>
              {p.canDisconnect && <button type="button" className="family-disconnect"
                disabled={busy} aria-label={`${displayName} 연결 해제`}
                onClick={() => { setDisconnectError(''); setDisconnecting(p); }}>연결 해제</button>}
            </div>;
          })}</div>
        : <p className="family-empty">아직 연결된 가족이 없어요.</p>}
      {disconnecting && <div className="withdrawal-panel" role="group" aria-label="가족 연결 해제 확인">
        <strong>{disconnecting.name}님과 연결을 해제할까요?</strong>
        <p>이 아이의 기록 공유가 즉시 종료되고 기존 공유 코드는 새 코드로 바뀌어요.</p>
        {disconnectError && <p role="alert">{disconnectError}</p>}
        <div className="child-form-actions">
          <button type="button" disabled={busy} onClick={() => setDisconnecting(null)}>취소</button>
          <button type="button" className="child-save" disabled={busy} onClick={disconnectParent}>{busy ? '해제 중…' : '연결 해제 확인'}</button>
        </div>
      </div>}
    </div>

    {pendingRelations.length > 0 && <div className="family-block relation-block">
      <div className="family-block-head"><b>돌봄 연결 요청</b><span>{pendingRelations.length}건</span></div>
      {pendingRelations.map(r => <div className="relation-row" key={r.id || r.relationId}>
        <span><b>{r.counterpartName || r.caregiverName || r.patientName || r.userName || '가족 구성원'}</b><small>{r.statusLabel || r.status || '연결 요청'}</small></span>
        {(r.status === 'REQUESTED' || r.status === 'PENDING') && me?.role === 'PATIENT' && <span className="relation-actions">
          <button disabled={relationBusy === (r.id || r.relationId)} onClick={() => mutateRelation(r.id || r.relationId, api.acceptCareRelation, '가족 연결을 수락했어요')}>수락</button>
          <button disabled={relationBusy === (r.id || r.relationId)} onClick={() => mutateRelation(r.id || r.relationId, api.rejectCareRelation, '가족 연결 요청을 거절했어요')}>거절</button>
        </span>}
      </div>)}
    </div>}

    {child?.inviteCode && <>
      <button className="outline-button" onClick={()=>setCodeOpen(v=>!v)}><Link2/> {codeOpen?'연결 코드 숨기기':'연결 코드 보기'}</button>
      {codeOpen && <div className="invite-code-box">
        <small>{name}의 가족 연결 코드</small>
        <b>{child.inviteCode}</b>
        <p>가족에게 이 코드를 알려주세요. 도담에 가입한 뒤 <em>코드로 연결하기</em>에 입력하면 같은 아이의 기록을 함께 볼 수 있어요.</p>
        <button className="primary-button compact" onClick={copyCode}>코드 복사</button>
      </div>}
    </>}

    <button className="outline-button" onClick={()=>setJoinOpen(v=>!v)}><UserRoundPlus/> {joinOpen?'입력 취소':'코드로 연결하기'}</button>
    {joinOpen && <div className="new-child-form">
      <input placeholder="전달받은 연결 코드" value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/>
      <button className="primary-button compact" disabled={busy} onClick={join}>{busy?'연결 중…':'이 코드로 연결'}</button>
    </div>}

    <button className="outline-button" onClick={onChildOpen}><Plus/> 아이 프로필 추가 · 전환</button>
    <button className="logout-button" onClick={onLogout}>로그아웃</button>
    {backendOnline && me?.id && <button type="button" className="withdrawal-link" onClick={onWithdraw}>회원 탈퇴</button>}
  </div></div>;
}

createRoot(document.getElementById('root')).render(<App />);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('서비스 워커 등록 실패', error));
  });
}
