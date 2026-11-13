import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Pill, CalendarDays, Check, Clock3, Sparkles, RefreshCw, Bell, Pencil, X, MoreHorizontal } from 'lucide-react';
import { api, errorMessage } from './api';
import { useBackLayer } from './backNavigation';
import { calendarVisits, visitLabel } from './calendarVisits';
import ChildRequiredState from './ChildRequiredState';
import CarePageHeader from './CarePageHeader';

const medicationDescription = '복용 시간과 복약 알림을 관리해요.';
const weekdays = ['월', '화', '수', '목', '금', '토', '일'];
const everyDay = 127;
const repeatOptions = [
  { value: 'ONCE', label: '한 번만 복용', description: '입력한 날짜와 시간에 한 번 등록해요.' },
  { value: 'DAILY', label: '매일 복용', description: '매일 같은 시간에 반복해요.' },
  { value: 'WEEKLY', label: '매주 요일 선택', description: '복용하는 요일을 한 개 이상 골라요.' },
];

function RepeatFields({ rule, onChange, startDate, existing = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef(null);
  const trigger = useRef(null);
  const optionsId = useId();
  const repeat = rule.repeatMode || 'ONCE';
  const selected = repeatOptions.find(option => option.value === repeat);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOutside = event => {
      if (!menu.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
    };
  }, [menuOpen]);

  return <>
    <div className="medication-repeat" ref={menu} onKeyDown={event => {
      if (event.key !== 'Escape' || !menuOpen) return;
      event.preventDefault();
      event.stopPropagation();
      setMenuOpen(false);
      trigger.current?.focus();
    }}>
      <span id={`${optionsId}-label`}>반복 방식</span>
      <button type="button" ref={trigger} className="medication-repeat-trigger" aria-expanded={menuOpen}
        aria-controls={optionsId} aria-labelledby={`${optionsId}-label ${optionsId}-value`} onClick={() => setMenuOpen(open => !open)}>
        <span id={`${optionsId}-value`}>{selected.label}</span><ChevronDown size={18} aria-hidden="true"/>
      </button>
      <div id={optionsId} className="medication-repeat-options" role="group" aria-label="반복 방식 선택" hidden={!menuOpen}>
        {repeatOptions.filter(option => !existing || option.value !== 'ONCE').map(option =>
          <button key={option.value} type="button" aria-pressed={repeat === option.value} onClick={() => {
            onChange({ ...rule, repeatMode: option.value });
            setMenuOpen(false);
            trigger.current?.focus();
          }}>
            <span><strong>{option.label}</strong><small>{option.description}</small></span>
            {repeat === option.value && <Check size={18} aria-hidden="true"/>}
          </button>
        )}
      </div>
    </div>
    {repeat === 'WEEKLY' && <fieldset className="medication-weekdays">
      <legend>복용 요일 <span>한 개 이상 선택</span></legend>
      {weekdays.map((day, index) => <label key={day}>
        <input type="checkbox" aria-label={`${day}요일`} checked={Boolean(rule.weekdayMask & (1 << index))}
          onChange={() => onChange({ ...rule, weekdayMask: (rule.weekdayMask || 0) ^ (1 << index) })}/>
        <span>{day}</span>
      </label>)}
    </fieldset>}
    {repeat !== 'ONCE' && <label>반복 종료일 (선택)<input type="date" min={startDate || undefined} max="9998-12-31"
      value={rule.endDate || ''} onChange={event => onChange({ ...rule, endDate: event.target.value })}/>
      <small className="medication-repeat-hint">비워 두면 중단할 때까지 반복해요.</small>
    </label>}
  </>;
}

