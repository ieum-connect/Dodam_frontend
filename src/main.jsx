import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bell, CalendarDays, ChevronLeft, ChevronRight, CircleUserRound, FileText,
  HeartPulse, Home, MessageCircleHeart, MoreHorizontal, NotebookPen, Pill,
  Plus, Search, ShieldCheck, Sparkles, Syringe, TrendingUp, Upload, X,
  CheckCircle2, Clock3, MapPin, Send, Baby, Scale, Ruler, Gift, BookOpen,
  Stethoscope, Camera, Menu, Mic, Square, Link2, UserRoundPlus, UsersRound
} from 'lucide-react';
import './styles.css';
import { api, ApiError } from './api';

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
  const [activeChild, setActiveChild] = useState({ name: '도윤이', fullName: '김도윤', age: '생후 18개월', emoji: '👶🏻' });
  const [children, setChildren] = useState([]);
  const [visits, setVisits] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [toast, setToast] = useState('');
  const [chat, setChat] = useState(['요즘 도윤이가 밤에 자주 깨는데 괜찮을까요?']);

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
    const displayName = child.name || child.fullName || child.displayName || (index === 0 ? '도윤이' : `아이 ${index + 1}`);
    return { id: child.id, name: displayName, fullName: displayName, age: childAge(child.birthDate), birthDate: child.birthDate, emoji: index % 2 ? '👧🏻' : '👶🏻' };
  };

  const loadFamilyData = async () => {
    try {
      const childRows = await api.children();
      const mapped = childRows.map(normalizeChild);
      setChildren(mapped);
      const selected = mapped.find((child) => child.id === activeChild.id) || mapped[0];
      if (selected) setActiveChild(selected);
      const patientId = selected?.id;
      const [visitPage, documentPage] = await Promise.all([api.visits(patientId), api.documents(patientId)]);
      setVisits(visitPage?.items || []);
      setDocuments(documentPage?.items || []);
    } catch (error) {
      if (error.status !== 401) showToast('일부 건강 기록을 불러오지 못했어요');
    }
  };

  React.useEffect(() => {
    api.me().then(() => { setLoggedIn(true); setBackendOnline(true); return loadFamilyData(); })
      .catch(() => {}).finally(() => setAuthReady(true));
  }, []);

  const login = async (mode) => {
    if (mode === 'kakao') { window.location.href = api.kakaoLoginUrl; return; }
    try {
      await api.demoLogin(); setBackendOnline(true); setLoggedIn(true); await loadFamilyData(); showToast('도담에 오신 것을 환영해요');
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
      setProfileOpen(false);
      setChildOpen(false);
      setTab('home');
      setDetail(null);
      setChildren([]);
      setVisits([]);
      setDocuments([]);
      setChat([]);
      setActiveChild({ name: '도윤이', fullName: '김도윤', age: '생후 18개월', emoji: '👶🏻' });
    }
  };

  React.useEffect(() => {
    if (!loggedIn || !backendOnline || !activeChild.id) return;
    Promise.all([api.visits(activeChild.id), api.documents(activeChild.id)]).then(([v,d]) => { setVisits(v?.items||[]); setDocuments(d?.items||[]); }).catch(()=>{});
  }, [activeChild.id]);

  const openFeature = (id) => {
    if (id === 'chat') { setTab('chat'); setDetail(null); return; }
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
            <button className="icon-button dot" onClick={() => showToast('새 알림이 2개 있어요')} aria-label="알림"><Bell/></button>
            <button className="avatar-button" onClick={() => setProfileOpen(true)}><span>도</span></button>
          </div>
        </header>

        <div className="screen-content">
          {detail ? <DetailScreen type={detail} onToast={showToast} visits={visits} documents={documents} child={activeChild} onDataChange={loadFamilyData} backendOnline={backendOnline} /> : tab === 'home' ? (
            <HomeScreen onOpen={openFeature} child={activeChild} onChildOpen={() => setChildOpen(true)} />
          ) : tab === 'calendar' ? <CalendarScreen onToast={showToast} />
            : tab === 'chat' ? <ChatScreen chat={chat} setChat={setChat} child={activeChild} documents={documents} backendOnline={backendOnline} onToast={showToast} />
            : tab === 'records' ? <DetailScreen type="records" onToast={showToast} visits={visits} documents={documents} child={activeChild} onDataChange={loadFamilyData} backendOnline={backendOnline} />
            : tab === 'documents' ? <DetailScreen type="documents" onToast={showToast} visits={visits} documents={documents} child={activeChild} onDataChange={loadFamilyData} backendOnline={backendOnline} />
            : <MoreScreen onOpen={openFeature} />}
        </div>

        {!detail && <BottomNav tab={tab} setTab={setTab} />}
        </>}
      </main>

      {profileOpen && <ProfileSheet onClose={() => setProfileOpen(false)} onToast={showToast} onLogout={logout} />}
      {childOpen && <ChildSheet active={activeChild} children={children} backendOnline={backendOnline} onSelect={(child) => { setActiveChild(child); setChildOpen(false); showToast(`${child.name} 기록으로 전환했어요`); }} onClose={() => setChildOpen(false)} onToast={showToast} onCreated={loadFamilyData} />}
      {toast && <div className="toast"><CheckCircle2 size={18}/>{toast}</div>}
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [emailOpen, setEmailOpen] = useState(false);
  return <div className="login-screen">
    <div className="login-visual"><span className="login-glow one"/><span className="login-glow two"/><div className="login-heart"><HeartPulse/></div><div className="login-badge badge-one"><Syringe/><span>예방접종</span></div><div className="login-badge badge-two"><TrendingUp/><span>성장 기록</span></div><div className="login-badge badge-three"><FileText/><span>건강 문서</span></div></div>
    <div className="login-content"><Logo/><span className="eyebrow">FAMILY HEALTH COMPANION</span><h1>아이의 건강한 성장을<br/><strong>도담</strong>과 함께 기록해요.</h1><p>병원 기록부터 예방접종, 성장 발달까지<br/>우리 가족의 건강 정보를 안전하게 관리하세요.</p>
      {emailOpen && <div className="login-fields"><label>이메일<input type="email" placeholder="name@example.com"/></label><label>비밀번호<input type="password" placeholder="비밀번호를 입력해주세요"/></label></div>}
      <div className="login-actions"><button className="kakao-button" onClick={()=>onLogin('kakao')}><span>💬</span> 카카오로 3초 만에 시작하기</button><button className="email-button" onClick={()=>emailOpen?onLogin('demo'):setEmailOpen(true)}>{emailOpen?'체험 계정으로 로그인':'이메일로 계속하기'}</button></div>
      <button className="signup-link">처음이신가요? <b>회원가입</b></button><p className="login-terms">계속하면 도담의 이용약관 및 개인정보 처리방침에 동의하게 됩니다.</p>
    </div>
  </div>;
}

