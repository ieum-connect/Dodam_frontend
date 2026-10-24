import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bell, CalendarDays, ChevronLeft, ChevronRight, CircleUserRound, FileText,
  HeartPulse, Home, MessageCircleHeart, MoreHorizontal, NotebookPen, Pill,
  Plus, Search, ShieldCheck, Sparkles, Syringe, TrendingUp, Upload, X,
  CheckCircle2, Clock3, MapPin, Send, Baby, Scale, Ruler, Gift, BookOpen,
  Stethoscope, Camera, Menu, Mic, Square, Link2, UserRoundPlus, UsersRound,
  Pencil, Save
} from 'lucide-react';
import './styles.css';
import { api, ApiError, errorMessage } from './api';

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
  const [backendOnline, setBackendOnline] = useState(false);
  const [tab, setTab] = useState('home');
  const [detail, setDetail] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [childOpen, setChildOpen] = useState(false);
  const [activeChild, setActiveChild] = useState({ name: '박도윤', fullName: '박도윤', age: '생후 18개월', emoji: '👶🏻' });
  const [children, setChildren] = useState([]);
  const [me, setMe] = useState(null);
  const [notis, setNotis] = useState({ items: [], unreadCount: 0 });
  const [notiOpen, setNotiOpen] = useState(false);
  const screenRef = React.useRef(null);
  const [visits, setVisits] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [toast, setToast] = useState('');
  const [chat, setChat] = useState([]);

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
    return { id: child.id, name: displayName, fullName: displayName, age: childAge(child.birthDate), birthDate: child.birthDate, inviteCode: child.inviteCode, parentCount: child.parentCount, emoji: index % 2 ? '👧🏻' : '👶🏻' };
  };

  const isCompleteChild = (child) => Boolean(
    child?.birthDate && child?.name && child.name !== '이름 확인 필요'
  );

  const loadFamilyData = async () => {
    try {
      const childRows = await api.children();
      const mapped = childRows.map(normalizeChild);
      const ordered = [...mapped].sort((a, b) => Number(isCompleteChild(b)) - Number(isCompleteChild(a)));
      setChildren(ordered);
      const current = ordered.find((child) => child.id === activeChild.id);
      const selected = (current && isCompleteChild(current))
        ? current
        : ordered.find(isCompleteChild) || current || ordered[0];
      if (selected) setActiveChild(selected);
      const patientId = selected?.id;
      api.notifications().then(p => setNotis({ items: p?.items || [], unreadCount: p?.unreadCount || 0 })).catch(()=>{});
      const [visitPage, documentPage] = await Promise.all([api.visits(patientId), api.documents(patientId)]);
      setVisits(visitPage?.items || []);
      setDocuments(documentPage?.items || []);
    } catch (error) {
      if (error.status !== 401) showToast('일부 건강 기록을 불러오지 못했어요');
    }
  };

  React.useEffect(() => {
    api.me().then((user) => { setMe(user); setLoggedIn(true); setBackendOnline(true); return loadFamilyData(); })
      .catch(() => {}).finally(() => setAuthReady(true));
  }, []);

  const login = async (mode, account) => {
    if (mode === 'kakao') { window.location.href = api.kakaoLoginUrl; return; }
    try {
      const user = await api.demoLogin(account); setMe(user); setBackendOnline(true); setLoggedIn(true); await loadFamilyData(); showToast(`${user?.name || '테스트 계정'}(으)로 로그인했어요`);
    } catch (error) {
      setLoggedIn(false);
      setBackendOnline(false);
      showToast(error instanceof ApiError ? '로그인에 실패했어요. 백엔드 연결을 확인해주세요.' : '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.');
    }
  };

  const logout = async () => {
    try {
      if (backendOnline) await api.logout();
    } catch (error) {
      // Clear local state even if the server session has already expired.
    } finally {
      setLoggedIn(false);
      setMe(null);
      setProfileOpen(false);
      setChildOpen(false);
      setTab('home');
      setDetail(null);
      setChildren([]);
      setVisits([]);
      setDocuments([]);
      setChat([]);
      setActiveChild({ name: '박도윤', fullName: '박도윤', age: '생후 18개월', emoji: '👶🏻' });
    }
  };

  React.useEffect(() => {
    if (!loggedIn || !backendOnline || !activeChild.id) return;
    Promise.all([api.visits(activeChild.id), api.documents(activeChild.id)]).then(([v,d]) => { setVisits(v?.items||[]); setDocuments(d?.items||[]); }).catch(()=>{});
  }, [activeChild.id]);

  const MEDICAL_IDS = ['records','meds','vaccine','documents'];
  const navigate = (id) => {
    if (['chat','home','calendar','medical','more'].includes(id)) { setDetail(null); setTab(id); return; }
    setTab('home'); setDetail(id);
  };
  const activeNav = MEDICAL_IDS.includes(detail || tab) ? 'medical' : (detail || tab);

  const openFeature = (id) => {
    if (id === 'chat' || id === 'calendar') { setTab(id); setDetail(null); return; }
    setDetail(id);
  };

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
          <HeartPulse size={54}/><span className="mini-dot d1"/><span className="mini-dot d2"/>
        </div>
        <p className="rail-foot">도담 · 우리 가족 건강 동반자</p>
      </aside>

      <main className={`phone-frame ${!loggedIn ? 'login-frame' : ''}`}>
        {!authReady ? <div className="app-loading"><span className="login-heart"><HeartPulse/></span><p>가족 건강 기록을 불러오는 중...</p></div> : !loggedIn ? <LoginScreen onLogin={login} /> : <>
        <header className="topbar">
          {detail ? (
            <button className="icon-button" onClick={() => setDetail(null)} aria-label="뒤로"><ChevronLeft/></button>
          ) : <Logo compact />}
          <div className="top-actions">
            <button className={`icon-button ${notis.unreadCount ? 'dot' : ''}`} onClick={() => setNotiOpen(true)} aria-label="알림"><Bell/></button>
            <button className="avatar-button" onClick={() => setProfileOpen(true)} aria-label="내 프로필"><span>{(me?.name || '도담').slice(0,1)}</span></button>
          </div>
        </header>

        <div className="screen-content" ref={screenRef}>
          {detail ? <DetailScreen type={detail} onToast={showToast} visits={visits} documents={documents} child={activeChild} onDataChange={loadFamilyData} backendOnline={backendOnline} /> : tab === 'home' ? (
            <HomeScreen onOpen={openFeature} child={activeChild} onChildOpen={() => setChildOpen(true)} />
          ) : tab === 'medical' ? <MedicalHub onOpen={openFeature} visits={visits} documents={documents} />
            : tab === 'calendar' ? <CalendarScreen onToast={showToast} />
            : tab === 'chat' ? <ChatScreen chat={chat} setChat={setChat} child={activeChild} documents={documents} backendOnline={backendOnline} onToast={showToast} />
            : tab === 'records' ? <DetailScreen type="records" onToast={showToast} visits={visits} documents={documents} child={activeChild} onDataChange={loadFamilyData} backendOnline={backendOnline} />
            : tab === 'documents' ? <DetailScreen type="documents" onToast={showToast} visits={visits} documents={documents} child={activeChild} onDataChange={loadFamilyData} backendOnline={backendOnline} />
            : <MoreScreen onOpen={openFeature} me={me} child={activeChild} onProfile={()=>setProfileOpen(true)} onChild={()=>setChildOpen(true)} onLogout={logout} />}
        </div>

        <BottomNav tab={activeNav} setTab={navigate} />
        </>}
      </main>

      {notiOpen && <NotificationSheet notis={notis} onClose={() => setNotiOpen(false)} onToast={showToast}
        onRead={async (id) => { try { await api.readNotification(id); const p = await api.notifications(); setNotis({ items: p?.items||[], unreadCount: p?.unreadCount||0 }); } catch {} }}
        onReadAll={async () => { try { await api.readAllNotifications(); const p = await api.notifications(); setNotis({ items: p?.items||[], unreadCount: p?.unreadCount||0 }); showToast('모든 알림을 읽음 처리했어요'); } catch { showToast('알림을 처리하지 못했어요'); } }} />}
      {profileOpen && <ProfileSheet child={activeChild} me={me} backendOnline={backendOnline} onClose={() => setProfileOpen(false)} onToast={showToast} onLogout={logout} onJoined={loadFamilyData} onChildOpen={() => { setProfileOpen(false); setChildOpen(true); }} />}
      {childOpen && <ChildSheet active={activeChild} children={children} backendOnline={backendOnline} onSelect={(child) => { setActiveChild(child); setChildOpen(false); showToast(`${child.name} 기록으로 전환했어요`); }} onClose={() => setChildOpen(false)} onToast={showToast} onCreated={loadFamilyData} />}
      {toast && <div className="toast"><CheckCircle2 size={18}/>{toast}</div>}
    </div>
  );
}