function ruleWeekdays(rule) {
  return rule.repeatMode === 'WEEKLY' ? rule.weekdayMask || 0 : everyDay;
}

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
  return <section className="today-card"><div className="section-heading"><h3>오늘의 건강 일정</h3><button onClick={()=>onOpen('calendar')}>전체보기</button></div>
    {failed ? <p>일정을 불러오지 못했어요. 캘린더에서 다시 확인해주세요.</p> : rows===null ? <p>일정을 불러오는 중이에요.</p> : rows.length===0 && visits.length===0 && !visitsFailed ? <p>오늘 등록된 일정이 없어요.</p> : rows.map(row=><div className="timeline-item" key={row.id}><span className="time">{new Date(row.startsAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</span><span className={`timeline-dot ${row.status === 'COMPLETED' ? 'done' : 'pink'}`}/><div><b>{row.title}</b><small className="today-schedule-status">{row.status === 'COMPLETED' ? '완료' : '예정'}</small></div></div>)}
    {visitsFailed && <p role="status">병원 방문 기록을 불러오지 못했어요. 캘린더에서 다시 확인해주세요.</p>}
    {visits.map(visit=><button className="today-visit-row" key={visit.visitId} onClick={()=>onOpen('calendar')}><CalendarDays size={18}/><span><b>{visit.hospitalName || '병원 방문'}{visit.department ? ` · ${visit.department}` : ''}</b><small>{visitLabel(visit)} · 시간 정보 없음</small></span><ChevronRight size={16}/></button>)}
  </section>;
}

export default function CalendarScreen({ child, onToast, onChildOpen, medicationOnly = false, initialDate, initialDraft, renderVisit }) {
  const [visits, setVisits] = useState([]);
  const [visitError, setVisitError] = useState('');
  const [visitLoading, setVisitLoading] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const focusDate = initialDate && new Date(initialDate.length === 10 ? `${initialDate}T12:00` : initialDate);
  const [month, setMonth] = useState(() => {
    const date = focusDate || new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [selected, setSelected] = useState(() => localDate(focusDate || new Date()));
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
  const [editingSeries, setEditingSeries] = useState(null);
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
    const draftForSelectedChild = child?.id && initialDraft?.patientId === child.id;
    setForm(draftForSelectedChild ? {requestId:initialDraft.id,title:'',scheduleType:'MEDICATION',startsAt:'',notes:initialDraft.notes,repeatMode:'ONCE',endDate:'',fromMemo:true,truncated:initialDraft.truncated} : null);
    setCandidates([]); setDates({}); setSource(null); setStoppingSeries(null); setEditingSeries(null);
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
  if (!child?.id) return <ChildRequiredState
    icon={medicationOnly ? Pill : CalendarDays}
    title={medicationOnly ? '복용약' : '가족 건강 일정'}
    description={medicationOnly ? medicationDescription : '복약·진료·접종 일정을 한곳에서 확인해요.'}
    message={medicationOnly ? '복용약을 등록하려면 아이 프로필이 필요해요.' : '일정을 등록하려면 아이 프로필이 필요해요.'}
    onChildOpen={onChildOpen}
  />;
  if (selectedVisit && renderVisit) return renderVisit(selectedVisit, ()=>{setSelectedVisit(null);setRevision(n=>n+1);}, updated=>setSelectedVisit(updated));
  const selectedRows = rows.filter(row => row.status !== 'CANCELLED' && localDate(new Date(row.startsAt)) === selected);
  const activeSeries = series.filter(rule => rule.active && (!rule.endDate || rule.endDate >= localDate(new Date())));
  const completedCount = selectedRows.filter(row => row.status === 'COMPLETED').length;
  const selectedLabel = new Date(`${selected}T12:00`).toLocaleDateString('ko-KR', {month:'long',day:'numeric',weekday:'short'});
  const addButton = <button type="button" className="care-add" disabled={busy || loading || !!form} onClick={() => setForm({
    requestId: crypto.randomUUID(),
    title: '',
    scheduleType: medicationOnly ? 'MEDICATION' : 'PERSONAL',
    startsAt: `${selected}T09:00`,
    notes: '',
    repeatMode: 'ONCE',
    endDate: ''
  })}><Plus size={18} aria-hidden="true"/>{medicationOnly ? '복약 등록' : '일정 추가'}</button>;
  return <div className={`page padded care-calendar-page care-workspace${medicationOnly ? ' medication-workspace' : ''}`}>
    <CarePageHeader
      icon={medicationOnly ? Pill : CalendarDays}
      title={medicationOnly ? '복용약' : '가족 건강 일정'}
      description={medicationOnly ? medicationDescription : child.fullName || child.name}
    >
      {!medicationOnly && addButton}
    </CarePageHeader>
    <div className={medicationOnly ? 'medication-toolbar' : undefined}>
      <div className="care-date-toolbar"><button aria-pressed={selected===localDate(new Date())} onClick={()=>{const now=new Date();setSelected(localDate(now));setMonth(new Date(now.getFullYear(),now.getMonth(),1));if(medicationOnly)setCalendarOpen(false);}}>오늘</button><button aria-expanded={calendarOpen} onClick={()=>setCalendarOpen(v=>!v)}><CalendarDays size={16}/> {calendarOpen?'달력 닫기':'날짜 선택'}</button></div>
      {medicationOnly && addButton}
    </div>
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
    <section className="care-day-section"><div className="care-day-heading"><div><h3>{selectedLabel}</h3>{medicationOnly && <p className="medication-child">{child.fullName || child.name}</p>}</div><span className="care-count">{medicationOnly ? '복약' : '일정'} {completedCount} / {selectedRows.length} 완료</span></div>
    {visitLoading && <p role="status">병원 방문 기록을 불러오는 중이에요.</p>}
    {visitError && <p role="alert">방문 기록: {visitError} <button onClick={()=>setRevision(n=>n+1)}>다시 불러오기</button></p>}
    {!loading && !visitLoading && !visitError && !error && !marked.has(selected) && <div className="care-empty">{medicationOnly ? <Pill/> : <CalendarDays/>}<b>{medicationOnly ? '이 날짜에 등록된 복용약이 없어요' : '아직 등록된 일정이 없어요'}</b><p>{medicationOnly ? '복약 등록을 눌러 복용 시간과 용량을 남겨보세요.' : '위의 일정 추가로 등록하세요.'}</p></div>}
    {visits.filter(v=>v.visitedOn===selected).map(visit=><button className="calendar-visit-row" key={visit.visitId} onClick={()=>setSelectedVisit(visit)}><span className="care-schedule-icon"><CalendarDays/></span><span><small>{visitLabel(visit)} · 시간 정보 없음</small><b>{visit.hospitalName || '병원 방문'}</b><span>{visit.department || '진료 기록'} · 방문 기록 및 연결 문서 보기</span></span><ChevronRight size={18}/></button>)}
    <div className="schedule-list">{selectedRows.map(row => <div className={`schedule care-schedule ${row.status === 'COMPLETED' ? 'is-complete' : ''}`} key={row.id}><span className="care-schedule-icon">{row.status === 'COMPLETED' ? <Check/> : row.scheduleType === 'MEDICATION' ? <Pill/> : <CalendarDays/>}</span><div className="care-schedule-body">
      <div className="care-schedule-meta"><small><Clock3/>{new Date(row.startsAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</small><span className="care-status">{row.status === 'COMPLETED' ? '완료' : new Date(row.startsAt) < new Date() ? '시간 지남' : '예정'}</span></div><b>{row.title}</b>
      {row.notes && <p className="care-notes">{row.notes}</p>}
      {row.status === 'COMPLETED' ? <p className="care-complete-note"><Check/>{row.scheduleType === 'MEDICATION' ? '복용을 완료했어요' : '일정을 완료했어요'}</p> : !row.remindedAt && <p className="care-reminder-note"><Bell/>{new Date(row.startsAt) < new Date() ? '예정 시간이 지났어요. 완료 여부를 확인해주세요.' : '예정 시각에 앱 내 알림'}</p>}
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
        const weekdayMask = ruleWeekdays(form);
        if (!weekdayMask) { onToast('복용 요일을 한 개 이상 선택해 주세요.'); return; }
        execute(()=>api.createMedicationSeries({...body, weekdayMask, endDate: form.endDate || null}).then(()=>({startsAt:body.startsAt})), '반복 복약 일정을 저장했어요', {closeForm:true});
      } else execute(() => form.id ? api.updateSchedule(form.id, body) : api.createScheduleBatch({...body,repeatDays:1}).then(result => result[0]), '일정을 저장했어요', { closeForm: true });
    }}>
      <div className="care-editor-heading"><div><h3>{form.id ? '일정 수정' : medicationOnly ? '복약 일정 추가' : '새 일정 추가'}</h3></div><button type="button" aria-label="일정 입력 닫기" disabled={busy} onClick={()=>setForm(null)}><X/></button></div>
      {form.fromMemo && <p className="medication-preview">메모 내용을 복용 방법 메모로 가져왔어요{form.truncated?' (앞 500자)':''}. 약 이름과 시간은 직접 확인해 입력해주세요. 저장 전에는 일정이 생성되지 않아요.</p>}
      <label>일정 제목<input required placeholder={medicationOnly ? '예: 아침 식사 후 복약' : '예: 소아과 정기 검진'} maxLength={200} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
      {!medicationOnly && <label>종류<select value={form.scheduleType} onChange={e=>setForm({...form,scheduleType:e.target.value,repeatMode:'ONCE',endDate:''})}><option value="PERSONAL">개인 일정</option><option value="REVISIT">재진료</option><option value="TEST">검사</option><option value="MEDICATION">복약</option><option value="OTHER">기타</option></select></label>}
      <label>{form.scheduleType === 'MEDICATION' ? (form.id ? '복용 날짜와 시간' : '복용 시작일과 시간') : '날짜와 시간'}<input required type="datetime-local" value={form.startsAt} onChange={e=>setForm({...form,startsAt:e.target.value})}/></label>
      <label>{form.scheduleType === 'MEDICATION' ? '용량·복용 방법 메모' : '메모'}<textarea maxLength={500} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="처방이나 안내받은 내용을 적어주세요"/></label>
      {!form.id && form.scheduleType === 'MEDICATION' && <RepeatFields rule={form} onChange={setForm} startDate={form.startsAt.slice(0, 10)}/>}
      {form.id && <p>선택한 날짜의 일정만 수정해요.</p>}
      <div className="care-editor-actions"><button type="button" disabled={busy} onClick={()=>setForm(null)}>취소</button><button className="primary-button" disabled={busy}>{busy ? '저장 중…' : '일정 저장하기'}</button></div>
    </form>}
    {medicationOnly && <details className="medication-rules">
      <summary>반복 복약 관리<span>{activeSeries.length}개</span></summary>
      {seriesError && <p role="alert">반복 정보를 불러오지 못했어요. {seriesError}</p>}
      {!seriesError && !activeSeries.length && <p>진행 중인 반복 복약이 없어요.</p>}
      {activeSeries.map(rule => {
        const mask = rule.weekdayMask ?? everyDay;
        const repeatLabel = mask === everyDay ? '매일' : '매주 ' + weekdays.filter((_, index) => mask & (1 << index)).join('·') + '요일';
        return <article key={rule.id}>
          <b>{rule.title}</b><p>{repeatLabel} {rule.timeOfDay.slice(0, 5)}</p>
          <small>{rule.startDate} ~ {rule.endDate || '종료 없음'}</small>
          {editingSeries?.id === rule.id ? <form className="medication-rule-form" onSubmit={event => {
            event.preventDefault();
            const weekdayMask = ruleWeekdays(editingSeries);
            if (!weekdayMask) { onToast('복용 요일을 한 개 이상 선택해 주세요.'); return; }
            execute(async () => {
              await api.updateMedicationSeries(rule.id, {
                version: editingSeries.version, weekdayMask,
                timeOfDay: editingSeries.timeOfDay, endDate: editingSeries.endDate || null
              });
              setEditingSeries(null);
            }, '반복 복약 일정을 수정했어요');
          }}>
            <p>앞으로의 복약 일정에 적용돼요.</p>
            <label>복용 시간<input required type="time" value={editingSeries.timeOfDay}
              onChange={event => setEditingSeries({ ...editingSeries, timeOfDay: event.target.value })}/></label>
            <RepeatFields rule={editingSeries} onChange={setEditingSeries} startDate={rule.startDate} existing/>
            <div className="medication-rule-actions">
              <button type="button" disabled={busy} onClick={() => setEditingSeries(null)}>취소</button>
              <button type="submit" disabled={busy}>변경사항 저장</button>
            </div>
          </form> : <>
            <button disabled={busy} onClick={() => {
              setStoppingSeries(null);
              setEditingSeries({ ...rule, weekdayMask: mask === everyDay ? 0 : mask, repeatMode: mask === everyDay ? 'DAILY' : 'WEEKLY' });
            }}>반복 방식 수정</button>
            <button disabled={busy} onClick={() => setStoppingSeries(rule.id)}>앞으로의 반복 중단</button>
          </>}
          {stoppingSeries === rule.id && <div className="medication-stop-confirm" role="group" aria-label="반복 중단 확인">
            <p>앞으로의 미완료 일정만 취소해요. 이미 완료한 기록과 지난 일정은 남아요.</p>
            <button disabled={busy} onClick={() => setStoppingSeries(null)}>계속 반복하기</button>
            <button disabled={busy} onClick={() => execute(async () => {
              await api.stopMedicationSeries(rule.id);
              setStoppingSeries(null);
            }, '반복을 중단했어요')}>반복 중단 확인</button>
          </div>}
        </article>;
      })}
    </details>}
    <details className="care-ai-section"><summary>{medicationOnly ? '문서에서 찾은 복약 정보' : '문서에서 찾은 일정 후보'}<span>{candidates.length}개</span></summary><div className="care-ai-heading"><span className="care-ai-icon"><Sparkles/></span><div><h3>문서 분석 결과</h3><p>확인하고 승인하면 일정에 담겨요</p></div><button aria-label="문서 후보 새로고침" disabled={busy || candidatesLoading} onClick={()=>setRevision(n=>n+1)}><RefreshCw/></button></div>
    {candidatesLoading && <p role="status">문서에서 찾은 후보를 불러오는 중이에요.</p>}
    {candidatesError && <p role="alert">문서에서 찾은 후보를 불러오지 못했어요. {candidatesError}</p>}
    {!candidatesLoading && !candidatesError && candidates.length===0 && <div className="care-ai-empty"><b>{medicationOnly ? '확인할 복약 정보가 없어요' : '확인할 일정 후보가 없어요'}</b><p>{medicationOnly ? '문서에서 복약 정보를 찾으면 여기에 표시돼요.' : '문서에서 진료나 검사 일정을 찾으면 여기에 표시돼요.'}</p></div>}
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