function Logo({ compact = false }) {
  return <div className={`logo ${compact ? 'compact' : ''}`}><span className="logo-mark"><HeartPulse/></span><span>도담</span></div>;
}

function HomeScreen({ onOpen, child, onChildOpen }) {
  return <>
    <section className="welcome">
      <div><p className="muted">10월 24일 토요일</p><h2><strong>{child.name}</strong>와 오늘도<br/>건강한 하루 보내세요 <span>♡</span></h2></div>
      <button className="child-chip" onClick={onChildOpen}><span className="child-face">{child.emoji}</span><span>{child.fullName}<br/><small>{child.age} · 아이 전환</small></span><ChevronRight size={17}/></button>
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
      <div><span className="eyebrow">GROWTH REPORT</span><h3>도윤이가 쑥쑥 자라고 있어요!</h3><p>지난달보다 키가 <b>1.2cm</b> 자랐어요.</p><button>성장 리포트 보기 <ChevronRight size={15}/></button></div>
      <div className="growth-visual"><div className="chart-bars"><i/><i/><i/><i/><i/></div><Baby size={42}/></div>
    </section>

    <section className="tip-card"><span className="tip-icon"><Sparkles/></span><div><b>도담이 알려드려요</b><p>18개월 아이는 하루 11–14시간의 수면이 권장돼요. 일정한 취침 루틴을 만들어보세요.</p></div></section>
  </>;
}

