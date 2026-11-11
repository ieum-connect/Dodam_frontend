import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Pill, CalendarDays, Check, Clock3, Sparkles, RefreshCw, Bell, Pencil, X, MoreHorizontal } from 'lucide-react';
import { api, errorMessage } from './api';
import { useBackLayer } from './backNavigation';
import { calendarVisits, visitLabel } from './calendarVisits';

const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const localInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return `${localDate(date)}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
};

export function TodaySchedules({ child, onOpen }) {
  const [rows,setRows] = useState(null);
  const [failed,setFailed] = useState(false);
  const [visits,setVisits] = useState([]);
  const [visitsFailed,setVisitsFailed] = useState(false);
  useEffect(()=>{
    let canceled=false;
    setRows(null); setFailed(false); setVisits([]); setVisitsFailed(false);
    if (!child?.id) { setRows([]); return; }
    const start=new Date(); start.setHours(0,0,0,0);
    const end=new Date(start); end.setDate(end.getDate()+1);
    api.schedules(child.id,start.toISOString(),end.toISOString())
      .then(result=>{if(!canceled)setRows(result.filter(row=>row.status!=='CANCELLED'));})
      .catch(()=>{if(!canceled)setFailed(true);});
    calendarVisits(child.id)
      .then(records=>{if(!canceled)setVisits(records.filter(v=>v.visitedOn===localDate(start)));})
      .catch(()=>{if(!canceled)setVisitsFailed(true);});
    return ()=>{canceled=true;};
  },[child?.id]);
  return <section className="today-card"><div className="section-heading"><div><span className="eyebrow">TODAY</span><h3>오늘의 건강 일정</h3></div><button onClick={()=>onOpen('calendar')}>전체보기</button></div>
    {failed ? <p>일정을 불러오지 못했어요. 캘린더에서 다시 확인해주세요.</p> : rows===null ? <p>일정을 불러오는 중이에요.</p> : rows.length===0 && visits.length===0 && !visitsFailed ? <p>오늘 등록된 일정이 없어요.</p> : rows.map(row=><div className="timeline-item" key={row.id}><span className="time">{new Date(row.startsAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</span><span className={`timeline-dot ${row.status === 'COMPLETED' ? 'done' : 'pink'}`}/><div><b>{row.title}</b><small className="today-schedule-status">{row.status === 'COMPLETED' ? '완료' : '예정'}</small></div></div>)}
    {visitsFailed && <p role="status">병원 방문 기록을 불러오지 못했어요. 캘린더에서 다시 확인해주세요.</p>}
    {visits.map(visit=><button className="today-visit-row" key={visit.visitId} onClick={()=>onOpen('calendar')}><CalendarDays size={18}/><span><b>{visit.hospitalName || '병원 방문'}{visit.department ? ` · ${visit.department}` : ''}</b><small>{visitLabel(visit)} · 시간 정보 없음</small></span><ChevronRight size={16}/></button>)}
  </section>;
}

export default function CalendarScreen({ child, onToast, medicationOnly = false, initialDate, initialDraft, renderVisit }) {
  const [visits, setVisits] = useState([]);
  const [visitError, setVisitError] = useState('');
  const [visitLoading, setVisitLoading] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [month, setMonth] = useState(() => {
    const date = initialDate ? new Date(initialDate) : new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [selected, setSelected] = useState(() => localDate(initialDate ? new Date(initialDate) : new Date()));
  const [rows, setRows] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [dates, setDates] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null);
  const [series, setSeries] = useState([]);
  const [calendarOpen,setCalendarOpen]=useState(!medicationOnly);
  const [seriesError, setSeriesError] = useState('');
  const [stoppingSeries, setStoppingSeries] = useState(null);
  const editorRef = useRef(null);
  const editorOpen = !!form;
  useEffect(() => {
    if (editorOpen) editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editorOpen]);
  const [revision, setRevision] = useState(0);
  useEffect(()=>{
    let active=true;
    setVisits([]); setVisitError(''); setSelectedVisit(null); setVisitLoading(false);
    if (!child?.id || medicationOnly) return;
    setVisitLoading(true);
    calendarVisits(child.id).then(result=>{if(active)setVisits(result);})
      .catch(e=>{if(active)setVisitError(errorMessage(e));})
      .finally(()=>{if(active)setVisitLoading(false);});
    return ()=>{active=false;};
  },[child?.id,medicationOnly,revision]);
  useBackLayer(!!selectedVisit, ()=>{setSelectedVisit(null);setRevision(n=>n+1);});
  const [source, setSource] = useState(null);
  useEffect(() => {
    setForm(initialDraft?.patientId===child?.id ? {requestId:initialDraft.id,title:'',scheduleType:'MEDICATION',startsAt:'',notes:initialDraft.notes,repeatMode:'ONCE',endDate:'',fromMemo:true,truncated:initialDraft.truncated} : null);
    setCandidates([]); setDates({}); setSource(null); setStoppingSeries(null);
  }, [child?.id, medicationOnly, initialDraft?.id]);
  useEffect(()=>{let active=true;setSeries([]);setSeriesError('');if(!child?.id)return;
    api.medicationSeries(child.id).then(result=>{if(active)setSeries(result);}).catch(e=>{if(active)setSeriesError(errorMessage(e));});
    return()=>{active=false;};
  },[child?.id,revision]);
  useEffect(() => {
    let canceled = false;
    setRows([]);
    setError('');
    if (!child?.id) { setLoading(false); return; }
    setLoading(true);
    const until = new Date(month.getFullYear(),month.getMonth()+1,1);
    api.schedules(child.id, month.toISOString(), until.toISOString())
      .then(result => { if (!canceled) setRows(result.filter(row => !medicationOnly || row.scheduleType === 'MEDICATION')); })
      .catch(e=> { if (!canceled) setError(errorMessage(e)); })
      .finally(()=> { if (!canceled) setLoading(false); });
    return () => { canceled=true; };
  },[child?.id,month,revision,medicationOnly]);
  useEffect(() => {
    if (!child?.id) { setCandidatesLoading(false); return; }
    let canceled = false;
    setCandidatesLoading(true);
    setCandidatesError('');
    api.actionItems(child.id)
      .then(result => {
        if (canceled) return;
        const pending = result.filter(item => item.approvalStatus === 'PENDING' && (!medicationOnly || item.type === 'MEDICATION'));
        const pendingIds = new Set(pending.map(item => item.id));
        setCandidates(pending);
        setDates(current => Object.fromEntries(
          Object.entries(current).filter(([id]) => pendingIds.has(id))
        ));
        setSource(current => current && pendingIds.has(current.id) ? current : null);
      })
      .catch(e => { if (!canceled) setCandidatesError(errorMessage(e)); })
      .finally(() => { if (!canceled) setCandidatesLoading(false); });
    return () => { canceled = true; };
  }, [child?.id, revision, medicationOnly]);
  const marked = useMemo(()=>new Set([...rows.filter(row => row.status !== 'CANCELLED').map(row=>localDate(new Date(row.startsAt))),...visits.map(v=>v.visitedOn)]),[rows,visits]);
  const cells = [...Array(month.getDay()).fill(null),...Array.from({length:new Date(month.getFullYear(),month.getMonth()+1,0).getDate()},(_,i)=>i+1)];
  const move = (delta) => { const next=new Date(month.getFullYear(),month.getMonth()+delta,1); setMonth(next); setSelected(localDate(next)); };
  const execute = async (work, message, { refreshOnFailure = false, closeForm = false } = {}) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await work();
      if (result?.startsAt) {
        const date = new Date(result.startsAt);
        setMonth(new Date(date.getFullYear(),date.getMonth(),1));
        setSelected(localDate(date));
      }
      if (closeForm) setForm(null);
      setRevision(n => n + 1);
      onToast(message);
    }
    catch(e) {
      if (refreshOnFailure) setRevision(n => n + 1);
      onToast(e.status === 409 ? '일정 정보가 갱신됐어요. 최신 내용을 확인한 뒤 다시 시도해주세요.' : errorMessage(e));
      if (e.status === 409) { setForm(null); setRevision(n => n + 1); }
    }
    finally { setBusy(false); }
  };
  if (!child?.id) return <div className="page padded"><h2>가족 건강 일정</h2><p>아이를 등록하거나 선택하면 일정을 관리할 수 있어요.</p></div>;
  if (selectedVisit && renderVisit) return renderVisit(selectedVisit, ()=>{setSelectedVisit(null);setRevision(n=>n+1);}, updated=>setSelectedVisit(updated));
  const selectedRows = rows.filter(row => row.status !== 'CANCELLED' && localDate(new Date(row.startsAt)) === selected);
  const repeatDays = form?.endDate && form?.startsAt ? Math.round((Date.parse(`${form.endDate}T00:00:00Z`) - Date.parse(`${form.startsAt.slice(0,10)}T00:00:00Z`)) / 86400000) + 1 : null;
  const completedCount = selectedRows.filter(row => row.status === 'COMPLETED').length;
  const selectedLabel = new Date(`${selected}T12:00`).toLocaleDateString('ko-KR', {month:'long',day:'numeric',weekday:'short'});
  return <div className="page padded care-calendar-page care-workspace">
    <header className="care-page-header"><div><h2>{medicationOnly?'복약':'일정'}</h2><p>{child.fullName || child.name}</p></div><button className="care-add" disabled={busy || loading || !!form} onClick={()=>setForm({requestId:crypto.randomUUID(),title:'',scheduleType:medicationOnly?'MEDICATION':'PERSONAL',startsAt:`${selected}T09:00`,notes:'',repeatMode:'ONCE',endDate:''})}><Plus size={18}/>{medicationOnly?'복약 등록':'일정 추가'}</button></header>
    <div className="care-date-toolbar"><button aria-pressed={selected===localDate(new Date())} onClick={()=>{const now=new Date();setSelected(localDate(now));setMonth(new Date(now.getFullYear(),now.getMonth(),1));if(medicationOnly)setCalendarOpen(false);}}>오늘</button><button aria-expanded={calendarOpen} onClick={()=>setCalendarOpen(v=>!v)}><CalendarDays size={16}/> {calendarOpen?'달력 닫기':'날짜 선택'}</button></div>
    {calendarOpen && <div className="calendar-card"><div className="calendar-head"><button onClick={()=>move(-1)} aria-label="이전 달"><ChevronLeft/></button><b>{month.getFullYear()}년 {month.getMonth()+1}월</b><button onClick={()=>move(1)} aria-label="다음 달"><ChevronRight/></button></div>
      <div className="week-row">{['일','월','화','수','목','금','토'].map(d=><span key={d}>{d}</span>)}</div>
      <div className="date-grid">{cells.map((day,i)=>{
        if (!day) return <span key={`blank${i}`}/>;
        const key=localDate(new Date(month.getFullYear(),month.getMonth(),day));
        return <button key={key} aria-label={key} aria-pressed={selected===key} className={`${selected===key?'selected':''} ${marked.has(key)?'has-event':''}`} onClick={()=>setSelected(key)}>{day}</button>;
      })}</div>
    </div>}
    {loading && <p role="status">일정을 불러오는 중이에요.</p>}
    {error && <div role="alert"><p>{error}</p><button onClick={()=>setRevision(n=>n+1)}>다시 불러오기</button></div>}
    <section className="care-day-section"><div className="care-day-heading"><div><h3>{selectedLabel}</h3></div><span className="care-count">일정 {completedCount} / {selectedRows.length} 완료</span></div>
    {visitLoading && <p role="status">병원 방문 기록을 불러오는 중이에요.</p>}
    {visitError && <p role="alert">방문 기록: {visitError} <button onClick={()=>setRevision(n=>n+1)}>다시 불러오기</button></p>}
    {!loading && !visitLoading && !visitError && !error && !marked.has(selected) && <div className="care-empty"><CalendarDays/><b>아직 등록된 일정이 없어요</b><p>{medicationOnly?'위의 복약 등록으로 추가하세요.':'위의 일정 추가로 등록하세요.'}</p></div>}
    {visits.filter(v=>v.visitedOn===selected).map(visit=><button className="calendar-visit-row" key={visit.visitId} onClick={()=>setSelectedVisit(visit)}><span className="care-schedule-icon"><CalendarDays/></span><span><small>{visitLabel(visit)} · 시간 정보 없음</small><b>{visit.hospitalName || '병원 방문'}</b><span>{visit.department || '진료 기록'} · 방문 기록 및 연결 문서 보기</span></span><ChevronRight size={18}/></button>)}
    <div className="schedule-list">{selectedRows.map(row => <div className={`schedule care-schedule ${row.status === 'COMPLETED' ? 'is-complete' : ''}`} key={row.id}><span className="care-schedule-icon">{row.status === 'COMPLETED' ? <Check/> : row.scheduleType === 'MEDICATION' ? <Pill/> : <CalendarDays/>}</span><div className="care-schedule-body">
      <div className="care-schedule-meta"><small><Clock3/>{new Date(row.startsAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</small><span className="care-status">{row.status === 'COMPLETED' ? '완료' : new Date(row.startsAt) < new Date() ? '시간 지남' : '예정'}</span></div><b>{row.title}</b>
      {row.notes && <p className="care-notes">{row.notes}</p>}
      {row.status === 'COMPLETED' ? <p className="care-complete-note"><Check/>{row.scheduleType === 'MEDICATION' ? '복용을 완료했어요' : '일정을 완료했어요'}</p> : <p className="care-reminder-note"><Bell/>{row.remindedAt ? '앱 내 알림을 보냈어요' : new Date(row.startsAt) < new Date() ? '예정 시간이 지났어요. 완료 여부를 확인해주세요.' : '예정 시각에 앱 내 알림'}</p>}
      {row.status === 'SCHEDULED' && <div className="care-schedule-actions">
        <button className="care-complete-button" disabled={busy} onClick={() => execute(() => api.completeSchedule(row.id), '완료로 기록했어요')}><Check/>{row.scheduleType === 'MEDICATION' ? '복용 완료' : '완료'}</button>
        <button disabled={busy || !!form} onClick={() => setForm({ ...row, startsAt: localInput(row.startsAt), notes: row.notes || '', repeatDays: 1 })}><Pencil size={16}/>수정</button>
        <button disabled={busy} onClick={() => { if (window.confirm('이 날짜의 일정을 삭제할까요? 반복 일정의 다른 날짜는 유지됩니다.')) execute(() => api.cancelSchedule(row.id), '일정을 삭제했어요'); }}>삭제</button>
      </div>}
    </div></div>)}</div>

    </section>
    {form && <form ref={editorRef} className="calendar-editor care-editor" onSubmit={e => {
      e.preventDefault();
      const body = { ...form, patientId: child.id, startsAt: new Date(form.startsAt).toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
      if (!form.id && form.scheduleType==='MEDICATION' && form.repeatMode!=='ONCE') {
        execute(()=>api.createMedicationSeries({...body,endDate:form.repeatMode==='UNTIL'?form.endDate:null}).then(()=>({startsAt:body.startsAt})), '반복 복약 일정을 저장했어요', {closeForm:true});
      } else execute(() => form.id ? api.updateSchedule(form.id, body) : api.createScheduleBatch({...body,repeatDays:1}).then(result => result[0]), '일정을 저장했어요', { closeForm: true });
    }}>
      <div className="care-editor-heading"><div><h3>{form.id ? '일정 수정' : medicationOnly ? '복약 일정 추가' : '새 일정 추가'}</h3></div><button type="button" aria-label="일정 입력 닫기" disabled={busy} onClick={()=>setForm(null)}><X/></button></div>
      {form.fromMemo && <p className="medication-preview">메모 내용을 복용 방법 메모로 가져왔어요{form.truncated?' (앞 500자)':''}. 약 이름과 시간은 직접 확인해 입력해주세요. 저장 전에는 일정이 생성되지 않아요.</p>}
      <label>일정 제목<input required placeholder={medicationOnly ? '예: 아침 식사 후 복약' : '예: 소아과 정기 검진'} maxLength={200} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
      <label>종류<select disabled={medicationOnly} value={form.scheduleType} onChange={e=>setForm({...form,scheduleType:e.target.value,repeatMode:'ONCE',endDate:''})}><option value="PERSONAL">개인 일정</option><option value="REVISIT">재진료</option><option value="TEST">검사</option><option value="MEDICATION">복약</option><option value="OTHER">기타</option></select></label>
      <label>날짜와 시간<input required type="datetime-local" value={form.startsAt} onChange={e=>setForm({...form,startsAt:e.target.value})}/></label>
      <label>{form.scheduleType === 'MEDICATION' ? '용량·복용 방법 메모' : '메모'}<textarea maxLength={500} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="처방이나 안내받은 내용을 적어주세요"/></label>
      {!form.id && form.scheduleType === 'MEDICATION' && <>
        <label>반복 방식<select value={form.repeatMode || 'ONCE'} onChange={e=>setForm({...form,repeatMode:e.target.value})}><option value="ONCE">한 번만</option><option value="UNTIL">매일 · 종료일 지정</option><option value="FOREVER">매일 · 종료 없이</option></select></label>
        {form.repeatMode==='UNTIL' && <label>마지막 복용 날짜<input type="date" required min={form.startsAt?.slice(0,10)} max="9998-12-31" value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})}/></label>}
        {form.repeatMode!=='ONCE' && form.startsAt && <div className="medication-preview"><b>매일 {form.startsAt.slice(11,16)} · {form.repeatMode==='FOREVER'?'종료 없음':repeatDays>0?`${repeatDays}일`: '종료일을 선택해주세요'}</b><span>{form.startsAt.slice(0,10)}부터{form.repeatMode==='UNTIL' && form.endDate?` ${form.endDate}까지`:''}</span><p>날짜별로 복용 완료를 체크해요. 아래 반복 관리에서 앞으로의 반복을 중단할 수 있어요.</p></div>}
      </>}
      {form.id && <p>선택한 날짜의 일정만 수정해요.</p>}
      <div className="care-editor-actions"><button type="button" disabled={busy} onClick={()=>setForm(null)}>취소</button><button className="primary-button" disabled={busy}>{busy ? '저장 중…' : '일정 저장하기'}</button></div>
    </form>}
    {medicationOnly && <details className="medication-rules"><summary>반복 복약 관리<span>{series.filter(s=>s.active && (!s.endDate || s.endDate>=localDate(new Date()))).length}개</span></summary>{seriesError && <p role="alert">반복 정보를 불러오지 못했어요. {seriesError}</p>}{!seriesError && !series.some(s=>s.active && (!s.endDate || s.endDate>=localDate(new Date()))) && <p>진행 중인 반복 복약이 없어요.</p>}{series.filter(s=>s.active && (!s.endDate || s.endDate>=localDate(new Date()))).map(rule=><article key={rule.id}><b>{rule.title}</b><p>매일 {rule.timeOfDay.slice(0,5)} · {rule.timeZone}</p><small>{rule.startDate} ~ {rule.endDate || '종료 없음'}</small><button disabled={busy} onClick={()=>setStoppingSeries(rule.id)}>앞으로의 반복 중단</button>{stoppingSeries===rule.id && <div role="group" aria-label="반복 중단 확인"><p>앞으로의 미완료 일정만 취소해요. 이미 완료한 기록과 지난 일정은 남아요.</p><button disabled={busy} onClick={()=>setStoppingSeries(null)}>계속 반복하기</button><button disabled={busy} onClick={()=>execute(async()=>{await api.stopMedicationSeries(rule.id);setStoppingSeries(null);},'반복을 중단했어요')}>반복 중단 확인</button></div>}</article>)}</details>}
    <details className="care-ai-section"><summary>문서에서 찾은 할 일<span>{candidates.length}개</span></summary><div className="care-ai-heading"><span className="care-ai-icon"><Sparkles/></span><div><h3>AI가 찾은 건강 할 일</h3><p>확인하고 승인하면 일정에 담겨요</p></div><button aria-label="AI 할 일 새로고침" disabled={busy || candidatesLoading} onClick={()=>setRevision(n=>n+1)}><RefreshCw/></button></div>
    {candidatesLoading && <p role="status">AI 할 일을 불러오는 중이에요.</p>}
    {candidatesError && <p role="alert">AI 할 일을 불러오지 못했어요. {candidatesError}</p>}
    {!candidatesLoading && !candidatesError && candidates.length===0 && <div className="care-ai-empty"><b>새로 확인할 할 일이 없어요</b><p>건강 문서를 분석하면 여기에서<br/>복약과 진료 일정을 확인할 수 있어요.</p></div>}
    {candidates.map(item => {
      const startsAt = dates[item.id] ?? localInput(item.dueAt);
      const decisionDisabled = busy || candidatesLoading || !!candidatesError;
      return <div className="calendar-editor" key={item.id}><b>{item.title}</b><p>{item.description}</p>
      <button disabled={busy} onClick={async()=>{try { const doc=await api.document(item.documentId); if(doc.signedUrl) setSource({id:item.id,url:doc.signedUrl}); else onToast('원본 문서를 불러올 수 없어요'); } catch(e) {onToast(errorMessage(e));}}}>근거 문서 확인</button>
      {source?.id===item.id && <a href={source.url} target="_blank" rel="noreferrer">이 후보의 원본 문서 열기</a>}
      {!item.dueAt && <p>캘린더에 남길 날짜와 시간을 정한 경우에만 입력해주세요. 일정으로 남길 필요가 없다면 거절할 수 있어요.</p>}
      <label>등록할 날짜와 시간<input type="datetime-local" required value={startsAt} onChange={e => {
        const value = e.target.value;
        setDates(current => ({ ...current, [item.id]: value }));
      }}/></label>
      <div className="candidate-buttons">
        <button disabled={decisionDisabled || !startsAt} onClick={() => execute(
          () => api.approveAction(item.id, new Date(dates[item.id] ?? item.dueAt).toISOString()),
          '승인한 할 일을 일정에 등록했어요',
          { refreshOnFailure: true }
        )}>승인하고 일정 등록</button>
        <button disabled={decisionDisabled} onClick={() => execute(
          () => api.rejectAction(item.id),
          '후보를 거절했어요',
          { refreshOnFailure: true }
        )}>거절</button>
      </div>
    </div>;
    })}</details>
  </div>;
}
