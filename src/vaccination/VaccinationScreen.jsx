import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Syringe } from 'lucide-react';
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

// D-day 카드(big·small)와 목록(list)이 같이 쓰는 표시 값. late면 주황색 "권장 기간 지남".
const dueInfo = (dose, group, asOf) => {
  if (group !== 'NOW') { const label = ddayLabel(days(dose.recFrom, asOf)); return { big: label, small: '', list: label, late: false }; }
  if (!isLate(dose, asOf)) {
    const n = days(dose.recTo, asOf);
    if (!Number.isFinite(n)) return { big: '', small: '', list: '', late: false };
    return n === 0
      ? { big: '오늘', small: '권장 기간 마감일', list: '오늘 마감', late: false }
      : { big: `${n}일`, small: '권장 기간 마감까지', list: `마감까지 ${n}일`, late: false };
  }
  const n = days(dose.delayFrom, asOf);
  const left = Number.isFinite(n) && n > 0 ? n : 0; // 0 이하는 AI가 PAST로 보내야 하는 경우라 방어만 한다.
  return { big: left ? `${left}일` : '오늘', small: '이 안에 맞으면 늦지 않아요', list: left ? `권장 기간 지남 · ${left}일 남음` : '권장 기간 지남', late: true };
};

// 동그라미는 세 가지(맞음·맞을 예정·남음)만 그린다.
const STATE = {
  DONE: { cls: 'done', label: '맞음' },
  NOW: { cls: 'now', label: '맞을 예정' },
  PAST: { cls: '', label: '지난 시기, 확인 필요' },
  SOON: { cls: '', label: '예정' },
  LATER: { cls: '', label: '예정' },
};

// 백신 종류. 일본뇌염은 기본 백신이 불활성화라 불활성화로 둔다.
const VACCINE_KIND = {
  BCG: 'LIVE_INJECTED', MMR: 'LIVE_INJECTED', VAR: 'LIVE_INJECTED', RV: 'LIVE_ORAL',
  HEPB: 'INACTIVATED', DTAP: 'INACTIVATED', IPV: 'INACTIVATED', HIB: 'INACTIVATED',
  PCV: 'INACTIVATED', HEPA: 'INACTIVATED', JE: 'INACTIVATED', HPV: 'INACTIVATED',
};
const KIND_GUIDE = {
  LIVE_INJECTED: { label: '생백신', text: '다른 주사용 생백신을 같은 날 맞지 못했다면 4주 뒤에 맞아요.' },
  LIVE_ORAL: { label: '생백신', text: '먹는 백신이에요. 다른 백신과 간격 제한이 없어요.' },
  INACTIVATED: { label: '불활성화 백신', text: '다른 백신과 같은 날 맞거나 따로 맞아도 돼요.' },
};
const SAME_DAY_GUIDE = '대부분의 예방접종은 같은 날 다른 부위에 함께 맞을 수 있어요. 결핵·MMR·수두처럼 주사로 맞는 생백신을 서로 다른 날 맞는다면 최소 4주 간격을 두세요. 불활성화 백신과 먹는 로타 백신은 간격 제한이 없어요. 정확한 일정은 의료진과 상의해 주세요.';

const iso = (t) => new Date(t).toISOString().slice(0, 10);
const kstDate = (instant) => iso(Date.parse(instant) + 9 * 3600000);
// 기본 날짜: recFrom이 asOf보다 미래면 recFrom, 아니면 asOf 다음 날(과거 일정 방지).
const calendarDate = (recFrom, asOf) => days(recFrom, asOf) > 0 ? String(recFrom).slice(0, 10) : iso(utc(asOf) + DAY);
const isDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '');
// 일정 생성 API에 notes가 없어서 제목으로 이미 추가된 접종을 찾는다.
const scheduleTitle = (dose) => `${dose.name} ${dose.label} 접종`;
const SCHEDULE_RANGE_DAYS = 92; // Spring 일정 조회 최대 기간