const DEMO_ACCOUNTS = [['MINJI','김민지','엄마','민'],['SOONJA','김순자','할머니','순'],['JIHUN','박지훈','아빠','지']];

function LoginScreen({ onLogin }) {
  const [emailOpen, setEmailOpen] = useState(false);
  return <div className="login-screen">
    <div className="login-visual"><span className="login-glow one"/><span className="login-glow two"/><div className="login-heart"><HeartPulse/></div><div className="login-badge badge-one"><Syringe/><span>예방접종</span></div><div className="login-badge badge-two"><TrendingUp/><span>성장 기록</span></div><div className="login-badge badge-three"><FileText/><span>건강 문서</span></div></div>
    <div className="login-content"><Logo/><span className="eyebrow">FAMILY HEALTH COMPANION</span><h1>아이의 건강한 성장을<br/><strong>도담</strong>과 함께 기록해요.</h1><p>병원 기록부터 예방접종, 성장 발달까지<br/>우리 가족의 건강 정보를 안전하게 관리하세요.</p>
      {emailOpen && <div className="login-fields"><label>이메일<input type="email" placeholder="name@example.com"/></label><label>비밀번호<input type="password" placeholder="비밀번호를 입력해주세요"/></label></div>}
      <div className="login-actions"><button className="kakao-button" onClick={()=>onLogin('kakao')}><span>💬</span> 카카오로 3초 만에 시작하기</button><button className="email-button" onClick={()=>emailOpen?onLogin('demo'):setEmailOpen(true)}>{emailOpen?'체험 계정으로 로그인':'이메일로 계속하기'}</button></div>
      <div className="demo-login">
        <div className="demo-login-head"><span>테스트 계정</span><em>비밀번호 없이 바로 입장</em></div>
        <div className="demo-list">
          {DEMO_ACCOUNTS.map(([key, name, relation, initial]) => (
            <button key={key} className="demo-main" onClick={()=>onLogin('demo', key)}>
              <span className="demo-avatar">{initial}</span>
              <span className="demo-text"><b>{name}</b><small>{relation} · 박도윤, 박다연</small></span>
            </button>
          ))}
        </div>
      </div>
      <button className="signup-link">처음이신가요? <b>회원가입</b></button><p className="login-terms">계속하면 도담의 이용약관 및 개인정보 처리방침에 동의하게 됩니다.</p>
    </div>
  </div>;
}

function Logo({ compact = false }) {
  return <div className={`logo ${compact ? 'compact' : ''}`}><span className="logo-mark"><HeartPulse/></span><span>도담</span></div>;
}

