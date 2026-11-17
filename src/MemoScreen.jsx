import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Pill, Plus, Tag, Search, MoreHorizontal, Trash2, NotebookPen, X } from 'lucide-react';
import { api, errorMessage } from './api';
import CarePageHeader from './CarePageHeader';
import RecordDialog from './RecordDialog';
import { readTimelinePages } from './timeline';
const day = (value = new Date()) => {const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const time = (value = new Date()) => {const d = new Date(value); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};
const tagColor = id => {
  let hash = 0;
  for (const character of id) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  return { '--tag-hue': (hash * 137) % 360 };
};
export default function MemoScreen({ child, backendOnline, onToast, onMedication }) {
  const [writing,setWriting]=useState(false);
  const [deleting,setDeleting]=useState(null);
  const composeRef=useRef(null);
  useEffect(()=>{if(writing)composeRef.current?.scrollIntoView({behavior:'smooth',block:'start'});},[writing]);
  const [date,setDate]=useState(()=>day()), [clock,setClock]=useState(()=>time()), [body,setBody]=useState('');
  const [records,setRecords]=useState([]), [tags,setTags]=useState([]), [tagIds,setTagIds]=useState([]);
  const [editing,setEditing]=useState(null), [filter,setFilter]=useState(''), [query,setQuery]=useState('');
  const [loading,setLoading]=useState(true), [busy,setBusy]=useState(false), [error,setError]=useState(''), [revision,setRevision]=useState(0);
  const [manager,setManager]=useState(false);
  const [tagDialog,setTagDialog]=useState(null), [tagName,setTagName]=useState(''), [tagError,setTagError]=useState('');
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
    event?.preventDefault();if(busy || loading || error || !child?.id || !backendOnline)return;
    if(!body.trim()){onToast('메모 내용을 입력해주세요');return;}
    setBusy(true);
    try{const payload={patientId:child.id,body:body.trim(),recordedAt:new Date(`${date}T${clock}:00`).toISOString(),visitId:editing?.visitId || null,tagIds};
      if(editing)await api.updateHealthRecord(editing.recordId,payload);else await api.createHealthRecord(payload);
      reset();setWriting(false);setRevision(v=>v+1);onToast('메모를 저장했어요');
    }catch(e){onToast(errorMessage(e));}finally{setBusy(false);}
  };
  const mutate=async(work,message)=>{if(busy)return;setBusy(true);try{await work();setRevision(v=>v+1);onToast(message);}catch(e){onToast(e.status===409?'같은 이름이 있거나 가족이 태그를 수정했어요. 최신 목록을 확인해주세요.':errorMessage(e));setRevision(v=>v+1);}finally{setBusy(false);}};
  const closeTag = () => { setTagDialog(null); setTagName(''); setTagError(''); };
  const openTag = (action, tag) => {
    setTagName(tag?.name || '');
    setTagError('');
    setTagDialog({ action, tag });
  };
  const changeTag = async () => {
    if (!tagDialog || busy || !child?.id || !backendOnline) return;
    const { action } = tagDialog;
    const tag = tags.find(item => item.id === tagDialog.tag?.id) || tagDialog.tag;
    const name = tagName.trim();
    setBusy(true);
    setTagError('');
    try {
      if (action === 'delete') {
        await api.deleteMemoTag(tag.id, tag.version);
        setRevision(value => value + 1);
      } else if (action === 'edit') {
        await api.updateMemoTag(tag.id, { patientId: child.id, name, version: tag.version });
        setRevision(value => value + 1);
      } else {
        const created = await api.createMemoTag({ patientId: child.id, name });
        setTags(items => items.some(item => item.id === created.id) ? items : [...items, created]);
        if (writing) setTagIds(ids => ids.length < 10 ? [...ids, created.id] : ids);
      }
      closeTag();
      onToast(action === 'delete' ? '태그를 삭제했어요' : '태그를 저장했어요');
    } catch (failure) {
      setTagError(errorMessage(failure, '태그를 저장하지 못했어요.'));
      if (failure.status === 409) setRevision(value => value + 1);
    } finally { setBusy(false); }
  };
  const tagModal = tagDialog && <RecordDialog
    title={tagDialog.action === 'delete' ? '이 태그를 삭제할까요?' : tagDialog.action === 'edit' ? '태그 이름 수정' : '태그 만들기'}
    description={tagDialog.action === 'delete' ? '연결된 메모에서는 태그만 사라지고 본문은 그대로 남아요.' : '같은 아이를 돌보는 가족이 함께 사용하는 태그예요.'}
    confirmLabel={tagDialog.action === 'delete' ? '태그 삭제' : tagDialog.action === 'edit' ? '이름 저장' : '태그 추가'}
    busy={busy} disabled={loading || !backendOnline || (tagDialog.action !== 'delete' && !tagName.trim())}
    onConfirm={changeTag} onClose={closeTag}>
    {tagDialog.action !== 'delete' && <label className="memo-tag-dialog-field">태그 이름
      <input className="select-field" required maxLength={20} value={tagName} disabled={busy} placeholder="예: 수유, 수면, 복약" onChange={event => setTagName(event.target.value)}/>
    </label>}
    {tagError && <p role="alert">{tagError}</p>}
  </RecordDialog>;
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    const matchingTags = new Set(tags.filter(tag => tag.name.toLocaleLowerCase().includes(term)).map(tag => tag.id));
    return records.filter(record =>
      (!filter || record.tagIds?.includes(filter)) &&
      (!term || record.body.toLocaleLowerCase().includes(term) || record.tagIds?.some(id => matchingTags.has(id)))
    ).sort((a, b) => new Date(b.recordedAt || b.createdAt) - new Date(a.recordedAt || a.createdAt));
  }, [records, tags, filter, query]);
  const groups=new Map();visible.forEach(r=>{const key=day(r.recordedAt||r.createdAt);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);});
  const editRecord = r => {setEditing(r);setBody(r.body);setDate(day(r.recordedAt||r.createdAt));setClock(time(r.recordedAt||r.createdAt));setTagIds((r.tagIds||[]).filter(id=>tags.some(t=>t.id===id)));setWriting(true);};
  const positionRecordMenu = event => {
    const menu = event.currentTarget;
    if (!menu.open) return;
    const trigger = menu.querySelector('summary').getBoundingClientRect();
    const list = menu.querySelector('div').getBoundingClientRect();
    const bottom = document.querySelector('.bottom-nav')?.getBoundingClientRect().top ?? window.innerHeight;
    menu.classList.toggle('opens-up', bottom - trigger.bottom < list.height + 4 && trigger.top > list.height + 4);
  };
  const closeEditor = () => { reset(); setWriting(false); };
  const composeFields = <fieldset disabled={busy || loading || !backendOnline || !!error}>
        <div className="memo-datetime"><label className="date-picker"><span>기록 날짜</span><input aria-label="기록 날짜" type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label><label className="date-picker"><span>기록 시간</span><input aria-label="기록 시간" type="time" required value={clock} onChange={e=>setClock(e.target.value)}/></label></div>
        <textarea aria-label="메모 내용" placeholder="오늘 아이에게 어떤 일이 있었나요?" value={body} onChange={e=>setBody(e.target.value)} maxLength={2000} required/>
        <div className="memo-character-count">{body.length.toLocaleString()}/2,000</div>
        <div className="memo-compose-hint">
          <span>태그 <span className="memo-tag-limit">최대 10개</span></span>
          <button type="button" className="memo-create-tag" disabled={tagIds.length >= 10} onClick={() => openTag('create')}><Plus size={16}/> 태그 만들기</button>
        </div>
        <div className="memo-tag-chips" aria-label="메모 태그 선택">{tags.map(t=><button type="button" className="memo-color-tag" style={tagColor(t.id)} key={t.id} aria-pressed={tagIds.includes(t.id)} onClick={()=>setTagIds(ids=>ids.includes(t.id)?ids.filter(id=>id!==t.id):ids.length<10?[...ids,t.id]:ids)}>{t.name}</button>)}</div>
      </fieldset>;
  if(writing && !editing) return <div className="page padded memo-screen care-workspace memo-writing">
    <form ref={composeRef} className="memo-compose" onSubmit={save}>
      <header className="care-editor-bar"><button type="button" disabled={busy} onClick={closeEditor}>취소</button><h2>새 메모</h2><button className="care-save" disabled={busy || loading || !!error || !body.trim() || !backendOnline}>{busy?'저장 중':'저장'}</button></header>
      {composeFields}
    </form>
    {tagModal}
  </div>;
  return <div className="page padded memo-screen care-workspace">
    <CarePageHeader icon={NotebookPen} title="육아 메모" description={<>{child?.fullName || child?.name || '아이'} · 메모 {records.length}개</>}><button className="care-add" disabled={busy || !backendOnline || !child?.id} onClick={()=>{reset();setWriting(true);}}><Plus size={18}/> 새 메모</button></CarePageHeader>
    {!child?.id ? <p className="care-blank">아이를 먼저 선택해주세요.</p> : <>
      {!backendOnline && <p role="status" className="record-timeline-error">연결이 끊겼어요. 서버 연결 후 다시 시도해주세요.</p>}
      <div className="memo-tools"><div className="record-timeline-search"><Search size={18}/><input aria-label="메모 검색" value={query} onChange={e=>setQuery(e.target.value)} placeholder="본문 또는 태그 검색"/>{query && <button aria-label="검색어 지우기" onClick={()=>setQuery('')}><X size={16}/></button>}</div><button className="memo-tag-manage" aria-expanded={manager} onClick={()=>setManager(v=>!v)}><Tag size={16}/><span>태그 관리</span></button></div>
      {manager && <section className="memo-tag-manager">
        <div className="memo-tag-manager-head"><div><h3>우리 아이 공용 태그 <span>{tags.length}개</span></h3><p>같은 아이를 돌보는 가족이 함께 사용해요.</p></div>
          <button type="button" className="memo-create-tag" disabled={busy || loading || !backendOnline} onClick={() => openTag('create')}><Plus size={16}/> 추가</button>
        </div>
        <div className="memo-tag-manager-list">
          {!tags.length && !loading && <p>아직 만든 태그가 없어요.</p>}
          {tags.map(tag => <div className="memo-tag-item" key={tag.id}>
            <b className="memo-color-tag" style={tagColor(tag.id)}>{tag.name}</b>
            <button disabled={busy || !backendOnline} onClick={() => openTag('edit', tag)} aria-label={`${tag.name} 태그 이름 수정`}><Pencil size={16}/></button>
            <button disabled={busy || !backendOnline} onClick={() => openTag('delete', tag)} aria-label={`${tag.name} 태그 삭제`}><Trash2 size={16}/></button>
          </div>)}
        </div>
      </section>}
      {tags.length>0 && <div className="memo-tag-chips memo-filters" aria-label="메모 태그 필터"><button aria-pressed={!filter} onClick={()=>setFilter('')}>전체</button>{tags.map(t=><button className="memo-color-tag" style={tagColor(t.id)} key={t.id} aria-pressed={filter===t.id} onClick={()=>setFilter(t.id)}>{t.name}</button>)}</div>}
      {error && <div role="alert" className="record-timeline-error">{error}<button onClick={()=>setRevision(v=>v+1)}>다시 불러오기</button></div>}
      {(filter||query) && <div className="memo-result-count"><span>검색 결과 {visible.length}개</span><button onClick={()=>{setFilter('');setQuery('');}}>초기화</button></div>}
      {loading?<p role="status" className="care-blank">메모를 불러오는 중…</p>:!error && <div className="memo-feed">
        {!visible.length && <div className="care-blank"><b>{filter||query?'일치하는 메모가 없어요':'아직 메모가 없어요'}</b><p>{filter||query?'검색어나 태그를 바꿔보세요.':'수유, 수면, 아이의 작은 변화를 남겨보세요.'}</p>{!filter&&!query&&<button className="care-text-action" onClick={()=>{reset();setWriting(true);}}>첫 메모 쓰기</button>}</div>}
        {[...groups].map(([key,rows])=><section className="memo-day" key={key}><h3>{new Date(`${key}T12:00`).toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'short'})}<span>{rows.length}</span></h3>{rows.map(r=><article className="memo-entry" key={r.recordId}>
          <div className="memo-entry-meta"><span><time>{time(r.recordedAt||r.createdAt)}</time><i>·</i>{r.authorName||'보호자'}</span><details className="record-menu" name="memo-actions" onToggle={positionRecordMenu}><summary aria-label={`${time(r.recordedAt||r.createdAt)} 메모 더보기`}><MoreHorizontal size={20}/></summary><div><button disabled={busy} onClick={event=>{event.currentTarget.closest("details").open=false;editRecord(r);}}><Pencil size={16}/> 수정</button><button disabled={busy} onClick={()=>onMedication(r)}><Pill size={16}/> 복약 일정으로 등록</button><button className="danger" disabled={busy} onClick={e=>{e.currentTarget.closest('details').open=false;setDeleting(r.recordId);}}><Trash2 size={16}/> 삭제</button></div></details></div>
          <p className="memo-body">{r.body}</p><div className="memo-tag-labels">{tags.filter(t=>r.tagIds?.includes(t.id)).map(t=><span className="memo-color-tag" style={tagColor(t.id)} key={t.id}>{t.name}</span>)}</div>
        </article>)}</section>)}
      </div>}
    </>}
    {deleting && <RecordDialog title="이 메모를 삭제할까요?" description="삭제한 메모는 목록에서 사라져요." busy={busy} confirmLabel="메모 삭제" onClose={() => setDeleting(null)} onConfirm={() => mutate(async () => { await api.deleteHealthRecord(deleting); setDeleting(null); }, '메모를 삭제했어요')}/>}
    {editing && <RecordDialog title="메모 수정" busy={busy} disabled={loading || !!error || !body.trim() || !backendOnline} confirmLabel="변경사항 저장" onClose={closeEditor} onConfirm={save}>
      <div className="memo-screen care-workspace memo-writing memo-edit-fields">{composeFields}</div>
    </RecordDialog>}
    {tagModal}
  </div>;
}
