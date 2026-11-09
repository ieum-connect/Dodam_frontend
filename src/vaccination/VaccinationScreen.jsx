import React, { useEffect, useState } from 'react';
import { ExternalLink, Syringe } from 'lucide-react';
import './vaccination.css';
import { api, errorMessage } from '../api';

const DAY = 86400000;
// 날짜는 모두 'YYYY-MM-DD' 문자열을 UTC 자정으로 바꿔 계산한다. 기기 시간대와 무관하다.
const utc = (value) => { const [y, m, d] = String(value || '').slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
const days = (to, from) => Math.round((utc(to) - utc(from)) / DAY);
const ddayLabel = (n) => !Number.isFinite(n) ? '' : n === 0 ? 'D-day' : n > 0 ? `D-${n}` : `D+${-n}`;
const dot = (value) => String(value || '').slice(0, 10).replaceAll('-', '.');
const ageLabel = (m) => m == null ? '' : m < 24 ? `생후 ${m}개월` : `만 ${Math.floor(m / 12)}세 ${m % 12}개월`;
const isLate = (dose, asOf) => days(dose.recTo, asOf) < 0;
const doseDday = (dose, group, asOf) => group === 'NOW'
  ? (isLate(dose, asOf) ? '지연 전' : ddayLabel(days(dose.recTo, asOf)))
  : ddayLabel(days(dose.recFrom, asOf));

const STATE = {
  DONE: { cls: 'done', label: '맞음' },
  NOW: { cls: 'now', label: '지금 맞을 시기' },
  PAST: { cls: 'past', label: '지난 시기, 확인 필요' },
  SOON: { cls: '', label: '예정' },
  LATER: { cls: '', label: '예정' },
};
const iso = (t) => new Date(t).toISOString().slice(0, 10);
// 과거 날짜 일정이 생기지 않게: recFrom이 asOf보다 미래면 recFrom, 아니면 asOf 다음 날.
const calendarDate = (recFrom, asOf) => days(recFrom, asOf) > 0 ? String(recFrom).slice(0, 10) : iso(utc(asOf) + DAY);

const loadError = (e) => {
  if (e?.code === 'VACCINATION_001') return { message: '아이 생년월일이 등록되어 있지 않아 접종 일정을 계산할 수 없어요. 아이 정보에 생년월일을 등록하면 일정이 표시돼요.', retry: false };
  if (e?.status === 403) return { message: '이 아이의 접종 기록에 접근할 권한이 없어요. 가족 연결 상태를 확인하거나 다른 아이로 전환해 주세요.', retry: false };
  if (e?.code === 'VACCINATION_005' || e?.status === 503) return { message: '예방접종 일정을 지금 불러올 수 없어요. 잠시 후 다시 시도해 주세요.', retry: true };
  return { message: errorMessage(e, '예방접종 일정을 불러오지 못했어요.'), retry: true };
};
const PREVIEW = 3;
const NIP_URL = 'https://nip.kdca.go.kr/irhp/civil/goNonMemView.do';

export function VaccinationScreen({ child, onToast }) {
  const childId = child?.id;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [busyDose, setBusyDose] = useState(null);
  const [open, setOpen] = useState({});
  const [added, setAdded] = useState({}); // doseId -> 추가된 날짜 (이 화면 안에서만 유지)
  const [addingDose, setAddingDose] = useState(null);
  const toggleOpen = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  useEffect(() => {
    if (!childId) return;
    let active = true;
    setLoading(true); setError(null);
    api.vaccinations(childId)
      .then((result) => { if (active) setData(result); })
      .catch((e) => { if (active) { setData(null); setError(e); } })
      .finally(() => { if (active) { setLoading(false); setBusyDose(null); } });
    return () => { active = false; };
  }, [childId, revision]);

  const toggleCheck = async (dose, checked) => {
    if (busyDose) return;
    setBusyDose(dose.doseId);
    try { await (checked ? api.checkVaccination : api.uncheckVaccination)(childId, dose.doseId); }
    catch (e) { onToast(errorMessage(e, '접종 체크를 저장하지 못했어요.')); }
    finally { setRevision((n) => n + 1); }
  };

  const addToCalendar = async (dose) => {
    if (addingDose || added[dose.doseId] || !data?.asOf) return;
    const date = calendarDate(dose.recFrom, data.asOf);
    setAddingDose(dose.doseId);
    try {
      await api.createSchedule({ patientId: childId, title: `${dose.name} ${dose.label} 접종`, scheduleType: 'OTHER', startsAt: new Date(`${date}T09:00:00+09:00`).toISOString() });
      setAdded((a) => ({ ...a, [dose.doseId]: date }));
      onToast(`${dot(date)} 오전 9시 일정으로 캘린더에 추가했어요`);
    } catch (e) { onToast(errorMessage(e, '캘린더에 추가하지 못했어요.')); }
    finally { setAddingDose(null); }
  };

  const hero = <div className="detail-hero"><span className="detail-icon"><Syringe/></span><div><h2>예방접종 관리</h2><p>{child?.name || '아이'}{data?.ageMonths != null ? ` · ${ageLabel(data.ageMonths)}` : ''}</p></div></div>;
  if (!childId) return <div className="page padded detail-page">{hero}<div className="child-required"><h3>아이를 먼저 선택해 주세요</h3><p>아이를 등록하거나 선택하면 접종 일정을 볼 수 있어요.</p></div></div>;
  if (!data) return <div className="page padded detail-page">{hero}
    {loading ? <p className="empty-record" role="status">접종 일정을 불러오는 중이에요.</p>
      : error ? <div className="vax-error" role="alert"><p>{loadError(error).message}</p>{loadError(error).retry && <button className="outline-button" onClick={() => setRevision((n) => n + 1)}>다시 시도</button>}</div>
      : null}
  </div>;

  const asOf = data.asOf;
  const groups = data.groups || {};
  const now = groups.now || [], soon = groups.soon || [], past = groups.past || [];
  const counts = data.counts || {};
  const vaccines = data.vaccines || [];
  const next = data.next;
  // groups의 dose.name(짧은 이름)을 vaccineId별로 모은다. 없으면(예: 체크만 된 BCG) vaccines의 name.
  const shortNames = {};
  [next, ...now, ...soon, ...past].forEach((d) => { if (d?.vaccineId && d.name) shortNames[d.vaccineId] ??= d.name; });
  const vaccineName = (v) => shortNames[v.vaccineId] || v.name;
  const doneDoses = vaccines.flatMap((v) => (v.doses || []).filter((d) => d.state === 'DONE').map((d) => ({ ...d, name: vaccineName(v) })));

  const renderNext = () => {
    if (!next) return <div className="vax-next"><div><small>국가예방접종</small><b>남은 국가예방접종이 없어요</b></div></div>;
    const isNow = next.group === 'NOW';
    const late = isNow && isLate(next, asOf);
    return <div className="vax-next">
      <div><small>{isNow ? '지금 맞을 접종' : '다음 접종'}</small><b>{next.name} {next.label}</b>
        <p>권장 {dot(next.recFrom)} ~ {dot(next.recTo)}</p>
        {late && <p className="vax-late">{dot(next.delayFrom)} 전까지 맞으면 지연이 아니에요</p>}
        {now.length >= 2 && <p>지금 맞을 접종 {now.length - 1}건 더 있어요</p>}
      </div>
      <strong>{doseDday(next, next.group, asOf)}</strong>
    </div>;
  };

  const renderList = (id, title, items, group, emptyText) => {
    const shown = open[id] ? items : items.slice(0, PREVIEW);
    return <section className="vax-section">
      <div className="list-header"><h3>{title}</h3><span className="list-count">{items.length}건</span></div>
      {items.length ? <div className="vax-list">{shown.map((dose) => <div className={`vax-item ${group === 'NOW' ? 'now' : ''}`} key={dose.doseId}>
        <div><b>{dose.name} {dose.label}</b><small>{dot(dose.recFrom)} ~ {dot(dose.recTo)}</small></div>
        <span className="vax-dday">{doseDday(dose, group, asOf)}</span>
        <button className="outline-button compact" type="button" disabled={!!addingDose || !!added[dose.doseId] || !asOf} onClick={() => addToCalendar(dose)}>
          {added[dose.doseId] ? `추가됨 · ${dot(added[dose.doseId]).slice(5)}` : addingDose === dose.doseId ? '추가 중…' : '캘린더에 추가'}
        </button>
      </div>)}</div> : <div className="empty-record">{emptyText}</div>}
      {items.length > PREVIEW && <button className="outline-button" onClick={() => toggleOpen(id)}>{open[id] ? '접기' : `더 보기 (${items.length - PREVIEW}건)`}</button>}
    </section>;
  };

  const renderCheck = (dose, checked) => <label className="vax-check" key={dose.doseId}>
    <input type="checkbox" checked={checked} disabled={!!busyDose} onChange={() => toggleCheck(dose, !checked)}/>
    <span>{dose.name} {dose.label}</span>
    <small>{busyDose === dose.doseId ? '저장 중…' : checked ? '맞음' : `${dot(dose.recFrom)} ~ ${dot(dose.recTo)}`}</small>
  </label>;

  return <div className="page padded detail-page">
    {hero}
    {renderNext()}
    <div className="vax-stats">
      <div><span>만 12세까지 남은 접종</span><b>{counts.remaining ?? '-'}회</b><small>전체 {counts.total ?? '-'}회 중</small></div>
      <div><span>확인이 필요한 지난 접종</span><b>{counts.pastUnchecked ?? '-'}건</b></div>
    </div>

    {renderList('now', '지금 맞을 시기', now, 'NOW', '지금 맞을 접종이 없어요.')}
    {renderList('soon', '곧 맞을 시기', soon, 'SOON', '90일 안에 맞을 접종이 없어요.')}
    {groups.laterCount > 0 && <p className="vax-note">이후 일정 {groups.laterCount}건은 가까워지면 알려드려요.</p>}

    <section className="vax-section">
      <div className="list-header"><h3>백신별 진행</h3></div>
      <p className="vax-legend">
        <span><i className="vax-dot done"/>맞음</span><span><i className="vax-dot now"/>지금 맞을 시기</span>
        <span><i className="vax-dot past"/>지난 시기</span><span><i className="vax-dot"/>예정</span>
      </p>
      {vaccines.length ? <div className="vax-list">{(open.vaccines ? vaccines : vaccines.slice(0, 4)).map((v) => {
        const doses = v.doses || [];
        const done = doses.filter((d) => d.state === 'DONE').length;
        return <div className="vax-vaccine" key={v.vaccineId}>
          <b>{vaccineName(v)}</b>
          <span className="vax-dots">{doses.map((d) => <i key={d.doseId} role="img" className={`vax-dot ${STATE[d.state]?.cls || ''}`} aria-label={`${d.label} ${STATE[d.state]?.label || d.state}`} title={`${d.label} · ${STATE[d.state]?.label || d.state}`}/>)}</span>
          <em>{done}/{doses.length}</em>
        </div>;
      })}</div> : <div className="empty-record">표시할 백신 정보가 없어요.</div>}
      {vaccines.length > 4 && <button className="outline-button" onClick={() => toggleOpen('vaccines')}>{open.vaccines ? '접기' : `더 보기 (${vaccines.length - 4}개)`}</button>}
    </section>

    <details className="vax-past">
      <summary><b>이미 지난 시기</b><span className="list-count">확인 필요 {counts.pastUnchecked ?? past.length}건</span></summary>
      <h4>확인이 필요한 접종</h4>
      {past.length ? past.map((d) => renderCheck(d, false)) : <p className="vax-note">확인이 필요한 지난 접종이 없어요.</p>}
      <h4>맞았다고 체크한 접종</h4>
      {doneDoses.length ? doneDoses.map((d) => renderCheck(d, true)) : <p className="vax-note">아직 체크한 접종이 없어요.</p>}
    </details>

    <a className="outline-button vax-link" href={NIP_URL} target="_blank" rel="noreferrer"><ExternalLink/> 예방접종도우미에서 접종 이력 확인</a>
    <p className="vax-note">질병관리청 표준예방접종일정표(2026.01.02 발행) 기준 안내예요. 실제 접종 이력과 유효 여부는 예방접종도우미 기록이나 의료진에게 확인해 주세요.</p>
  </div>;
}