function BottomNav({ tab, setTab }) {
  const nav = [{id:'home',label:'홈',icon:Home},{id:'records',label:'방문기록',icon:Stethoscope},{id:'documents',label:'문서',icon:Upload,primary:true},{id:'calendar',label:'일정',icon:CalendarDays},{id:'chat',label:'AI 도담',icon:MessageCircleHeart}];
  return <nav className="bottom-nav">{nav.map(({id,label,icon:Icon,primary}) => <button key={id} className={`${tab===id?'active':''} ${primary?'nav-primary':''}`} onClick={()=>setTab(id)}><span className="nav-icon"><Icon/></span><span>{label}</span>{id==='chat'&&<i/>}</button>)}</nav>;
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
  const send = async () => {
    if (!input.trim() || sending) return;
    const question = input.trim(); setChat([...chat, question]); setInput('');
    if (!backendOnline || !child?.id || !documents?.length) return;
    try {
      setSending(true);
      const sessions = await api.chatSessions(child.id);
      const session = sessions?.[0] || await api.createChatSession(child.id, `${child.name} 건강 상담`);
      const result = await api.askChat(session.sessionId, question, documents.slice(0,5).map(d=>d.documentId));
      setAiMessages(prev => [...prev, ...result.filter(m=>m.role==='ASSISTANT').map(m=>m.content)]);
    } catch { onToast('AI 답변을 가져오지 못해 기본 안내를 보여드려요'); }
    finally { setSending(false); }
  };
  return <div className="chat-page"><div className="chat-hero"><span className="ai-orb"><Sparkles/></span><div><span className="eyebrow">AI CARE ASSISTANT</span><h2>안녕하세요, 도담이에요</h2><p>아이의 건강 기록을 바탕으로<br/>궁금한 점을 쉽게 설명해드릴게요.</p></div></div>
    <div className="suggestions"><button onClick={()=>setInput('예방접종 일정을 알려줘')}>예방접종 일정</button><button onClick={()=>setInput('성장 발달이 잘 되고 있나요?')}>성장 발달 확인</button><button onClick={()=>setInput('처방전을 쉽게 설명해줘')}>문서 설명</button></div>
    <div className="messages"><div className="message ai">무엇이 궁금하신가요? 의료 기록과 성장 데이터를 참고해 함께 살펴볼게요.</div>{chat.map((m,i)=><React.Fragment key={i}><div className="message user">{m}</div><div className="message ai">{aiMessages[i] || '밤중에 깨는 건 이 시기에 흔할 수 있어요. 최근 수면 시간과 낮잠 패턴을 함께 확인해볼까요? 고열이나 호흡 곤란이 있다면 즉시 의료진과 상담해주세요.'}</div></React.Fragment>)}{sending&&<div className="message ai">도담이가 의료 기록을 살펴보고 있어요…</div>}</div>
    <div className="chat-input"><button><Plus/></button><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="도담이에게 물어보세요"/><button className="send" onClick={send}><Send/></button></div>
    <p className="disclaimer">AI 답변은 참고용이며, 진단을 대신하지 않습니다.</p>
  </div>;
}