function HomeScreen({ onOpen, child, onChildOpen }) {
  const todayLabel = new Intl.DateTimeFormat('ko-KR', { month:'long', day:'numeric', weekday:'long' }).format(new Date());
  return <>
    <section className="welcome">
      <div className="welcome-copy"><p className="muted">{todayLabel}</p><h2><strong>{child.name}</strong>와 오늘도<br/>건강한 하루 보내세요 <span>♡</span></h2></div>
      <button className="child-chip" onClick={onChildOpen}><span className="child-face">{child.emoji}</span><span className="child-chip-copy"><b>{child.fullName}</b><small>{child.age || '생년월일 미등록'} · 아이 전환</small></span><ChevronRight size={17}/></button>
    </section>

    <section className="today-card">
      <div className="section-heading"><div><span className="eyebrow">TODAY</span><h3>오늘의 건강 일정</h3></div><button>전체보기 <ChevronRight size={14}/></button></div>
      <div className="timeline-item"><span className="time">08:30</span><span className="timeline-dot peach"/><div><b>비타민 D</b><small>1방울 · 아침 식후</small></div><button className="check-button"><CheckCircle2/></button></div>
      <div className="timeline-item"><span className="time">14:00</span><span className="timeline-dot pink"/><div><b>소아과 예방접종</b><small>동네봄 소아청소년과 · DTaP</small></div><button className="more-button"><MoreHorizontal/></button></div>
    </section>

    <section className="section-block">
      <div className="section-heading"><div><h3>무엇을 도와드릴까요?</h3><p>필요한 건강 관리를 바로 시작해보세요</p></div></div>
      <div className="feature-grid">{featureCards.map(({ id, title, subtitle, icon: Icon, tone }) => (
        <button className="feature-card" key={id} onClick={() => onOpen(id)}>
          <span className={`feature-icon ${tone}`}><Icon/></span><span><b>{title}</b><small>{subtitle}</small></span><ChevronRight className="feature-arrow" size={17}/>
        </button>
      ))}</div>
    </section>

    <section className="growth-card" onClick={() => onOpen('growth')}>
      <div><span className="eyebrow">GROWTH REPORT</span><h3>{child.name}가 쑥쑥 자라고 있어요!</h3><p>지난달보다 키가 <b>1.2cm</b> 자랐어요.</p><button>성장 리포트 보기 <ChevronRight size={15}/></button></div>
      <div className="growth-visual"><div className="chart-bars"><i/><i/><i/><i/><i/></div><Baby size={42}/></div>
    </section>

    <section className="tip-card"><span className="tip-icon"><Sparkles/></span><div><b>도담이 알려드려요</b><p>18개월 아이는 하루 11–14시간의 수면이 권장돼요. 일정한 취침 루틴을 만들어보세요.</p></div></section>
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

function CalendarScreen({ onToast }) {
  return <div className="page padded"><div className="page-title"><span className="eyebrow">CARE CALENDAR</span><h2>가족 건강 일정</h2><p>복약, 진료, 접종 일정을 한눈에 관리해요.</p></div>
    <div className="calendar-card"><div className="calendar-head"><button><ChevronLeft/></button><b>2026년 10월</b><button><ChevronRight/></button></div><div className="week-row">{['일','월','화','수','목','금','토'].map(d=><span key={d}>{d}</span>)}</div><div className="date-grid">{[18,19,20,21,22,23,24,25,26,27,28,29,30,31].map(n=><button key={n} className={n===24?'selected':n===27?'has-event':''}>{n}</button>)}</div></div>
    <h3 className="subheading">10월 24일 토요일</h3>
    <div className="schedule-list"><Schedule icon={Pill} time="08:30" title="비타민 D" note="아침 식후 · 1방울" color="peach"/><Schedule icon={Syringe} time="14:00" title="DTaP 추가 접종" note="동네봄 소아청소년과" color="lilac"/></div>
    <button className="primary-button" onClick={()=>onToast('새 일정을 추가할 준비가 되었어요')}><Plus/> 일정 추가하기</button>
  </div>;
}

function Schedule({icon:Icon,time,title,note,color}) { return <div className="schedule"><span className={`feature-icon ${color}`}><Icon/></span><div><small>{time}</small><b>{title}</b><p>{note}</p></div><ChevronRight/></div> }

function ChatScreen({ chat, setChat, child, documents, backendOnline, onToast }) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [chatError, setChatError] = useState(null);
  const [docPicker, setDocPicker] = useState(false);
  const send = () => { if (!input.trim() || sending) return; const q = input.trim(); setInput(''); ask(q); };
  const ask = async (question, docIds) => {
    if (sending) return;
    const messageIndex = chat.length;
    setChat(prev => [...prev, question]); setAiMessages(prev => [...prev, null]); setChatError(null); setDocPicker(false);
    if (!backendOnline) { setChatError({ index: messageIndex, code: 'BACKEND_OFFLINE', message: '백엔드 서버에 연결할 수 없어요. 서버 실행 상태를 확인해주세요.' }); return; }
    if (!child?.id) { setChatError({ index: messageIndex, code: 'PATIENT_REQUIRED', message: '먼저 상담할 아이를 선택해주세요.' }); return; }
    if (!documents?.length) { setChatError({ index: messageIndex, code: 'DOCUMENT_REQUIRED', message: 'AI가 근거로 확인할 건강 문서가 없어요. 문서를 먼저 업로드해주세요.' }); return; }
    try {
      setSending(true);
      const sessions = await api.chatSessions(child.id);
      const session = sessions?.[0] || await api.createChatSession(child.id, `${child.name} 건강 상담`);
      const targetDocs = docIds?.length ? docIds : documents.slice(0,5).map(d=>d.documentId);
      const result = await api.askChat(session.sessionId, question, targetDocs);
      let answer = [...result].reverse().find(m=>m.role==='ASSISTANT')?.content;
      // AI 서버 호출이 실패해도 이미 분석이 끝난 문서면 저장된 설명을 보여준다.
      if ((!answer || answer.startsWith('AI 답변 생성 실패')) && targetDocs.length === 1) {
        const stored = await api.aiDocument(targetDocs[0]).catch(()=>null);
        if (stored?.content && stored.resultStatus === 'COMPLETE') {
          answer = `${stored.title ? stored.title + '\n\n' : ''}${stored.content}\n\n(저장된 분석 결과입니다. AI 서버 응답이 없어 마지막 분석 내용을 보여드렸어요.)`;
        }
      }
      if (!answer) throw new ApiError('AI 서버에서 답변이 오지 않았어요.', 502, { code: 'AI_EMPTY_RESPONSE' });
      if (answer.startsWith('AI 답변 생성 실패')) setChatError({ index: messageIndex, code: 'AI_GENERATION_FAILED', message: answer.replace(/^AI 답변 생성 실패 \(AI_GENERATION_FAILED\):\s*/, '') });
      else setAiMessages(prev => prev.map((message, index) => index === messageIndex ? answer : message));
    } catch (error) {
      const message = errorMessage(error, 'AI 답변을 가져오지 못했어요.');
      setChatError({ index: messageIndex, code: error.code || 'AI_CHAT_ERROR', message }); onToast(message);
    }
    finally { setSending(false); }
  };
  return <div className="chat-page"><div className="chat-hero"><span className="ai-orb"><Sparkles/></span><div><span className="eyebrow">AI CARE ASSISTANT</span><h2>안녕하세요, 도담이에요</h2><p>아이의 건강 기록을 바탕으로<br/>궁금한 점을 쉽게 설명해드릴게요.</p></div></div>
    <div className="suggestions"><button onClick={()=>setInput('예방접종 일정을 알려줘')}>예방접종 일정</button><button onClick={()=>setInput('성장 발달이 잘 되고 있나요?')}>성장 발달 확인</button><button className={docPicker?'active':''} onClick={()=>setDocPicker(v=>!v)}>문서 설명</button></div>
    {docPicker && <div className="doc-picker"><div className="doc-picker-head"><b>어떤 문서를 설명해드릴까요?</b><button onClick={()=>setDocPicker(false)} aria-label="닫기"><X/></button></div>
      {documents?.length ? <div className="doc-picker-list">{documents.map(doc=>(
        <button key={doc.documentId} disabled={sending} onClick={()=>ask(`'${doc.documentName}' 문서를 보호자가 이해하기 쉽게, 용어 풀이와 함께 자세히 설명해줘. 수치가 있으면 정상 범위와 비교해서 알려주고 집에서 살펴볼 점도 알려줘.`, [doc.documentId])}>
          <span className="doc-picker-icon"><FileText/></span>
          <span className="doc-picker-text"><b>{doc.documentName}</b><small>{doc.visitedOn || ''} · {DOC_STATUS[doc.documentStatus]||doc.documentStatus||''}</small></span>
          <ChevronRight/>
        </button>))}</div>
      : <p className="doc-picker-empty">등록된 건강 문서가 없어요. 의료 &gt; 건강 문서에서 먼저 업로드해주세요.</p>}
    </div>}
    <div className="messages"><div className="message ai">무엇이 궁금하신가요? 의료 기록과 성장 데이터를 참고해 함께 살펴볼게요.</div>{chat.map((m,i)=><React.Fragment key={`${i}-${m}`}><div className="message user">{m}</div>{aiMessages[i]&&<div className="message ai">{aiMessages[i]}</div>}{chatError?.index===i&&<div className="message error"><b>{chatError.code}</b><span>{chatError.message}</span><button onClick={()=>setInput(m)}>질문 다시 불러오기</button></div>}</React.Fragment>)}{sending&&<div className="message ai">도담이가 의료 기록을 살펴보고 있어요…</div>}</div>
    <div className="chat-input"><button type="button" aria-label="문서 첨부 안내" onClick={()=>onToast('건강 문서 메뉴에 등록된 최근 문서를 자동으로 참고해요')}><Plus/></button><input value={input} disabled={sending} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="도담이에게 물어보세요"/><button type="button" className="send" disabled={sending||!input.trim()} onClick={send} aria-label="질문 보내기"><Send/></button></div>
    <p className="disclaimer">AI 답변은 참고용이며, 진단을 대신하지 않습니다.</p>
  </div>;
}

