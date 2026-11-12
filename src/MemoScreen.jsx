import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Clock3, Pencil, X, Pill, Plus, Tag, Search, MoreHorizontal, Trash2, NotebookPen } from 'lucide-react';
import { api, errorMessage } from './api';
import CarePageHeader from './CarePageHeader';
import { readTimelinePages } from './timeline';
const day = (value = new Date()) => {const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const time = (value = new Date()) => {const d = new Date(value); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};
export default function MemoScreen({ child, backendOnline, onToast, onMedication }) {
  const [writing,setWriting]=useState(false);
  const [deleting,setDeleting]=useState(null);
  const composeRef=useRef(null);
  useEffect(()=>{if(writing)composeRef.current?.scrollIntoView({behavior:'smooth',block:'start'});},[writing]);
  const [date,setDate]=useState(()=>day()), [clock,setClock]=useState(()=>time()), [body,setBody]=useState('');
  const [records,setRecords]=useState([]), [tags,setTags]=useState([]), [tagIds,setTagIds]=useState([]);
  const [editing,setEditing]=useState(null), [filter,setFilter]=useState(''), [query,setQuery]=useState('');
  const [loading,setLoading]=useState(true), [busy,setBusy]=useState(false), [error,setError]=useState(''), [revision,setRevision]=useState(0);
  const [manager,setManager]=useState(false), [tagEdit,setTagEdit]=useState(null), [tagName,setTagName]=useState('');
  useEffect(()=>{
    const abort=new AbortController(); let active=true; setLoading(true);setError('');
    if(!child?.id || !backendOnline){setLoading(false);setRecords([]);setTags([]);return;}
    Promise.all([readTimelinePages(cursor=>api.timelinePage('health-records',child.id,cursor,abort.signal),abort.signal),api.memoTags(child.id)])
      .then(([rows,labels])=>{if(active){setRecords(rows);setTags(labels);setTagIds(ids=>ids.filter(id=>labels.some(t=>t.id===id)));setFilter(id=>labels.some(t=>t.id===id)?id:'');}})
      .catch(e=>{if(active)setError(errorMessage(e));}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;abort.abort();};
  },[child?.id,backendOnline,revision]);
  const reset=()=>{setEditing(null);setBody('');setDate(day());setClock(time());setTagIds([]);};
  const save=async event=>{
    event.preventDefault();if(busy || !child?.id || !backendOnline)return;
    if(!body.trim()){onToast('메모 내용을 입력해주세요');return;}
    setBusy(true);
    try{const payload={patientId:child.id,body:body.trim(),recordedAt:new Date(`${date}T${clock}:00`).toISOString(),visitId:editing?.visitId || null,tagIds};
      if(editing)await api.updateHealthRecord(editing.recordId,payload);else await api.createHealthRecord(payload);
      reset();setWriting(false);setRevision(v=>v+1);onToast('메모를 저장했어요');
    }catch(e){onToast(errorMessage(e));}finally{setBusy(false);}
  };
  const mutate=async(work,message)=>{if(busy)return;setBusy(true);try{await work();setRevision(v=>v+1);onToast(message);}catch(e){onToast(e.status===409?'같은 이름이 있거나 가족이 태그를 수정했어요. 최신 목록을 확인해주세요.':errorMessage(e));setRevision(v=>v+1);}finally{setBusy(false);}};
  const visible=useMemo(()=>records.filter(r=>(!filter || r.tagIds?.includes(filter)) && r.body.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a,b)=>new Date(b.recordedAt||b.createdAt)-new Date(a.recordedAt||a.createdAt)),[records,filter,query]);
  const groups=new Map();visible.forEach(r=>{const key=day(r.recordedAt||r.createdAt);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);});
  const editRecord = r => {setEditing(r);setBody(r.body);setDate(day(r.recordedAt||r.createdAt));setClock(time(r.recordedAt||r.createdAt));setTagIds((r.tagIds||[]).filter(id=>tags.some(t=>t.id===id)));setWriting(true);};
  if(writing) return <div className="page padded memo-screen care-workspace memo-writing">
    <form ref={composeRef} className="memo-compose" onSubmit={save}>
      <header className="care-editor-bar"><button type="button" disabled={busy} onClick={()=>{reset();setWriting(false);}}>취소</button><h2>{editing?'메모 수정':'새 메모'}</h2><button className="care-save" disabled={busy || !body.trim() || !backendOnline}>{busy?'저장 중':'저장'}</button></header>
      <fieldset disabled={busy || loading || !backendOnline || !!error}>
        <div className="memo-datetime"><label className="date-picker"><CalendarDays size={16}/><input aria-label="기록 날짜" type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label><label className="date-picker"><Clock3 size={16}/><input aria-label="기록 시간" type="time" required value={clock} onChange={e=>setClock(e.target.value)}/></label></div>
        <textarea autoFocus aria-label="메모 내용" placeholder="오늘 아이에게 어떤 일이 있었나요?" value={body} onChange={e=>setBody(e.target.value)} maxLength={2000} required/>
        <div className="memo-compose-hint"><span>태그 선택 · 최대 10개</span><span>{body.length.toLocaleString()}/2,000</span></div>
        <div className="memo-tag-chips" aria-label="메모 태그 선택">{tags.map(t=><button type="button" key={t.id} aria-pressed={tagIds.includes(t.id)} onClick={()=>setTagIds(ids=>ids.includes(t.id)?ids.filter(id=>id!==t.id):ids.length<10?[...ids,t.id]:ids)}>#{t.name}</button>)}</div>
        {!tags.length && <p className="care-muted">태그는 메모 목록의 ‘태그 관리’에서 만들 수 있어요.</p>}
      </fieldset>
    </form>
  </div>;
  return <div className="page padded memo-screen care-workspace">
    <CarePageHeader icon={NotebookPen} title="육아 메모" description={<>{child?.fullName || child?.name || '아이'} · 메모 {records.length}개</>}><button className="care-add" disabled={busy || !backendOnline || !child?.id} onClick={()=>{reset();setWriting(true);}}><Plus size={18}/> 새 메모</button></CarePageHeader>
    {!child?.id ? <p className="care-blank">아이를 먼저 선택해주세요.</p> : <>
      {!backendOnline && <p role="status" className="record-timeline-error">연결이 끊겼어요. 서버 연결 후 다시 시도해주세요.</p>}
      <div className="memo-tools"><div className="record-timeline-search"><Search size={18}/><input aria-label="메모 검색" value={query} onChange={e=>setQuery(e.target.value)} placeholder="메모 검색"/>{query && <button aria-label="검색어 지우기" onClick={()=>setQuery('')}><X size={16}/></button>}</div><button className="memo-tag-manage" aria-expanded={manager} onClick={()=>setManager(v=>!v)}><Tag size={16}/><span>태그 관리</span></button></div>
      {manager && <section className="memo-tag-manager"><h3>우리 아이 공용 태그</h3><p>같은 아이를 돌보는 가족이 함께 사용해요.</p><form onSubmit={e=>{e.preventDefault();mutate(async()=>{const payload={patientId:child.id,name:tagName.trim(),version:tagEdit?.version};if(tagEdit)await api.updateMemoTag(tagEdit.id,payload);else await api.createMemoTag(payload);setTagName('');setTagEdit(null);},'태그를 저장했어요');}}><input aria-label="태그 이름" required maxLength={20} value={tagName} onChange={e=>setTagName(e.target.value)} placeholder="예: 수유, 수면, 복약" disabled={busy}/><button disabled={busy || !tagName.trim()}>{tagEdit?'이름 저장':'태그 추가'}</button>{tagEdit && <button type="button" onClick={()=>{setTagEdit(null);setTagName('');}}>취소</button>}</form>{tags.map(t=><div className="memo-tag-item" key={t.id}><b>#{t.name}</b><button disabled={busy} onClick={()=>{setTagEdit(t);setTagName(t.name);}} aria-label={`${t.name} 태그 이름 수정`}><Pencil size={15}/></button><button disabled={busy} aria-label={`${t.name} 태그 삭제`} onClick={()=>{if(window.confirm('태그를 삭제할까요? 연결된 메모 본문은 그대로 남아요.'))mutate(async()=>{await api.deleteMemoTag(t.id,t.version);if(tagEdit?.id===t.id){setTagEdit(null);setTagName('');}},'태그를 삭제했어요');}}><X size={15}/></button></div>)}</section>}
      {tags.length>0 && <div className="memo-tag-chips memo-filters" aria-label="메모 태그 필터"><button aria-pressed={!filter} onClick={()=>setFilter('')}>전체</button>{tags.map(t=><button key={t.id} aria-pressed={filter===t.id} onClick={()=>setFilter(t.id)}>#{t.name}</button>)}</div>}
      {error && <div role="alert" className="record-timeline-error">{error}<button onClick={()=>setRevision(v=>v+1)}>다시 불러오기</button></div>}
      {(filter||query) && <div className="memo-result-count"><span>검색 결과 {visible.length}개</span><button onClick={()=>{setFilter('');setQuery('');}}>초기화</button></div>}
      {loading?<p role="status" className="care-blank">메모를 불러오는 중…</p>:!error && <div className="memo-feed">
        {!visible.length && <div className="care-blank"><b>{filter||query?'일치하는 메모가 없어요':'아직 메모가 없어요'}</b><p>{filter||query?'검색어나 태그를 바꿔보세요.':'수유, 수면, 아이의 작은 변화를 남겨보세요.'}</p>{!filter&&!query&&<button className="care-text-action" onClick={()=>{reset();setWriting(true);}}>첫 메모 쓰기</button>}</div>}
        {[...groups].map(([key,rows])=><section className="memo-day" key={key}><h3>{new Date(`${key}T12:00`).toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'short'})}<span>{rows.length}</span></h3>{rows.map(r=><article className="memo-entry" key={r.recordId}>
          <div className="memo-entry-meta"><span><time>{time(r.recordedAt||r.createdAt)}</time><i>·</i>{r.authorName||'보호자'}</span><details className="record-menu" name="memo-actions"><summary aria-label={`${time(r.recordedAt||r.createdAt)} 메모 더보기`}><MoreHorizontal size={20}/></summary><div><button disabled={busy} onClick={()=>editRecord(r)}><Pencil size={16}/> 수정</button><button disabled={busy} onClick={()=>onMedication(r)}><Pill size={16}/> 복약 일정으로 등록</button><button className="danger" disabled={busy} onClick={e=>{e.currentTarget.closest('details').open=false;setDeleting(r.recordId);}}><Trash2 size={16}/> 삭제</button></div></details></div>
          <p className="memo-body">{r.body}</p><div className="memo-tag-labels">{tags.filter(t=>r.tagIds?.includes(t.id)).map(t=><span key={t.id}>#{t.name}</span>)}</div>
          {deleting===r.recordId && <div className="care-inline-confirm" role="group" aria-label="메모 삭제 확인"><p>이 메모를 삭제할까요?</p><button disabled={busy} onClick={()=>setDeleting(null)}>유지하기</button><button className="danger" disabled={busy} onClick={()=>mutate(async()=>{await api.deleteHealthRecord(r.recordId);setDeleting(null);},'메모를 삭제했어요')}>삭제</button></div>}
        </article>)}</section>)}
      </div>}
    </>}
  </div>;
}