const loadError = (e) => {
  if (e?.code === 'VACCINATION_001') return { message: '아이 생년월일이 등록되어 있지 않아 접종 일정을 계산할 수 없어요. 아이 정보에 생년월일을 등록하면 일정이 표시돼요.', retry: false };
  if (e?.status === 403) return { message: '이 아이의 접종 기록에 접근할 권한이 없어요. 가족 연결 상태를 확인하거나 다른 아이로 전환해 주세요.', retry: false };
  if (e?.code === 'VACCINATION_005' || e?.status === 503) return { message: '예방접종 일정을 지금 불러올 수 없어요. 잠시 후 다시 시도해 주세요.', retry: true };
  return { message: errorMessage(e, '예방접종 일정을 불러오지 못했어요.'), retry: true };
};
const PREVIEW = 3;
const NIP_URL = 'https://nip.kdca.go.kr/irhp/civil/goNonMemView.do';

export function VaccinationScreen({ child, onToast, onCalendar }) {
  const childId = child?.id;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [busyDose, setBusyDose] = useState(null);
  const [open, setOpen] = useState({});
  const [pastOpen, setPastOpen] = useState(false);
  const pastRef = useRef(null);
  const [added, setAdded] = useState({}); // doseId -> 이 화면에서 추가한 날짜
  const [existing, setExisting] = useState({}); // 일정 제목 -> 이미 있는 일정의 KST 날짜
  const [schedulesReady, setSchedulesReady] = useState(false);
  const [addingDose, setAddingDose] = useState(null);
  const [calendarFor, setCalendarFor] = useState(null); // 날짜 패널이 열린 doseId (한 번에 하나)
  const [pickDate, setPickDate] = useState('');
  const [expanded, setExpanded] = useState(null); // 접종 안내가 펼쳐진 doseId (한 번에 하나)
  const [sameDayOpen, setSameDayOpen] = useState(false);
  const toggleOpen = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const asOf = data?.asOf;
  const busy = !!busyDose || !!addingDose;

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

  // asOf 이후 일정에서 이미 추가된 접종을 찾는다. 실패해도 화면은 그대로, 버튼만 "캘린더에 추가".
  useEffect(() => {
    if (!childId || !asOf) return;
    const from = Date.parse(`${String(asOf).slice(0, 10)}T00:00:00+09:00`);
    if (!Number.isFinite(from)) { setSchedulesReady(true); return; }
    let active = true;
    api.schedules(childId, new Date(from).toISOString(), new Date(from + SCHEDULE_RANGE_DAYS * DAY).toISOString())
      .then((rows) => {
        if (!active) return;
        const map = {};
        (Array.isArray(rows) ? rows : []).forEach((row) => {
          if (!row?.title || row.status === 'CANCELLED' || !Number.isFinite(Date.parse(row.startsAt))) return;
          map[row.title] ??= kstDate(row.startsAt); // 시작 시각 오름차순이라 가장 이른 일정
        });
        setExisting(map);
      })
      .catch(() => {})
      .finally(() => { if (active) setSchedulesReady(true); });
    return () => { active = false; };
  }, [childId, asOf]);

  const addedDate = (dose) => added[dose.doseId] || existing[scheduleTitle(dose)];

  const toggleCheck = async (dose, checked) => {
    if (busyDose || addingDose) return;
    setBusyDose(dose.doseId);
    setCalendarFor(null); // 체크 후 목록에서 빠졌다가 해제로 돌아올 때 낡은 날짜 패널이 다시 열리지 않게
    try { await (checked ? api.checkVaccination : api.uncheckVaccination)(childId, dose.doseId); }
    catch (e) { onToast(errorMessage(e, '접종 체크를 저장하지 못했어요.')); }
    finally { setRevision((n) => n + 1); }
  };

  const openCalendar = (dose) => {
    if (busy || !asOf) return;
    setCalendarFor(dose.doseId);
    setPickDate(calendarDate(dose.recFrom, asOf));
  };

  const addToCalendar = async (dose, date) => {
    if (busyDose || addingDose || addedDate(dose) || !schedulesReady || !asOf) return;
    if (!isDay(date) || days(date, asOf) < 0) return; // 손으로 입력해 min을 우회한 경우
    setAddingDose(dose.doseId);
    try {
      await api.createSchedule({ patientId: childId, title: scheduleTitle(dose), scheduleType: 'OTHER', startsAt: new Date(`${date}T09:00:00+09:00`).toISOString() });
      setAdded((a) => ({ ...a, [dose.doseId]: date }));
      setCalendarFor(null);
      onToast(`${dot(date)} 오전 9시 일정으로 추가했어요. 캘린더 탭에서 볼 수 있어요`);
    } catch (e) { onToast(errorMessage(e, '캘린더에 추가하지 못했어요.')); }
    finally { setAddingDose(null); }
  };

  const openPast = () => {
    setPastOpen(true);
    requestAnimationFrame(() => pastRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const hero = <div className="detail-hero"><span className="detail-icon"><Syringe/></span><div><h2>예방접종 관리</h2><p>{child?.name || '아이'}{data?.ageMonths != null ? ` · ${ageLabel(data.ageMonths)}` : ''}</p></div></div>;
  if (!childId) return <div className="page padded detail-page">{hero}<div className="child-required"><h3>아이를 먼저 선택해 주세요</h3><p>아이를 등록하거나 선택하면 접종 일정을 볼 수 있어요.</p></div></div>;
  if (!data) return <div className="page padded detail-page">{hero}
    {loading ? <p className="empty-record" role="status">접종 일정을 불러오는 중이에요.</p>
      : error ? <div className="vax-error" role="alert"><p>{loadError(error).message}</p>{loadError(error).retry && <button className="outline-button" onClick={() => setRevision((n) => n + 1)}>다시 시도</button>}</div>
      : null}
  </div>;

  const groups = data.groups || {};
  const now = [...(groups.now || [])].sort((a, b) => utc(a.recTo) - utc(b.recTo)); // 급한 항목이 위로
  const soon = groups.soon || [], past = groups.past || [];
  const counts = data.counts || {};
  const vaccines = data.vaccines || [];
  const next = data.next;
  // groups의 dose.name(짧은 이름)을 vaccineId별로 모은다. 없으면(예: 체크만 된 BCG) vaccines의 name.
  const shortNames = {};
  [next, ...now, ...soon, ...past].forEach((d) => { if (d?.vaccineId && d.name) shortNames[d.vaccineId] ??= d.name; });
  const vaccineName = (v) => shortNames[v.vaccineId] || v.name;
  const doneDoses = vaccines.flatMap((v) => (v.doses || []).filter((d) => d.state === 'DONE').map((d) => ({ ...d, name: vaccineName(v) })));
  const ageMonths = data.ageMonths;

  const renderNext = () => {
    if (!next) return <div className="vax-next"><div className="vax-next-left"><div className="vax-next-title"><small>국가예방접종</small><b>남은 국가예방접종이 없어요</b></div></div></div>;
    const isNow = next.group === 'NOW';
    const info = dueInfo(next, next.group, asOf); // big은 목록과 같은 계산을 쓴다
    // 모든 경우 같은 줄 구성: 상태 줄 · 날짜 줄 · 오른쪽 두 줄 설명
    const card = !isNow
      ? { tone: 'soon', status: '곧 시작돼요', date: `${dot(next.recFrom)}부터 맞을 수 있어요`, caption: ['접종 시작', '까지'] }
      : info.late
        ? { tone: 'late', status: '권장 기간 지남', date: `${dot(next.delayFrom)} 전까지 맞아 주세요`, caption: ['안에 맞으면', '늦지 않아요'] }
        : { tone: 'ok', status: '권장 기간이에요', date: `${dot(next.recTo)}까지 맞아 주세요`, caption: ['권장 기간', days(next.recTo, asOf) === 0 ? '마감일' : '마감까지'] };
    return <div className="vax-next">
      <div className="vax-next-left">
        <div className="vax-next-title"><small>{isNow ? '지금 맞을 수 있는 접종' : '다음 접종'}</small><b>{next.name} {next.label}</b></div>
        <div className="vax-next-desc">
          <p className={`vax-status ${card.tone}`}>{card.status}</p>
          <p>{card.date}</p>
          {now.length >= 2 && <p className="vax-more">지금 맞을 수 있는 접종 {now.length - 1}건 더 있어요</p>}
        </div>
      </div>
      <div className="vax-next-count"><strong>{info.big}</strong><small>{card.caption[0]}<br/>{card.caption[1]}</small></div>
    </div>;
  };

  const renderCalendarButton = (dose) => {
    const date = addedDate(dose);
    if (date) return <button className="outline-button compact" type="button" disabled={!onCalendar} onClick={() => onCalendar?.()} aria-label={`${dot(date)}에 추가됨, 캘린더에서 보기`}>추가됨 · {dot(date).slice(5)}</button>;
    return <button className="outline-button compact" type="button" aria-expanded={calendarFor === dose.doseId} disabled={busy || !schedulesReady || !asOf} onClick={() => openCalendar(dose)}>캘린더에 추가</button>;
  };

  const renderCalendarPanel = (dose) => {
    const invalid = !isDay(pickDate) || days(pickDate, asOf) < 0;
    const lateDate = !invalid && dose.delayFrom && days(pickDate, dose.delayFrom) >= 0;
    return <div className="vax-panel">
      <label className="vax-date">캘린더에 넣을 날짜
        <input type="date" min={String(asOf).slice(0, 10)} value={pickDate} onChange={(e) => setPickDate(e.target.value)}/>
      </label>
      <small>오전 9시 일정으로 추가돼요.</small>
      {invalid && <p className="vax-warn">오늘 이후 날짜를 골라 주세요.</p>}
      {lateDate && <p className="vax-warn">권장 기간보다 늦은 날짜예요.</p>}
      <div className="vax-panel-actions">
        <button className="primary-button vax-panel-add" type="button" disabled={busy || invalid} onClick={() => addToCalendar(dose, pickDate)}>{addingDose === dose.doseId ? '추가 중…' : '추가'}</button>
        <button className="outline-button compact" type="button" disabled={addingDose === dose.doseId} onClick={() => setCalendarFor(null)}>취소</button>
      </div>
    </div>;
  };

  const renderGuide = (dose) => {
    const guide = KIND_GUIDE[VACCINE_KIND[dose.vaccineId]];
    return <div className="vax-panel" id={`vax-guide-${dose.doseId}`}>
      <span className="vax-kind">{guide.label}</span>
      <p>{guide.text}</p>
      {dose.vaccineId === 'JE' && <p>계절과 관계없이 일정에 맞춰 연중 접종해요.</p>}
    </div>;
  };

  const renderList = (id, title, items, group, emptyText) => {
    const shown = open[id] ? items : items.slice(0, PREVIEW);
    return <section className="vax-section">
      <div className="list-header"><h3>{title}</h3><span className="list-count">{items.length}건</span></div>
      {group === 'NOW' && items.length >= 2 && <>
        <button className="vax-toggle" type="button" aria-expanded={sameDayOpen} onClick={() => setSameDayOpen((v) => !v)}>여러 접종을 같은 날 맞아도 돼요<ChevronDown/></button>
        {sameDayOpen && <p className="vax-panel">{SAME_DAY_GUIDE}</p>}
      </>}
      {items.length ? <div className="vax-list">{shown.map((dose) => {
        const info = dueInfo(dose, group, asOf);
        const hasGuide = Boolean(KIND_GUIDE[VACCINE_KIND[dose.vaccineId]]);
        const isOpen = expanded === dose.doseId;
        const name = <><b>{dose.name} {dose.label}</b><small>{dot(dose.recFrom)} ~ {dot(dose.recTo)}</small></>;
        return <div className={`vax-item ${group === 'NOW' ? 'now' : ''}`} key={dose.doseId}>
          <div className="vax-item-row">
            {hasGuide
              ? <button type="button" className="vax-item-name" aria-expanded={isOpen} aria-controls={`vax-guide-${dose.doseId}`} onClick={() => setExpanded(isOpen ? null : dose.doseId)}>{name}</button>
              : <div className="vax-item-name">{name}</div>}
            <span className={`vax-dday ${info.late ? 'late' : ''}`}>{info.list}{group !== 'NOW' && <small>{dot(dose.recFrom).slice(5)}부터</small>}</span>
            <span className="vax-item-actions">{renderCalendarButton(dose)}</span>
          </div>
          {isOpen && hasGuide && renderGuide(dose)}
          {calendarFor === dose.doseId && !addedDate(dose) && renderCalendarPanel(dose)}
        </div>;
      })}</div> : <div className="empty-record">{emptyText}</div>}
      {items.length > PREVIEW && <button className="outline-button" onClick={() => toggleOpen(id)}>{open[id] ? '접기' : `더 보기 (${items.length - PREVIEW}건)`}</button>}
    </section>;
  };

  const renderCheck = (dose, checked) => <label className="vax-check" key={dose.doseId}>
    <input type="checkbox" checked={checked} disabled={busy} onChange={() => toggleCheck(dose, !checked)}/>
    <span>{dose.name} {dose.label}</span>
    <small>{busyDose === dose.doseId ? '저장 중…' : checked ? '맞음' : `${dot(dose.recFrom)} ~ ${dot(dose.recTo)}`}</small>
  </label>;

  return <div className="page padded detail-page">
    {hero}
    {(counts.pastUnchecked >= 1 || now.length > 0) && <button className={`vax-past-notice ${counts.pastUnchecked >= 1 ? '' : 'calm'}`} type="button" onClick={openPast}>
      <span>{counts.pastUnchecked >= 1 ? `지난 접종 ${counts.pastUnchecked}건을 확인하면 일정이 더 정확해져요` : "맞은 접종은 '접종 기록 확인'에서 체크해 주세요"}</span><ChevronRight/>
    </button>}
    {renderNext()}
    <div className="vax-stats">
      <div><span>만 12세까지 남은 접종</span><b>{counts.remaining ?? '-'}회</b><small>전체 {counts.total ?? '-'}회 중</small></div>
      <div><span>확인이 필요한 지난 접종</span><b>{counts.pastUnchecked ?? '-'}건</b></div>
    </div>

    {renderList('now', '지금 맞을 수 있어요', now, 'NOW', '지금 맞을 수 있는 접종이 없어요.')}
    {renderList('soon', '곧 시작돼요', soon, 'SOON', '90일 안에 시작되는 접종이 없어요.')}
    {groups.laterCount > 0 && <p className="vax-note">이후 일정 {groups.laterCount}건은 가까워지면 알려드려요.</p>}

    <section className="vax-section">
      <div className="list-header"><h3>백신별 진행</h3></div>
      <p className="vax-legend">
        <span><i className="vax-dot done"/>맞음</span><span><i className="vax-dot now"/>맞을 예정</span><span><i className="vax-dot"/>남음</span>
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

    <details className="vax-past" ref={pastRef} open={pastOpen} onToggle={(e) => setPastOpen(e.currentTarget.open)}>
      <summary><b>접종 기록 확인</b><span className="list-count">확인 필요 {counts.pastUnchecked ?? past.length}건</span></summary>
      <h4>지금 맞을 수 있는 접종</h4>
      {now.length ? now.map((d) => renderCheck(d, false)) : <p className="vax-note">지금 맞을 수 있는 접종이 없어요.</p>}
      <h4>확인이 필요한 지난 접종</h4>
      {past.length ? past.map((d) => renderCheck(d, false)) : <p className="vax-note">확인이 필요한 지난 접종이 없어요.</p>}
      <h4>맞았다고 체크한 접종</h4>
      {doneDoses.length ? doneDoses.map((d) => renderCheck(d, true)) : <p className="vax-note">아직 체크한 접종이 없어요.</p>}
    </details>

    <a className="outline-button vax-link" href={NIP_URL} target="_blank" rel="noreferrer"><ExternalLink/> 예방접종도우미에서 접종 이력 확인</a>
    {ageMonths >= 6 && ageMonths < 156 && <p className="vax-note">인플루엔자는 매년 가을 접종해요. 생후 6개월~만 13세는 국가예방접종으로 무료예요.</p>}
    <p className="vax-note">질병관리청 표준예방접종일정표(2026.01.02 발행) 기준 안내예요. 실제 접종 이력과 유효 여부는 예방접종도우미 기록이나 의료진에게 확인해 주세요.</p>
  </div>;
}
