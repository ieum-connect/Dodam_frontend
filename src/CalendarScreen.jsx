import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { api, errorMessage } from './api';

const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const localInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return `${localDate(date)}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
};

export function TodaySchedules({ child, onOpen }) {
  const [rows,setRows] = useState(null);
  const [failed,setFailed] = useState(false);
  useEffect(()=>{
    let canceled=false;
    setRows(null); setFailed(false);
    if (!child?.id) return;
    const start=new Date(); start.setHours(0,0,0,0);
    const end=new Date(start); end.setDate(end.getDate()+1);
    api.schedules(child.id,start.toISOString(),end.toISOString())
      .then(result=>{ if(!canceled) setRows(result); })
      .catch(()=>{ if(!canceled) setFailed(true); });
    return ()=>{canceled=true;};
  },[child?.id]);
  return <section className="today-card"><div className="section-heading"><div><span className="eyebrow">TODAY</span><h3>오늘의 건강 일정</h3></div><button onClick={()=>onOpen('calendar')}>전체보기</button></div>
    {failed ? <p>일정을 불러오지 못했어요. 캘린더에서 다시 확인해주세요.</p> : rows===null ? <p>일정을 불러오는 중이에요.</p> : rows.length===0 ? <p>오늘 등록된 일정이 없어요.</p> : rows.map(row=><div className="timeline-item" key={row.id}><span className="time">{new Date(row.startsAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</span><span className="timeline-dot pink"/><div><b>{row.title}</b></div></div>)}
  </section>;
}

export default function CalendarScreen({ child, onToast }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(),new Date().getMonth(),1));
  const [selected, setSelected] = useState(() => localDate(new Date()));
  const [rows, setRows] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [dates, setDates] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null);
  const [revision, setRevision] = useState(0);
  const [source, setSource] = useState(null);
  useEffect(() => {
    let canceled = false;
    setRows([]);
    setError('');
    if (!child?.id) return;
    setLoading(true);
    const until = new Date(month.getFullYear(),month.getMonth()+1,1);
    api.schedules(child.id, month.toISOString(), until.toISOString())
      .then(result => { if (!canceled) setRows(result); })
      .catch(e=> { if (!canceled) setError(errorMessage(e)); })
      .finally(()=> { if (!canceled) setLoading(false); });
    return () => { canceled=true; };
  },[child?.id,month,revision]);
  useEffect(() => {
    if (!child?.id) return;
    let canceled = false;
    setCandidatesLoading(true);
    setCandidatesError('');
    api.actionItems(child.id)
      .then(result => {
        if (canceled) return;
        const pending = result.filter(item => item.approvalStatus === 'PENDING');
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
  }, [child?.id, revision]);
  const marked = useMemo(()=>new Set(rows.map(row=>localDate(new Date(row.startsAt)))),[rows]);
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
      onToast(errorMessage(e));
    }
    finally { setBusy(false); }
  };
  if (!child?.id) return <div className="page padded"><h2>가족 건강 일정</h2><p>아이를 등록하거나 선택하면 일정을 관리할 수 있어요.</p></div>;
  return <div className="page padded">
    <div className="page-title"><span className="eyebrow">CARE CALENDAR</span><h2>가족 건강 일정</h2><p>{child.name}의 일정과 승인할 할 일을 확인해요.</p></div>
    <div className="calendar-card"><div className="calendar-head"><button onClick={()=>move(-1)} aria-label="이전 달"><ChevronLeft/></button><b>{month.getFullYear()}년 {month.getMonth()+1}월</b><button onClick={()=>move(1)} aria-label="다음 달"><ChevronRight/></button></div>
      <div className="week-row">{['일','월','화','수','목','금','토'].map(d=><span key={d}>{d}</span>)}</div>
      <div className="date-grid">{cells.map((day,i)=>{
        if (!day) return <span key={`blank${i}`}/>;
        const key=localDate(new Date(month.getFullYear(),month.getMonth(),day));
        return <button key={key} aria-label={key} aria-pressed={selected===key} className={`${selected===key?'selected':''} ${marked.has(key)?'has-event':''}`} onClick={()=>setSelected(key)}>{day}</button>;
      })}</div>
    </div>
    {loading && <p role="status">일정을 불러오는 중이에요.</p>}
    {error && <div role="alert"><p>{error}</p><button onClick={()=>setRevision(n=>n+1)}>다시 불러오기</button></div>}
    <h3 className="subheading">{selected} 일정</h3>
    {!loading && !error && !marked.has(selected) && <p>등록된 일정이 없어요.</p>}
    <div className="schedule-list">{rows.filter(row=>localDate(new Date(row.startsAt))===selected).map(row=><div className="schedule" key={row.id}><div><small>{new Date(row.startsAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</small><b>{row.title}</b><p>{row.actionItemId?'승인한 AI 후보':'직접 등록한 일정'}</p></div></div>)}</div>
    <button className="primary-button" disabled={busy || loading || !!form} onClick={()=>setForm({title:'',scheduleType:'PERSONAL',startsAt:`${selected}T09:00`})}><Plus/> 일정 추가하기</button>
    {form && <form className="calendar-editor" onSubmit={e=>{e.preventDefault(); execute(()=>api.createSchedule({...form,patientId:child.id,startsAt:new Date(form.startsAt).toISOString()}),'일정을 등록했어요',{ closeForm: true });}}>
      <label>일정 제목<input required maxLength={200} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
      <label>종류<select value={form.scheduleType} onChange={e=>setForm({...form,scheduleType:e.target.value})}><option value="PERSONAL">개인 일정</option><option value="REVISIT">재진료</option><option value="TEST">검사</option><option value="MEDICATION">복약</option><option value="OTHER">기타</option></select></label>
      <label>날짜와 시간<input required type="datetime-local" value={form.startsAt} onChange={e=>setForm({...form,startsAt:e.target.value})}/></label>
      <button className="primary-button" disabled={busy}>저장</button><button type="button" disabled={busy} onClick={()=>setForm(null)}>취소</button>
    </form>}
    <div className="section-heading"><h3 className="subheading">승인을 기다리는 AI 할 일</h3><button disabled={busy || candidatesLoading} onClick={()=>setRevision(n=>n+1)}>새로고침</button></div>
    <p>원문과 내용을 확인한 뒤 승인해주세요. 승인한 항목만 일정에 등록돼요.</p>
    {candidatesLoading && <p role="status">AI 할 일을 불러오는 중이에요.</p>}
    {candidatesError && <p role="alert">AI 할 일을 불러오지 못했어요. {candidatesError}</p>}
    {!candidatesLoading && !candidatesError && candidates.length===0 && <p>승인할 후보가 없어요. 문서를 업로드했다면 분석이 끝난 뒤 새로고침해주세요.</p>}
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
    })}
  </div>;
}