function DetailScreen({ type, onToast, visits = [], documents = [], child, onDataChange, backendOnline }) {
  const [title, desc] = detailCopy[type];
  if(type==='growth') return <GrowthDetail onToast={onToast}/>;
  if(type==='welfare') return <WelfareDetail/>;
  if(type==='memo') return <MemoDetail onToast={onToast}/>;
  if(type==='documents') return <DocumentDetail onToast={onToast} visits={visits} documents={documents} child={child} onDataChange={onDataChange} backendOnline={backendOnline}/>;
  if(type==='records') return <VisitRecordsDetail onToast={onToast} visits={visits} child={child} onDataChange={onDataChange} backendOnline={backendOnline}/>;
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

function VisitRecordsDetail({ onToast, visits = [], child, onDataChange, backendOnline }) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
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
  return <div className="page padded detail-page"><div className="detail-hero"><span className="detail-icon"><Stethoscope/></span><div><h2>병원 방문 기록</h2><p>진료 내용과 다음 예약을 잊지 않도록 정리해드려요.</p></div></div>
    <div className="list-header"><h3>최근 기록</h3><button>전체보기</button></div>
    <div className="record-list">{visits.length ? visits.slice(0,5).map(v=><button type="button" onClick={()=>onToast(`${v.hospitalName || '병원'} 방문 기록을 선택했어요`)} key={v.visitId}><span className="record-date">{v.visitedOn}</span><span><b>{v.department || '병원 방문'}</b><small>{v.hospitalName || '병원 정보 없음'}</small></span><ChevronRight/></button>) : <div className="empty-record">아직 저장된 병원 방문 기록이 없어요.</div>}</div>
    {!adding ? <button className="primary-button" onClick={()=>setAdding(true)}><Plus/> 새 기록 추가</button> : <div className="inline-panel visit-compose"><div className="panel-title"><div><b>새 병원 방문 기록</b><p>아이의 진료 정보를 남겨보세요.</p></div><button onClick={()=>setAdding(false)}><X/></button></div><label className="field-label">방문 날짜<input className="select-field" type="date" value={form.visitedOn} onChange={e=>setForm({...form,visitedOn:e.target.value})}/></label><label className="field-label">병원명<input className="select-field" placeholder="예: 도담소아청소년과" value={form.hospitalName} onChange={e=>setForm({...form,hospitalName:e.target.value})}/></label><label className="field-label">진료 목적<input className="select-field" placeholder="예: 영유아 건강검진" value={form.department} onChange={e=>setForm({...form,department:e.target.value})}/></label><label className="field-label">메모<textarea className="visit-memo" placeholder="진료 내용을 간단히 남겨보세요" value={form.memo} onChange={e=>setForm({...form,memo:e.target.value})}/></label><button className="primary-button compact" disabled={saving} onClick={submit}><CheckCircle2/> {saving?'저장 중…':'방문 기록 저장'}</button></div>}
  </div>;
}

