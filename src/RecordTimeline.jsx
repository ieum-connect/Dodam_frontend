import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, FileText, NotebookPen, Search, Stethoscope, RefreshCw, X, Clock3 } from 'lucide-react';
import { api, errorMessage } from './api';
import { buildTimeline, readTimelinePages } from './timeline';

const types = {
  visits: { label: '병원 방문', icon: Stethoscope },
  documents: { label: '건강 문서', icon: FileText },
  memos: { label: '육아 메모', icon: NotebookPen },
  schedules: { label: '일정·복약', icon: CalendarDays },
};

export default function RecordTimeline({ child, onOpen }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [data, setData] = useState({});
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [revision, setRevision] = useState(0);
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setData({}); setErrors([]); setLoading(true);
    if (!child?.id) { setLoading(false); return () => controller.abort(); }
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    const page = kind => readTimelinePages(cursor => api.timelinePage(kind, child.id, cursor, controller.signal), controller.signal);
    Promise.allSettled([page('visits'), page('documents'), page('health-records'), api.schedules(child.id, month.toISOString(), end.toISOString())])
      .then(results => {
        if (!active) return;
        const keys = Object.keys(types);
        const next = {}, failed = [];
        results.forEach((result, i) => {
          if (result.status === 'fulfilled') next[keys[i]] = result.value;
          else failed.push(`${types[keys[i]].label}: ${errorMessage(result.reason)}`);
        });
        setData(next); setErrors(failed); setLoading(false);
      });
    return () => { active = false; controller.abort(); };
  }, [child?.id, month, revision]);

  const rows = useMemo(() => buildTimeline(data, monthKey), [data, monthKey]);
  const visible = rows.filter(row => (filter === 'all' || row.kind === filter) &&
    [row.title, row.body, row.detail].filter(Boolean).join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const groups = new Map();
  visible.forEach(row => {
    if (!groups.has(row.day)) groups.set(row.day, []);
    groups.get(row.day).push(row);
  });

  return <div className="page padded detail-page record-timeline">
    <div className="record-timeline-heading"><span className="record-timeline-kicker">우리 아이 건강 노트</span><h2>기록 모아보기</h2><p><b>{child?.fullName || child?.name || '아이'}</b>의 하루를 차곡차곡 살펴보세요.</p></div>
    {!child?.id ? <p className="empty-record">아이를 먼저 등록하거나 선택해주세요.</p> : <>
      <div className="record-timeline-month"><button aria-label="이전 달" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft/></button><h3>{month.getFullYear()}년 {month.getMonth() + 1}월</h3><button aria-label="다음 달" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight/></button><button className="record-timeline-today" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>이번 달</button></div>
      <div className="record-timeline-filters" aria-label="기록 종류">{[['all', '전체'], ...Object.entries(types).map(([key, value]) => [key, value.label])].map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>
      <div className="record-timeline-search"><Search size={18} aria-hidden="true"/><input aria-label="기록 검색" placeholder="병원명, 문서명, 메모 내용 검색" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button aria-label="검색어 지우기" onClick={() => setQuery('')}><X size={18}/></button>}</div>
      <p className="record-timeline-help"><Clock3 size={14}/>최근 날짜부터 보여드려요</p>
      {errors.length > 0 && <div className="record-timeline-error" role="alert"><b>일부 기록을 불러오지 못했어요.</b>{errors.map(error => <p key={error}>{error}</p>)}<button onClick={() => setRevision(r => r + 1)}><RefreshCw size={15}/> 다시 불러오기</button></div>}
      {loading ? <p role="status" className="empty-record">아이의 기록을 모으고 있어요…</p> : <>
        <div className="list-header"><h3>{filter === 'all' ? '모든 기록' : types[filter].label}</h3><span aria-live="polite">{visible.length}건{errors.length ? ' · 조회된 기록 기준' : ''}</span></div>
        {!visible.length && <div className="empty-record">{errors.length ? '조회된 기록이 없어요. 위 안내를 확인하고 다시 불러와주세요.' : query || filter !== 'all' ? '조건에 맞는 기록이 없어요. 검색어나 종류를 바꿔보세요.' : '이 달에 등록된 기록이 없어요.'}{!errors.length && (query || filter !== 'all') && <button className="record-reset" onClick={() => {setQuery(''); setFilter('all');}}>필터 초기화</button>}</div>}
        {[...groups].map(([day, items]) => <section className="record-timeline-day" key={day}><h3><span className="record-day-number">{Number(day.slice(8))}</span><span>{Number(day.slice(5, 7))}월 · {new Date(`${day}T12:00:00`).toLocaleDateString('ko-KR', { weekday: 'long' })}</span><small>{items.length}건</small></h3><div>{items.map(row => {
          const Icon = types[row.kind].icon;
          return <article className={`record-timeline-entry ${row.kind}`} key={row.id}>
            <span className="record-timeline-icon"><Icon size={19}/></span>
            <div className="record-timeline-content"><div className="record-timeline-meta"><span className="record-kind">{types[row.kind].label}</span>{row.status && <span className={row.status === '완료' ? 'completed' : 'scheduled'}>{row.status}</span>}</div><div className="record-entry-time">{row.label}{row.date.length > 10 && ` ${new Date(row.date).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`}</div>
              <h4>{row.title}</h4>{row.body && <p>{row.body}</p>}{row.detail && <small>{row.detail}</small>}{row.kind === 'schedules' && <small className="record-time-note">표시된 시간은 예정 시각이에요.</small>}<button onClick={() => onOpen(row.route)}>{row.routeLabel}<ChevronRight size={14}/></button>
            </div>
          </article>;
        })}</div></section>)}
      </>}
    </>}
  </div>;
}