function DetailScreen({ type, onToast, visits = [], documents = [], child, onDataChange, backendOnline }) {
  const [title, desc] = detailCopy[type];
  if(type==='growth') return <GrowthDetail onToast={onToast}/>;
  if(type==='welfare') return <WelfareDetail/>;
  if(type==='memo') return <MemoDetail onToast={onToast} child={child} backendOnline={backendOnline}/>;
  if(type==='documents') return <DocumentDetail onToast={onToast} visits={visits} documents={documents} child={child} onDataChange={onDataChange} backendOnline={backendOnline}/>;
  if(type==='records') return <VisitRecordsDetail onToast={onToast} visits={visits} documents={documents} child={child} onDataChange={onDataChange} backendOnline={backendOnline}/>;
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

function VisitRecordsDetail({ onToast, visits = [], documents = [], child, onDataChange, backendOnline }) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [month, setMonth] = useState(() => { const source = visits[0]?.visitedOn || new Date().toISOString().slice(0,10); return new Date(`${source.slice(0,7)}-01T00:00:00`); });
  const [form, setForm] = useState({ visitedOn: '2026-10-24', hospitalName: '', department: '', memo: '' });
  const submit = async () => {
    if (!backendOnline) { onToast('백엔드에 연결된 뒤 방문 기록을 저장할 수 있어요'); return; }
    if (!child?.id || !form.hospitalName.trim()) { onToast('병원명을 입력해주세요'); return; }
    try {
      setSaving(true);
      await api.createVisit({ patientId: child.id, ...form, hospitalName: form.hospitalName.trim(), department: form.department.trim(), visitStatus: 'DONE', version: null });
      setAdding(false); setForm({ visitedOn: '2026-10-24', hospitalName: '', department: '', memo: '' });
      await onDataChange?.(); onToast('병원 방문 기록을 저장했어요');
    } catch (error) { onToast(error.message || '방문 기록을 저장하지 못했어요'); }
    finally { setSaving(false); }
  };
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
  const linkedDocs=(documents||[]).filter(doc=>doc.visitId===visit.visitId);
  const save=async()=>{if(!backendOnline){onToast('백엔드에 연결된 뒤 수정할 수 있어요');return;}try{setSaving(true);const updated=await api.updateVisit(visit.visitId,{patientId:visit.patientId||child?.id,...form,visitStatus:visit.visitStatus||'DONE',version:visit.version});await onSaved(updated);setEditing(false);onToast('방문 기록을 수정했어요');}catch(error){onToast(error.message||'수정하지 못했어요');}finally{setSaving(false)}};
  return <div className="nested-detail"><button className="detail-back" onClick={onBack}><ChevronLeft/> 방문 기록으로</button><div className="detail-title-row"><div><span className="eyebrow">VISIT DETAIL</span><h2>{form.department||form.hospitalName||'병원 방문'}</h2><p>{[form.hospitalName,form.visitedOn].filter(Boolean).join(' · ')}</p></div><button className="edit-button" onClick={()=>setEditing(!editing)}>{editing?<X/>:<Pencil/>}{editing?' 취소':' 수정'}</button></div>{editing?<div className="inline-panel visit-compose"><label className="field-label">방문 날짜<input className="select-field" type="date" value={form.visitedOn} onChange={e=>setForm({...form,visitedOn:e.target.value})}/></label><label className="field-label">병원명<input className="select-field" value={form.hospitalName} onChange={e=>setForm({...form,hospitalName:e.target.value})}/></label><label className="field-label">진료 목적<input className="select-field" value={form.department} onChange={e=>setForm({...form,department:e.target.value})}/></label><label className="field-label">메모<textarea className="visit-memo" value={form.memo} onChange={e=>setForm({...form,memo:e.target.value})}/></label><button className="primary-button compact" disabled={saving} onClick={save}><Save/>{saving?'저장 중…':'수정 내용 저장'}</button></div>:<><div className="detail-info-card"><InfoRow label="방문 날짜" value={visit.visitedOn}/><InfoRow label="병원" value={visit.hospitalName||'병원 정보 없음'}/><InfoRow label="진료 목적" value={visit.department||'기록 없음'}/><InfoRow label="메모" value={visit.memo||'작성된 메모가 없어요.'}/></div>
    <div className="visit-docs"><div className="visit-docs-head"><b>연결된 문서</b><span>{linkedDocs.length}건</span></div>
      {linkedDocs.length ? <div className="visit-doc-list">{linkedDocs.map(doc=>(
        <div className="visit-doc" key={doc.documentId}><span className="visit-doc-icon"><FileText/></span><span className="visit-doc-text"><b>{doc.documentName||'이름 없는 문서'}</b><small>{DOC_STATUS[doc.documentStatus]||doc.documentStatus||'상태 확인 중'}</small></span></div>
      ))}</div> : <p className="visit-doc-empty">이 방문에 연결된 문서가 아직 없어요.</p>}
    </div></>}</div>;
}