function DocumentDetail({ onToast, visits = [], documents = [], child, onDataChange, backendOnline }) {
  const [uploading, setUploading] = useState(false);
  const [visit, setVisit] = useState('');
  const [newVisit, setNewVisit] = useState(false);
  const [fileName, setFileName] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
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
  return <div className="page padded detail-page">
    <div className="detail-hero"><span className="detail-icon"><FileText/></span><div><h2>건강 문서</h2><p>진료·검사 문서를 방문 기록과 연결해 맥락까지 함께 보관해요.</p></div></div>
    <div className="link-info"><Link2/><div><b>문서와 방문 기록을 연결하세요</b><p>진료별 문서와 AI 설명을 한 화면에서 다시 확인할 수 있어요.</p></div></div>
    <div className="list-header"><h3>최근 문서</h3><button>전체보기</button></div>
    <div className="record-list">{(documents.length?documents:[{documentId:'sample1',createdAt:'2026-10-12',documentName:'혈액검사 결과지',visitId:'sample'},{documentId:'sample2',createdAt:'2026-09-12',documentName:'진료 확인서'}]).slice(0,5).map(doc=>{const linked=visits.find(v=>v.visitId===doc.visitId);return <button type="button" onClick={()=>onToast(`${doc.documentName} 상세를 열었어요`)} key={doc.documentId}><span className="record-date">{String(doc.visitedOn||doc.createdAt||'').slice(0,10)}</span><span><b>{doc.documentName}</b><small>{doc.visitId?<><Link2/> {linked?.hospitalName||'병원 방문'} 기록에 연결됨</>:'연결된 방문 기록 없음'}</small></span><ChevronRight/></button>})}</div>
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

function MemoDetail({ onToast }) {
  const [date, setDate] = useState('2026-10-24');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  React.useEffect(() => { if(!recording) return; const timer=setInterval(()=>setSeconds(s=>s+1),1000); return ()=>clearInterval(timer); }, [recording]);
  const finishRecording = () => { setRecording(false); onToast(`음성 메모 ${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}를 첨부했어요`); };
  return <div className="page padded detail-page"><div className="detail-hero"><span className="detail-icon"><NotebookPen/></span><div><h2>육아 메모</h2><p>날짜별로 먹고, 자고, 느낀 변화를 기록하고 음성도 남겨보세요.</p></div></div>
    <div className="memo-compose"><label className="date-picker"><CalendarDays/><span><small>기록 날짜</small><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></span></label><textarea placeholder="오늘 아이에게 어떤 일이 있었나요?" defaultValue=""/>
      <div className={`voice-recorder ${recording?'recording':''}`}><button onClick={()=>recording?finishRecording():(setSeconds(0),setRecording(true))}>{recording?<Square/>:<Mic/>}</button><div><b>{recording?'음성 메모 녹음 중':'음성으로 기록하기'}</b><p>{recording?`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')} · 누르면 녹음 완료`:'손이 바쁠 땐 말로 남겨보세요'}</p></div>{recording&&<span className="voice-wave"><i/><i/><i/><i/><i/></span>}</div>
      <button className="primary-button compact" onClick={()=>onToast(`${date.replaceAll('-','.')} 메모를 저장했어요`)}>메모 저장</button>
    </div>
    <div className="list-header"><h3>날짜별 메모</h3><button><CalendarDays/> 달력 보기</button></div><div className="record-list"><button><span className="record-date">10월 24일</span><span><b>아침 식사</b><small>바나나 반 개, 요거트 잘 먹음</small></span><ChevronRight/></button><button><span className="record-date">10월 23일</span><span><b>잠들기 전</b><small><Mic/> 음성 메모 · 00:38</small></span><ChevronRight/></button></div>
  </div>;
}

function GrowthDetail({onToast}) { return <div className="page padded detail-page"><div className="detail-hero"><span className="detail-icon"><TrendingUp/></span><div><h2>성장 발달 기록</h2><p>키와 몸무게 변화를 또래 성장 곡선과 함께 확인해요.</p></div></div>
  <div className="metric-grid"><div><span><Ruler/> 키</span><b>82.4<small>cm</small></b><em>+1.2cm</em></div><div><span><Scale/> 몸무게</span><b>11.2<small>kg</small></b><em>+0.3kg</em></div></div>
  <div className="growth-chart"><div className="chart-title"><b>최근 6개월 성장</b><span>또래 58 백분위</span></div><div className="line-chart"><svg viewBox="0 0 320 130"><path className="area" d="M10 110 C70 94, 96 102, 140 66 S230 74, 310 25 L310 125 L10 125Z"/><path className="line" d="M10 110 C70 94, 96 102, 140 66 S230 74, 310 25"/><circle cx="310" cy="25" r="5"/></svg><div className="chart-labels"><span>5월</span><span>6월</span><span>7월</span><span>8월</span><span>9월</span><span>10월</span></div></div></div>
  <div className="milestone"><span>🧸</span><div><b>18개월 발달 체크</b><p>혼자 걷기, 간단한 단어 말하기 등 8개 중 7개를 달성했어요.</p></div><ChevronRight/></div>
  <button className="primary-button" onClick={()=>onToast('오늘의 성장 기록을 추가할게요')}><Plus/> 성장 기록 추가</button></div> }

function WelfareDetail() { const services=[['아이돌봄 서비스','맞벌이 가정 · 소득 기준에 따라 지원','신청 가능'],['영유아 보육료 지원','만 0–5세 어린이집 이용 아동','대상 가능성 높음'],['부모급여','만 0–1세 아동 가정','조건 확인']]; return <div className="page padded detail-page"><div className="detail-hero"><span className="detail-icon"><Gift/></span><div><h2>복지 서비스</h2><p>가족 정보를 바탕으로 놓치기 쉬운 정부 혜택을 찾아드려요.</p></div></div><label className="search-box"><Search/><input placeholder="지원금, 돌봄 서비스 검색"/></label><div className="recommend-banner"><Sparkles/><div><b>도윤이 가족 맞춤 추천</b><p>현재 확인할 수 있는 혜택이 6개 있어요.</p></div></div><div className="service-list">{services.map(([name,desc,badge])=><button><div><span>{badge}</span><b>{name}</b><p>{desc}</p></div><ChevronRight/></button>)}</div><p className="source-note"><ShieldCheck/> 복지로 및 정부24의 공개 정보를 기반으로 안내합니다.</p></div> }

function MoreScreen({onOpen}) { return <div className="page padded"><div className="page-title"><span className="eyebrow">ALL SERVICES</span><h2>도담의 모든 기능</h2><p>아이의 건강과 가족의 일상을 한곳에서 관리하세요.</p></div><div className="all-list">{featureCards.map(({id,title,subtitle,icon:Icon,tone})=><button onClick={()=>onOpen(id)}><span className={`feature-icon ${tone}`}><Icon/></span><span><b>{title}</b><small>{subtitle}</small></span><ChevronRight/></button>)}</div></div> }

function ProfileSheet({onClose,onToast,onLogout}) { return <div className="modal-backdrop" onMouseDown={onClose}><div className="sheet" onMouseDown={e=>e.stopPropagation()}><div className="sheet-handle"/><button className="sheet-close" onClick={onClose}><X/></button><div className="profile-head"><span className="big-avatar">도</span><div><h3>김도윤</h3><p>2025년 4월 12일생 · 남아</p></div></div><div className="family-row"><span>보호자</span><b>엄마 김다정</b><button>전환</button></div><button className="outline-button" onClick={()=>onToast('새 아이 프로필 추가를 시작할게요')}><Plus/> 아이 프로필 추가</button><button className="logout-button" onClick={onLogout}>로그아웃</button></div></div> }

function ChildSheet({ active, children: apiChildren, backendOnline, onSelect, onClose, onToast, onCreated }) {
  const fallback = [{ name:'도윤이', fullName:'김도윤', age:'생후 18개월', emoji:'👶🏻' },{ name:'서윤이', fullName:'김서윤', age:'만 5세', emoji:'👧🏻' }];
  const children = apiChildren?.length ? apiChildren : fallback;
  const [adding,setAdding]=useState(false); const [joining,setJoining]=useState(false); const [name,setName]=useState(''); const [birthDate,setBirthDate]=useState(''); const [inviteCode,setInviteCode]=useState('');
  const create = async()=>{ if(!name||!birthDate){onToast('아이 이름과 생년월일을 입력해주세요');return;} if(!backendOnline){onToast('체험 모드에서는 추가 화면만 확인할 수 있어요');return;} try{await api.createChild({name,birthDate});onToast('아이 프로필을 추가했어요');await onCreated?.();setAdding(false);}catch(e){onToast(e.message||'아이 프로필을 추가하지 못했어요')}};
  const join = async()=>{ if(!inviteCode.trim()){onToast('공유 코드를 입력해주세요');return;} try{await api.joinChild(inviteCode.trim());onToast('아이 건강 기록에 연결했어요');await onCreated?.();setJoining(false);setInviteCode('');}catch(e){onToast(e.message||'공유 코드가 올바르지 않아요')}};
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="sheet" onMouseDown={e=>e.stopPropagation()}><div className="sheet-handle"/><button className="sheet-close" onClick={onClose}><X/></button><div className="sheet-heading"><UsersRound/><div><h3>아이 선택</h3><p>부모·조부모·보호자와 함께 건강 기록을 관리해요.</p></div></div><div className="child-list">{children.map(child=><button className={active.fullName===child.fullName?'selected':''} onClick={()=>onSelect(child)} key={child.id||child.fullName}><span className="child-face">{child.emoji}</span><span><b>{child.fullName}</b><small>{child.age}</small></span>{active.fullName===child.fullName?<CheckCircle2/>:<ChevronRight/>}</button>)}</div>{adding&&<div className="new-child-form"><input placeholder="아이 이름" value={name} onChange={e=>setName(e.target.value)}/><input type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)}/><button className="primary-button compact" onClick={create}>프로필 저장</button></div>}{joining&&<div className="new-child-form"><input placeholder="공유 코드 8자리" value={inviteCode} onChange={e=>setInviteCode(e.target.value.toUpperCase())}/><button className="primary-button compact" onClick={join}>공유 코드로 연결</button></div>}<button className="outline-button" onClick={()=>{setAdding(!adding);setJoining(false)}}><UserRoundPlus/> {adding?'추가 취소':'새 아이 프로필 추가'}</button><button className="outline-button" onClick={()=>{setJoining(!joining);setAdding(false)}}><Link2/> {joining?'코드 입력 취소':'가족 공유 코드 입력'}</button></div></div>;
}

createRoot(document.getElementById('root')).render(<App />);
