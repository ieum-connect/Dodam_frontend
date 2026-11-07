import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Ruler, Scale, TrendingUp, Pencil, Trash2, X } from 'lucide-react';
import { api, errorMessage } from './api';
import { growthRange, growthPoints, growthPosition, stamp } from './growth';

const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
const blank = () => ({ measuredOn: today(), heightCm: '', weightKg: '', note: '' });
const metrics = { heightCm: { name: '키', unit: 'cm', icon: Ruler }, weightKg: { name: '몸무게', unit: 'kg', icon: Scale } };
function GrowthChart({ rows, metric, range }) {
  const points = growthPoints(rows, metric, range);
  const [selectedId, setSelectedId] = useState(null);
  const selected = points.find(row => row.id === selectedId) || points.at(-1);
  if (!points.length) return <div className="growth-empty"><TrendingUp/><p>이 기간의 {metrics[metric].name} 기록이 없어요.</p><small>측정값을 등록하거나 조회 기간을 바꿔보세요.</small></div>;
  const values = points.map(row => Number(row[metric]));
  const lo = Math.min(...values), hi = Math.max(...values);
  const padding = Math.max((hi - lo) * .2, metric === 'heightCm' ? 1 : .2);
  const min = Math.max(0, lo - padding), max = hi + padding;
  const x = row => 48 + growthPosition(row.measuredOn, range) * 276;
  const y = row => 160 - (Number(row[metric]) - min) / (max - min) * 130;
  const delta = Number(points.at(-1)[metric]) - Number(points[0][metric]);
  return <>
    <div className="growth-period-summary"><div><span>기간 내 {metrics[metric].name} 변화</span><strong>{points.length > 1 ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}` : '—'} <small>{metrics[metric].unit}</small></strong></div><span>{points.length}회 측정<br/>{points.length > 1 ? '첫 측정 → 마지막 측정' : '비교할 기록을 더 남겨주세요'}</span></div>
    <svg className="growth-live-chart" viewBox="0 0 360 205" role="group" aria-label={`${range.from}부터 ${range.to}까지 ${metrics[metric].name} 측정 추이`}>
      {[0, 1, 2, 3].map(i => { const value = min + (max - min) * i / 3; const py = 160 - 130 * i / 3; return <g key={i}><line x1="48" y1={py} x2="324" y2={py} stroke="#eddee5" strokeDasharray="3 4"/><text x="39" y={py + 4} textAnchor="end" fontSize="11" fill="#79616f">{value.toFixed(1)}</text></g>; })}
      {[0, 1, 2, 3].map(i => { const date = new Date(stamp(range.from) + (stamp(range.to) - stamp(range.from)) * i / 3).toISOString().slice(0, 10); return <g key={i}><line x1={48 + i * 92} x2={48 + i * 92} y1="30" y2="160" stroke="#f4ecf0"/><text x={48 + i * 92} y="189" textAnchor="middle" fontSize="11" fill="#79616f">{date.slice(2).replaceAll('-', '.')}</text></g>; })}
      {points.length > 1 && <polyline points={points.map(row => `${x(row)},${y(row)}`).join(' ')} fill="none" stroke="#b44873" strokeWidth="2.5"/>}
      {points.map(row => <g key={row.id} role="button" tabIndex="0" aria-label={`${row.measuredOn} ${row[metric]} ${metrics[metric].unit}`} aria-pressed={selected.id === row.id} onClick={() => setSelectedId(row.id)} onKeyDown={event => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); setSelectedId(row.id);}}}><circle cx={x(row)} cy={y(row)} r="12" fill="transparent"/><circle cx={x(row)} cy={y(row)} r={selected.id === row.id ? 6 : 4} fill="#b44873" stroke="white" strokeWidth="2"/></g>)}
    </svg>
    <div className="growth-point-detail" aria-live="polite"><span>{selected.measuredOn} 측정</span><b>{Number(selected[metric]).toFixed(1)} {metrics[metric].unit}</b></div>
    <p className="growth-chart-note">점을 누르면 측정값을 확인할 수 있어요. 기록이 없는 기간은 빈 공간으로 표시해요. 세로축은 측정값에 맞춰 조정돼요.</p>
  </>;
}

export default function GrowthScreen({ child, onToast }) {
  const [records, setRecords] = useState([]), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [formError, setFormError] = useState('');
  const [metric, setMetric] = useState('heightCm'), [period, setPeriod] = useState(6);
  const [form, setForm] = useState(null), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0);
  const [deleting, setDeleting] = useState(null);
  const editor = useRef(null);
  useEffect(() => {
    let active = true;
    setRecords([]); setError(''); setLoading(true);
    if (!child?.id) { setLoading(false); return; }
    api.growthRecords(child.id).then(rows => { if (active) setRecords(rows); }).catch(e => { if (active) setError(errorMessage(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [child?.id, revision]);
  useEffect(() => { if (form) editor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [!!form]);
  const range = useMemo(() => growthRange(period, today(), records), [records, period]);
  const visible = useMemo(() => records.filter(row => row.measuredOn >= range.from && row.measuredOn <= range.to), [records, range]);
  useEffect(() => { setForm(null); setDeleting(null); setFormError(''); }, [child?.id]);
  const save = async event => {
    event.preventDefault();
    if (!form.heightCm && !form.weightKg) { setFormError('키 또는 몸무게를 하나 이상 입력해주세요.'); return; }
    const measuredOn = new FormData(event.currentTarget).get('measuredOn');
    if (records.some(row => row.measuredOn === measuredOn && row.id !== form.id)) { setFormError('같은 날의 기록이 있어요. 아래 목록에서 해당 기록을 수정해주세요.'); return; }
    setBusy(true); setFormError('');
    const body = { ...form, measuredOn, patientId: child.id, heightCm: form.heightCm === '' ? null : Number(form.heightCm), weightKg: form.weightKg === '' ? null : Number(form.weightKg) };
    try {
      if (form.id) await api.updateGrowth(form.id, body); else await api.createGrowth(body);
      setForm(null); setRevision(r => r + 1); onToast('성장 기록을 저장했어요');
    } catch (e) { setFormError(e.status === 409 ? '같은 날짜에 기록이 있거나 가족이 내용을 변경했어요. 새로 불러온 뒤 다시 수정해주세요.' : errorMessage(e)); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setError('');
    try { await api.deleteGrowth(deleting.id, deleting.version); setDeleting(null); setRevision(r => r + 1); onToast('성장 기록을 삭제했어요'); }
    catch(e) { setError(errorMessage(e)); setDeleting(null); }
    finally { setBusy(false); }
  };
  return <div className="page padded detail-page growth-live">
    <header className="record-timeline-heading"><span className="record-timeline-kicker">차곡차곡 자라는 우리 아이</span><h2>성장 기록</h2><p>{child?.fullName || child?.name || '아이'}의 키와 몸무게 변화를 살펴보세요.</p></header>
    {!child?.id ? <div className="growth-empty">아이를 먼저 등록하거나 선택해주세요.</div> : <>
      <button className="primary-button growth-add" disabled={busy} onClick={() => {setForm(blank()); setFormError('');}}><Plus size={19}/> 측정 기록 추가</button>
      {error && <div role="alert" className="record-timeline-error">{error}<button onClick={() => setRevision(r => r + 1)}>다시 불러오기</button></div>}
      {form && <form className="growth-editor" onSubmit={save} ref={editor}>
        <div className="growth-editor-heading"><h3>{form.id ? '측정 기록 수정' : '새 측정 기록'}</h3><button type="button" aria-label="입력 닫기" disabled={busy} onClick={() => setForm(null)}><X/></button></div>
        <label>측정일<input type="date" name="measuredOn" key={form.id || 'new'} required defaultValue={form.measuredOn} max={today()} min={child.birthDate || undefined} disabled={busy} onChange={e => setForm({...form, measuredOn: e.target.value})}/></label>
        <div className="growth-input-pair">{Object.entries(metrics).map(([key, info]) => <label key={key}>{info.name} ({info.unit})<input aria-label={`${info.name} (${info.unit})`} type="number" inputMode="decimal" min="0.1" max={key === 'heightCm' ? '300' : '500'} step="0.1" placeholder={key === 'heightCm' ? '예: 85.2' : '예: 12.3'} value={form[key]} disabled={busy} onChange={e => setForm({...form, [key]: e.target.value})}/></label>)}</div>
        <p className="growth-chart-note">키와 몸무게 중 하나만 입력해도 저장할 수 있어요.</p>
        <label>메모 (선택)<textarea value={form.note} maxLength={500} placeholder="측정 장소나 기억할 내용을 남겨주세요" disabled={busy} onChange={e => setForm({...form, note: e.target.value})}/></label>
        {formError && <p className="growth-form-error" role="alert">{formError}</p>}
        <button className="primary-button" disabled={busy}>{busy ? '저장 중…' : '기록 저장'}</button>
        {formError && <button type="button" className="outline-button" disabled={busy} onClick={() => {setForm(null);setRevision(r => r + 1);}}>기록 새로 불러오기</button>}
      </form>}
      {loading ? <p role="status" className="growth-empty">성장 기록을 불러오고 있어요…</p> : !error && <>
        <div className="growth-summary">{Object.entries(metrics).map(([key, info]) => {
          const measured = records.filter(row => row[key] != null), latest = measured[0], previous = measured[1];
          const delta = previous ? Number((latest[key] - previous[key]).toFixed(1)) : null;
          const Icon = info.icon;
          return <div key={key}><span><Icon size={16}/> 최근 {info.name}</span><b>{latest ? Number(latest[key]).toFixed(1) : '—'}<small>{info.unit}</small></b><p>{latest?.measuredOn || '아직 기록이 없어요'}</p>{delta != null && <em>직전 측정 대비 {delta > 0 ? '+' : ''}{delta.toFixed(1)} {info.unit}</em>}</div>;
        })}</div>
        <section className="growth-graph-panel"><div className="growth-metric-tabs">{Object.entries(metrics).map(([key, info]) => <button key={key} aria-pressed={metric === key} onClick={() => setMetric(key)}>{info.name}</button>)}</div>
          <div className="growth-periods" aria-label="조회 기간">{[[3,'3개월'],[6,'6개월'],[12,'1년'],[0,'전체']].map(([value,label]) => <button key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>{label}</button>)}</div>
          <p className="growth-range-label">{range.from.replaceAll('-', '.')} — {range.to.replaceAll('-', '.')}</p><GrowthChart rows={visible} metric={metric} range={range}/>
        </section>
        <p className="growth-chart-note">입력한 측정값의 변화예요. 또래 평균이나 정상 범위를 판단하는 그래프는 아니에요.</p>
        <div className="list-header"><h3>측정 기록</h3><span>{visible.length}건 · {period ? `최근 ${period}개월` : '전체 기간'}</span></div>
        {!visible.length && <div className="growth-empty">이 기간에 등록된 기록이 없어요.</div>}
        {visible.map(row => <article className="growth-history" key={row.id}><h4>{row.measuredOn}</h4><div className="growth-history-values"><span>키 <b>{row.heightCm ?? '—'}</b> cm</span><span>몸무게 <b>{row.weightKg ?? '—'}</b> kg</span></div>{row.note && <p>{row.note}</p>}<div className="growth-history-actions"><button disabled={busy} onClick={() => {setForm({...row, heightCm: row.heightCm ?? '', weightKg: row.weightKg ?? '', note: row.note || ''});setFormError('');}}><Pencil size={14}/> 수정</button><button disabled={busy} onClick={() => setDeleting(row)}><Trash2 size={14}/> 삭제</button></div></article>)}
      </>}
      {deleting && <div className="growth-delete-confirm" role="dialog" aria-modal="true" aria-labelledby="growth-delete-title"><div><h3 id="growth-delete-title">이 측정 기록을 삭제할까요?</h3><p>{deleting.measuredOn} 기록이 그래프와 목록에서 사라져요.</p><button disabled={busy} onClick={() => setDeleting(null)}>취소</button><button disabled={busy} onClick={remove}>{busy ? '삭제 중…' : '기록 삭제'}</button></div></div>}
    </>}
  </div>;
}