function useScrollTop(dep) {
  React.useEffect(() => {
    const node = document.querySelector('.screen-content');
    if (node) node.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [dep]);
}

const DOC_STATUS = { UPLOADED:'업로드 완료', READY:'분석 준비 완료', ANALYZING:'분석 중', DONE:'분석 완료', FAILED:'분석 실패' };

function InfoRow({label,value}) { return <div className="info-row"><span>{label}</span><p>{value}</p></div>; }

function DocumentDetail({ onToast, visits = [], documents = [], child, onDataChange, backendOnline }) {
  const [uploading, setUploading] = useState(false);
  const [visit, setVisit] = useState('');
  const [newVisit, setNewVisit] = useState(false);
  const [fileName, setFileName] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  React.useEffect(()=>{ if(visits.length && !visit) setVisit(visits[0].visitId); },[visits]);
  const complete = async () => {
    if (!file) { onToast('먼저 업로드할 문서를 선택해주세요'); return; }
    if (!backendOnline) { onToast('체험 모드에서는 업로드 흐름만 확인할 수 있어요'); return; }
    try {
      setSaving(true); let visitId = visit;
      if (newVisit) {
        const inputs = document.querySelectorAll('.new-visit-form input');
        const created = await api.createVisit({ patientId: child?.id, visitedOn: inputs[0]?.value, hospitalName: inputs[1]?.value, department: inputs[2]?.value, memo: '', visitStatus: 'DONE', version: null });
        visitId = created.visitId;
      }
      if (!visitId) { onToast('연결할 방문 기록을 선택해주세요'); return; }
      await api.uploadDocument(visitId, file);
      onToast('문서를 방문 기록에 연결해 업로드했어요'); setUploading(false); setFileName(''); setFile(null); await onDataChange?.();
    } catch (error) { onToast(error.message || '문서를 업로드하지 못했어요'); }
    finally { setSaving(false); }
  };
  if(selectedDocument) return <DocumentItemDetail document={selectedDocument} visits={visits} onBack={()=>setSelectedDocument(null)} onToast={onToast}/>;
  return <div className="page padded detail-page">
    <div className="detail-hero"><span className="detail-icon"><FileText/></span><div><h2>건강 문서</h2><p>진료·검사 문서를 방문 기록과 연결해 맥락까지 함께 보관해요.</p></div></div>
    <div className="link-info"><Link2/><div><b>문서와 방문 기록을 연결하세요</b><p>진료별 문서와 AI 설명을 한 화면에서 다시 확인할 수 있어요.</p></div></div>
    <div className="list-header"><h3>최근 문서</h3><button>전체보기</button></div>
    <div className="record-list">{(documents.length?documents:[{documentId:'sample1',createdAt:'2026-10-12',documentName:'혈액검사 결과지',visitId:'sample'},{documentId:'sample2',createdAt:'2026-09-12',documentName:'진료 확인서'}]).slice(0,5).map(doc=>{const linked=visits.find(v=>v.visitId===doc.visitId);return <button type="button" onClick={()=>setSelectedDocument(doc)} key={doc.documentId}><span className="record-date">{String(doc.visitedOn||doc.createdAt||'').slice(0,10)}</span><span><b>{doc.documentName}</b><small>{doc.visitId?<><Link2/> {linked?.hospitalName||'병원 방문'} 기록에 연결됨</>:'연결된 방문 기록 없음'}</small></span><ChevronRight/></button>})}</div>
    <button className="primary-button" onClick={()=>setUploading(true)}><Upload/> 문서 업로드</button>
    {uploading && <div className="inline-panel">
      <div className="panel-title"><div><b>새 문서 업로드</b><p>문서가 속한 병원 방문 기록을 선택해주세요.</p></div><button onClick={()=>setUploading(false)}><X/></button></div>
      <label className={`upload-drop ${fileName?'filled':''}`}><input type="file" onChange={e=>{const picked=e.target.files?.[0];setFile(picked||null);setFileName(picked?.name||'')}} accept="image/*,.pdf"/><Upload/><b>{fileName || '파일을 선택하거나 촬영하세요'}</b><small>PDF, JPG, PNG · 최대 20MB</small></label>
      <label className="field-label">연결할 병원 방문 기록</label>
      {!newVisit ? <select className="select-field" value={visit} onChange={e=>setVisit(e.target.value)}>{visits.length?visits.map(v=><option value={v.visitId} key={v.visitId}>{v.visitedOn} · {v.hospitalName||'병원 방문'}</option>):<option value="">방문 기록이 없습니다</option>}</select> : <div className="new-visit-form"><input type="date" defaultValue="2026-10-24"/><input placeholder="병원명" defaultValue="동네봄 소아청소년과"/><input placeholder="방문 목적 (예: 정기 검진)"/></div>}
      <button className="create-link" onClick={()=>setNewVisit(!newVisit)}>{newVisit?<ChevronLeft/>:<Plus/>}{newVisit?' 기존 방문 기록 선택':' 방문 기록이 없나요? 새로 만들기'}</button>
      <button className="primary-button compact" disabled={saving} onClick={complete}><Link2/> {saving?'업로드 중…':newVisit?'방문 기록 생성하고 연결':'선택한 방문 기록에 연결'}</button>
    </div>}
  </div>;
}

function DocumentItemDetail({ document, visits, onBack, onToast }) {
  const storageKey=`dodam-document-note-${document.documentId}`;
  const [detail,setDetail]=useState(document), [editing,setEditing]=useState(false);
  const [meta,setMeta]=useState(()=>{try{return JSON.parse(localStorage.getItem(storageKey))||{name:document.documentName||'',note:''}}catch{return{name:document.documentName||'',note:''}}});
  React.useEffect(()=>{if(String(document.documentId).startsWith('sample'))return;api.document(document.documentId).then(setDetail).catch(()=>{});},[document.documentId]);
  const linked=visits.find(v=>v.visitId===detail.visitId);
  const save=()=>{localStorage.setItem(storageKey,JSON.stringify(meta));setEditing(false);onToast('문서 이름과 메모를 수정했어요');};
  return <div className="nested-detail"><button className="detail-back" onClick={onBack}><ChevronLeft/> 건강 문서로</button><div className="detail-title-row"><div><span className="eyebrow">DOCUMENT DETAIL</span><h2>{meta.name||detail.documentName}</h2><p>{String(detail.visitedOn||detail.createdAt||'').slice(0,10)}</p></div><button className="edit-button" onClick={()=>setEditing(!editing)}>{editing?<X/>:<Pencil/>}{editing?' 취소':' 수정'}</button></div>{editing?<div className="inline-panel"><label className="field-label">문서 이름<input className="select-field" value={meta.name} onChange={e=>setMeta({...meta,name:e.target.value})}/></label><label className="field-label">메모<textarea className="visit-memo" placeholder="이 문서에 대한 메모를 남겨보세요" value={meta.note} onChange={e=>setMeta({...meta,note:e.target.value})}/></label><button className="primary-button compact" onClick={save}><Save/> 수정 내용 저장</button></div>:<><div className="detail-info-card"><InfoRow label="문서 종류" value={detail.documentType||'건강 문서'}/><InfoRow label="연결된 방문" value={linked?`${linked.visitedOn} · ${linked.hospitalName||'병원 방문'}`:'연결된 방문 기록 없음'}/><InfoRow label="처리 상태" value={detail.documentStatus||detail.resultStatus||'보관 중'}/><InfoRow label="메모" value={meta.note||'작성된 메모가 없어요.'}/></div>{detail.signedUrl&&<a className="primary-button document-open" href={detail.signedUrl} target="_blank" rel="noreferrer"><FileText/> 원본 문서 보기</a>}</>}</div>;
}

function MemoDetail({ onToast, child, backendOnline }) {
  const today = new Date().toISOString().slice(0,10);
  const [date, setDate] = useState(today);
  const [body, setBody] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  const load = async () => {
    if (!backendOnline || !child?.id) { setRecords([]); setLoading(false); return; }
    try { const page = await api.healthRecords(child.id); setRecords(page?.items || []); }
    catch { onToast('메모를 불러오지 못했어요'); }
    finally { setLoading(false); }
  };
  React.useEffect(() => { setLoading(true); load(); }, [child?.id, backendOnline]);

  const save = async () => {
    if (!body.trim()) { onToast('메모 내용을 입력해주세요'); return; }
    if (!backendOnline || !child?.id) { onToast('아이를 선택하고 백엔드 연결을 확인해주세요'); return; }
    try {
      setSaving(true);
      if (editing) { await api.updateHealthRecord(editing, { patientId: child.id, body: body.trim() }); onToast('메모를 수정했어요'); }
      else { await api.createHealthRecord({ patientId: child.id, body: body.trim() }); onToast('메모를 저장했어요'); }
      setBody(''); setEditing(null); await load();
    } catch (e) { onToast(e.message || '메모를 저장하지 못했어요'); }
    finally { setSaving(false); }
  };

  const remove = async (recordId) => {
    try { await api.deleteHealthRecord(recordId); onToast('메모를 삭제했어요'); if (editing === recordId) { setEditing(null); setBody(''); } await load(); }
    catch (e) { onToast(e.message || '메모를 삭제하지 못했어요'); }
  };

  const dayKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const dateLabel = (key) => { const [y,m,dd] = key.split('-'); return `${Number(m)}월 ${Number(dd)}일`; };
  const weekday = (key) => ['일','월','화','수','목','금','토'][new Date(key).getDay()] + '요일';
  const timeLabel = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
  const grouped = React.useMemo(() => {
    const map = {};
    for (const r of records) { const k = dayKey(r.recordedAt || r.createdAt); (map[k] ||= []).push(r); }
    for (const k of Object.keys(map)) map[k].sort((a,b) => new Date(a.recordedAt||a.createdAt) - new Date(b.recordedAt||b.createdAt));
    return map;
  }, [records]);
  const dates = React.useMemo(() => Object.keys(grouped).sort((a,b) => b.localeCompare(a)), [grouped]);

  return <div className="page padded detail-page"><div className="detail-hero"><span className="detail-icon"><NotebookPen/></span><div><h2>육아 메모</h2><p>{child?.fullName || '아이'}의 일상 속 작은 변화를 기록해보세요.</p></div></div>
    <div className="memo-compose">
      <label className="date-picker"><CalendarDays/><span><small>기록 날짜</small><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></span></label>
      <textarea placeholder="오늘 아이에게 어떤 일이 있었나요?" value={body} onChange={e=>setBody(e.target.value)} maxLength={2000}/>
      <div className="memo-actions">
        {editing && <button className="outline-button compact" onClick={()=>{setEditing(null);setBody('');}}>수정 취소</button>}
        <button className="primary-button compact" disabled={saving} onClick={save}>{saving ? '저장 중…' : editing ? '메모 수정' : '메모 저장'}</button>
      </div>
    </div>
    <div className="list-header"><h3>날짜별 메모</h3><span className="list-count">{records.length}건</span></div>
    {loading ? <p className="memo-empty">불러오는 중…</p>
      : records.length ? <>
        <div className="memo-dates">
          <button className={selectedDate===null?'on':''} onClick={()=>setSelectedDate(null)}>전체</button>
          {dates.map(d => <button key={d} className={selectedDate===d?'on':''} onClick={()=>setSelectedDate(d)}>{dateLabel(d)}<small>{grouped[d].length}</small></button>)}
        </div>
        <div className="memo-timeline">
          {(selectedDate ? [selectedDate] : dates).map(d => (
            <section key={d}>
              <div className="timeline-date"><b>{dateLabel(d)}</b><span>{weekday(d)} · {grouped[d].length}건</span></div>
              {grouped[d].map(r => (
                <div className="timeline-row" key={r.recordId}>
                  <span className="timeline-time">{timeLabel(r.recordedAt || r.createdAt)}</span>
                  <span className="timeline-rail" aria-hidden="true"><i/></span>
                  <span className="timeline-card">
                    <span className="timeline-head"><b>{r.authorName || '보호자'}</b>
                      <span className="memo-row-actions">
                        <button onClick={()=>{setEditing(r.recordId); setBody(r.body);}} aria-label="수정"><Pencil/></button>
                        <button onClick={()=>remove(r.recordId)} aria-label="삭제"><X/></button>
                      </span>
                    </span>
                    <small>{r.body}</small>
                  </span>
                </div>))}
            </section>))}
        </div>
      </> : <p className="memo-empty">아직 저장된 메모가 없어요. 첫 메모를 남겨보세요.</p>}
  </div>;
}

function GrowthDetail({onToast}) { return <div className="page padded detail-page"><div className="detail-hero"><span className="detail-icon"><TrendingUp/></span><div><h2>성장 발달 기록</h2><p>키와 몸무게 변화를 또래 성장 곡선과 함께 확인해요.</p></div></div>
  <div className="metric-grid"><div><span><Ruler/> 키</span><b>82.4<small>cm</small></b><em>+1.2cm</em></div><div><span><Scale/> 몸무게</span><b>11.2<small>kg</small></b><em>+0.3kg</em></div></div>
  <div className="growth-chart"><div className="chart-title"><b>최근 6개월 성장</b><span>또래 58 백분위</span></div><div className="line-chart"><svg viewBox="0 0 320 130"><path className="area" d="M10 110 C70 94, 96 102, 140 66 S230 74, 310 25 L310 125 L10 125Z"/><path className="line" d="M10 110 C70 94, 96 102, 140 66 S230 74, 310 25"/><circle cx="310" cy="25" r="5"/></svg><div className="chart-labels"><span>5월</span><span>6월</span><span>7월</span><span>8월</span><span>9월</span><span>10월</span></div></div></div>
  <div className="milestone"><span>🧸</span><div><b>18개월 발달 체크</b><p>혼자 걷기, 간단한 단어 말하기 등 8개 중 7개를 달성했어요.</p></div><ChevronRight/></div>
  <button className="primary-button" onClick={()=>onToast('오늘의 성장 기록을 추가할게요')}><Plus/> 성장 기록 추가</button></div> }

function WelfareDetail() { const services=[['아이돌봄 서비스','맞벌이 가정 · 소득 기준에 따라 지원','신청 가능'],['영유아 보육료 지원','만 0–5세 어린이집 이용 아동','대상 가능성 높음'],['부모급여','만 0–1세 아동 가정','조건 확인']]; return <div className="page padded detail-page"><div className="detail-hero"><span className="detail-icon"><Gift/></span><div><h2>복지 서비스</h2><p>가족 정보를 바탕으로 놓치기 쉬운 정부 혜택을 찾아드려요.</p></div></div><label className="search-box"><Search/><input placeholder="지원금, 돌봄 서비스 검색"/></label><div className="recommend-banner"><Sparkles/><div><b>박도윤 가족 맞춤 추천</b><p>현재 확인할 수 있는 혜택이 6개 있어요.</p></div></div><div className="service-list">{services.map(([name,desc,badge])=><button><div><span>{badge}</span><b>{name}</b><p>{desc}</p></div><ChevronRight/></button>)}</div><p className="source-note"><ShieldCheck/> 복지로 및 정부24의 공개 정보를 기반으로 안내합니다.</p></div> }

const MEDICAL_CARDS = ['records','meds','vaccine','documents'];

function MedicalHub({ onOpen, visits = [], documents = [] }) {
  const cards = MEDICAL_CARDS.map(id => featureCards.find(c => c.id === id)).filter(Boolean);
  const counts = { records: visits.length, documents: documents.length };
  return <div className="page padded"><div className="page-title"><span className="eyebrow">MEDICAL RECORDS</span><h2>의료 기록</h2><p>병원 방문부터 복약·접종·검사 문서까지 한곳에서 관리해요.</p></div>
    <div className="all-list">{cards.map(({id,title,subtitle,icon:Icon,tone})=>(
      <button key={id} onClick={()=>onOpen(id)}><span className={`feature-icon ${tone}`}><Icon/></span><span><b>{title}</b><small>{subtitle}</small></span>{counts[id]!==undefined&&<em className="hub-count">{counts[id]}건</em>}<ChevronRight/></button>
    ))}</div></div>;
}

function MoreScreen({onOpen, me, child, onProfile, onChild, onLogout}) {
  const relation = GUARDIAN_RELATION[me?.name] || '보호자';
  return <div className="page padded"><div className="page-title"><span className="eyebrow">ALL SERVICES</span><h2>전체</h2><p>내 프로필과 도담의 모든 기능을 한곳에서 관리하세요.</p></div>
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

function NotificationSheet({ notis, onClose, onRead, onReadAll }) {
  const fmt = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${d.getMonth()+1}.${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="sheet" onMouseDown={e=>e.stopPropagation()}><div className="sheet-handle"/><button className="sheet-close" onClick={onClose}><X/></button>
    <div className="sheet-heading"><Bell/><div><h3>알림</h3><p>읽지 않은 알림 {notis.unreadCount}건</p></div></div>
    {notis.items.length ? <>
      <div className="noti-list">{notis.items.map(n => (
        <button key={n.id} className={n.readAt ? '' : 'unread'} onClick={()=>!n.readAt && onRead(n.id)}>
          <span className="noti-dot" aria-hidden="true"/>
          <span className="noti-text"><b>{n.message}</b><small>{n.type} · {fmt(n.createdAt)}</small></span>
        </button>))}</div>
      {notis.unreadCount > 0 && <button className="outline-button" onClick={onReadAll}><CheckCircle2/> 모두 읽음으로 표시</button>}
    </> : <p className="memo-empty">새로운 알림이 없어요.</p>}
  </div></div>;
}

const GUARDIAN_RELATION = { '김민지':'엄마', '김순자':'할머니', '박지훈':'아빠' };

function ProfileSheet({child,me,backendOnline,onClose,onToast,onLogout,onJoined,onChildOpen}) {
  const name = child?.fullName || '아이 미선택';
  const relation = GUARDIAN_RELATION[me?.name] || '보호자';
  const [parents,setParents] = useState(null);
  const [codeOpen,setCodeOpen] = useState(false);
  const [joinOpen,setJoinOpen] = useState(false);
  const [code,setCode] = useState('');
  const [busy,setBusy] = useState(false);

  React.useEffect(() => {
    if (!child?.id || !backendOnline) { setParents([]); return; }
    api.childParents(child.id).then(setParents).catch(()=>setParents([]));
  }, [child?.id, backendOnline]);

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(child.inviteCode); onToast('연결 코드를 복사했어요'); }
    catch { onToast('코드를 길게 눌러 복사해주세요'); }
  };
  const join = async () => {
    if (!code.trim()) { onToast('연결 코드를 입력해주세요'); return; }
    try { setBusy(true); const joined = await api.joinChild(code.trim());
      onToast(`${joined.name} 기록에 연결했어요`); setCode(''); setJoinOpen(false); await onJoined?.(); onClose(); }
    catch (e) { onToast(e.message || '연결 코드가 올바르지 않아요'); }
    finally { setBusy(false); }
  };

  return <div className="modal-backdrop" onMouseDown={onClose}><div className="sheet" onMouseDown={e=>e.stopPropagation()}><div className="sheet-handle"/><button className="sheet-close" onClick={onClose}><X/></button>
    <div className="profile-head"><span className="big-avatar">{(me?.name||'도').slice(0,1)}</span><div><h3>{me?.name || '내 프로필'}</h3><p>{relation} · {name}</p></div></div>

    <div className="family-block">
      <div className="family-block-head"><b>연결된 가족</b><span>{parents===null?'…':`${parents.length}명`}</span></div>
      {parents===null ? <p className="family-empty">불러오는 중…</p>
        : parents.length ? <div className="family-members">{parents.map(p=>(
            <div className="family-member" key={p.userId}><span className="family-avatar">{(p.name||'?').slice(0,1)}</span>
              <span className="family-text"><b>{p.name}{p.me && ' (나)'}</b><small>{GUARDIAN_RELATION[p.name] || '보호자'}</small></span></div>))}</div>
        : <p className="family-empty">아직 연결된 가족이 없어요.</p>}
    </div>

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
  </div></div>;
}

function ChildSheet({ active, children: apiChildren, backendOnline, onSelect, onClose, onToast, onCreated }) {
  const fallback = [{ name:'박도윤', fullName:'박도윤', age:'생후 18개월', emoji:'👶🏻' },{ name:'박다연', fullName:'박다연', age:'만 3세', emoji:'👧🏻' }];
  const children = apiChildren?.length ? apiChildren : fallback;
  const [adding,setAdding]=useState(false); const [joining,setJoining]=useState(false); const [name,setName]=useState(''); const [birthDate,setBirthDate]=useState(''); const [inviteCode,setInviteCode]=useState('');
  const create = async()=>{ if(!name||!birthDate){onToast('아이 이름과 생년월일을 입력해주세요');return;} if(!backendOnline){onToast('체험 모드에서는 추가 화면만 확인할 수 있어요');return;} try{await api.createChild({name,birthDate});onToast('아이 프로필을 추가했어요');await onCreated?.();setAdding(false);}catch(e){onToast(e.message||'아이 프로필을 추가하지 못했어요')}};
  const join = async()=>{ if(!inviteCode.trim()){onToast('공유 코드를 입력해주세요');return;} try{await api.joinChild(inviteCode.trim());onToast('아이 건강 기록에 연결했어요');await onCreated?.();setJoining(false);setInviteCode('');}catch(e){onToast(e.message||'공유 코드가 올바르지 않아요')}};
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="sheet" onMouseDown={e=>e.stopPropagation()}><div className="sheet-handle"/><button className="sheet-close" onClick={onClose}><X/></button><div className="sheet-heading"><UsersRound/><div><h3>아이 선택</h3><p>부모·조부모·보호자와 함께 건강 기록을 관리해요.</p></div></div><div className="child-list">{children.map(child=><button className={active.fullName===child.fullName?'selected':''} onClick={()=>onSelect(child)} key={child.id||child.fullName}><span className="child-face">{child.emoji}</span><span><b>{child.fullName}</b><small>{child.age}</small></span>{active.fullName===child.fullName?<CheckCircle2/>:<ChevronRight/>}</button>)}</div>{adding&&<div className="new-child-form"><input placeholder="아이 이름" value={name} onChange={e=>setName(e.target.value)}/><input type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)}/><button className="primary-button compact" onClick={create}>프로필 저장</button></div>}{joining&&<div className="new-child-form"><input placeholder="공유 코드 8자리" value={inviteCode} onChange={e=>setInviteCode(e.target.value.toUpperCase())}/><button className="primary-button compact" onClick={join}>공유 코드로 연결</button></div>}<button className="outline-button" onClick={()=>{setAdding(!adding);setJoining(false)}}><UserRoundPlus/> {adding?'추가 취소':'새 아이 프로필 추가'}</button><button className="outline-button" onClick={()=>{setJoining(!joining);setAdding(false)}}><Link2/> {joining?'코드 입력 취소':'가족 공유 코드 입력'}</button></div></div>;
}

createRoot(document.getElementById('root')).render(<App />);
