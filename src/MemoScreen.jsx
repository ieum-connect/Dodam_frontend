import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NotebookPen, CalendarDays, Clock3, Pencil, X, Pill, Plus, Tag, Search } from 'lucide-react';
import { api, errorMessage } from './api';
import { readTimelinePages } from './timeline';
const day = (value = new Date()) => {const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const time = (value = new Date()) => {const d = new Date(value); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};
export default function MemoScreen({ child, backendOnline, onToast, onMedication }) {
  const [writing,setWriting]=useState(false);
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
  return <div className="page padded detail-page memo-screen"><div className="detail-hero"><span className="detail-icon"><NotebookPen/></span><div><h2>육아 메모</h2><p>{child?.fullName || child?.name || '아이'}의 일상을 자유롭게 남겨요.</p></div></div>
    {!child?.id ? <p>아이를 먼저 선택해주세요.</p> : <>
      <div className="memo-overview"><div><span>우리 아이의 하루</span><b>{records.length}개의 메모</b></div><button className="primary-button compact" disabled={busy || !backendOnline} onClick={()=>{reset();setWriting(true);}}><Plus size={17}/> 메모 쓰기</button></div>
      {!backendOnline && <p role="status" className="record-timeline-error">서버와 연결되지 않았어요. 연결 후 메모를 저장할 수 있어요.</p>}
      {writing && <form ref={composeRef} className="memo-compose" onSubmit={save}><div className="memo-compose-heading"><h3>{editing?'메모 수정':'오늘의 메모'}</h3><button type="button" aria-label="메모 입력 닫기" disabled={busy} onClick={()=>{reset();setWriting(false);}}><X size={19}/></button></div><fieldset disabled={busy || loading || !backendOnline || !!error}>
        <div className="memo-datetime"><label className="date-picker"><CalendarDays/><span><small>기록 날짜</small><input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></span></label><label className="date-picker"><Clock3/><span><small>기록 시간</small><input type="time" required value={clock} onChange={e=>setClock(e.target.value)}/></span></label></div>
        <textarea aria-label="메모 내용" placeholder="먹고, 자고, 놀았던 일… 자유롭게 적어주세요" value={body} onChange={e=>setBody(e.target.value)} maxLength={2000} required/>
        <div className="memo-tag-chips" aria-label="메모 태그 선택">{tags.map(t=><button type="button" key={t.id} aria-pressed={tagIds.includes(t.id)} onClick={()=>setTagIds(ids=>ids.includes(t.id)?ids.filter(id=>id!==t.id):ids.length<10?[...ids,t.id]:ids)}>#{t.name}</button>)}</div>
        <div className="memo-compose-hint"><span>태그 {tagIds.length}/10개</span><span>{body.length}/2,000자</span></div><div className="memo-actions">{editing && <button type="button" onClick={reset}>수정 취소</button>}<button className="primary-button compact">{busy?'저장 중…':editing?'메모 수정':'메모 저장'}</button></div>
      </fieldset></form>}
      <button className="memo-tag-manage" aria-expanded={manager} onClick={()=>setManager(v=>!v)}><Tag size={16}/> 가족 공용 태그 관리</button>
      {manager && <section className="memo-tag-manager"><h3>우리 아이 공용 태그</h3><p>같은 아이를 돌보는 가족이 함께 사용해요.</p><form onSubmit={e=>{e.preventDefault();mutate(async()=>{const payload={patientId:child.id,name:tagName.trim(),version:tagEdit?.version};if(tagEdit)await api.updateMemoTag(tagEdit.id,payload);else await api.createMemoTag(payload);setTagName('');setTagEdit(null);},'태그를 저장했어요');}}><input aria-label="태그 이름" required maxLength={20} value={tagName} onChange={e=>setTagName(e.target.value)} placeholder="예: 수유, 수면, 복약" disabled={busy}/><button disabled={busy || !tagName.trim()}>{tagEdit?'이름 저장':'태그 추가'}</button>{tagEdit && <button type="button" onClick={()=>{setTagEdit(null);setTagName('');}}>취소</button>}</form>{tags.map(t=><div className="memo-tag-item" key={t.id}><b>#{t.name}</b><button disabled={busy} onClick={()=>{setTagEdit(t);setTagName(t.name);}} aria-label={`${t.name} 태그 이름 수정`}><Pencil size={15}/></button><button disabled={busy} aria-label={`${t.name} 태그 삭제`} onClick={()=>{if(window.confirm('태그를 삭제할까요? 연결된 메모 본문은 그대로 남아요.'))mutate(async()=>{await api.deleteMemoTag(t.id,t.version);if(tagEdit?.id===t.id){setTagEdit(null);setTagName('');}},'태그를 삭제했어요');}}><X size={15}/></button></div>)}</section>}
      <div className="record-timeline-search"><Search size={18}/><input aria-label="메모 검색" value={query} onChange={e=>setQuery(e.target.value)} placeholder="메모 내용 검색"/></div>
      <div className="memo-tag-chips" aria-label="메모 태그 필터"><button aria-pressed={!filter} onClick={()=>setFilter('')}>전체</button>{tags.map(t=><button key={t.id} aria-pressed={filter===t.id} onClick={()=>setFilter(t.id)}>#{t.name}</button>)}</div>
      {error && <div role="alert" className="record-timeline-error">{error}<button onClick={()=>setRevision(v=>v+1)}>다시 불러오기</button></div>}
      <div className="list-header"><h3>날짜별 메모</h3><span>{visible.length}건</span></div>{(filter||query) && <button className="care-clear-filter" onClick={()=>{setFilter('');setQuery('');}}>검색·태그 필터 초기화</button>}
      {loading?<p role="status">메모를 불러오고 있어요…</p>:!error && <div className="memo-timeline">{!visible.length && <p className="memo-empty">{filter||query?'조건에 맞는 메모가 없어요.':'첫 메모를 남겨보세요.'}</p>}{[...groups].map(([key,rows])=><section key={key}><div className="timeline-date"><b>{key.replaceAll('-','.')}</b><span>{rows.length}건</span></div>{rows.map(r=><div className="timeline-row" key={r.recordId}><span className="timeline-time">{time(r.recordedAt||r.createdAt)}</span><span className="timeline-rail" aria-hidden="true"><i/></span><div className="timeline-card"><div className="timeline-head"><b>{r.authorName||'보호자'}</b><div className="memo-row-actions"><button disabled={busy} aria-label="메모 수정" onClick={()=>{setWriting(true);composeRef.current?.scrollIntoView({behavior:'smooth',block:'start'});setEditing(r);setBody(r.body);setDate(day(r.recordedAt||r.createdAt));setClock(time(r.recordedAt||r.createdAt));setTagIds((r.tagIds||[]).filter(id=>tags.some(t=>t.id===id)));}}><Pencil/></button><button disabled={busy} aria-label="메모 삭제" onClick={()=>{if(window.confirm('이 메모를 삭제할까요?'))mutate(async()=>{await api.deleteHealthRecord(r.recordId);if(editing?.recordId===r.recordId)reset();},'메모를 삭제했어요');}}><X/></button></div></div><p className="memo-body">{r.body}</p><div className="memo-tag-labels">{tags.filter(t=>r.tagIds?.includes(t.id)).map(t=><span key={t.id}>#{t.name}</span>)}</div><button className="memo-to-medication" disabled={busy} onClick={()=>onMedication(r)}><Pill size={16}/> 이 메모로 복약 일정 작성</button></div></div>)}</section>)}</div>}
    </>}
  </div>;
}
