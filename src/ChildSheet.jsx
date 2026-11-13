import React, { useRef, useState } from 'react';
import { ChevronRight, CheckCircle2, UserRoundPlus, Link2, UsersRound } from 'lucide-react';
import { api, errorMessage } from './api';
import ProfileEditSheet from './ProfileEditSheet';

const seoulDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });

export default function ChildSheet({ active, children: childrenProp, backendOnline, onSelect, onClose, onToast, onCreated, editing = false }) {
  const children = childrenProp || [];
  const [mode, setMode] = useState(editing ? 'edit' : children.length ? 'list' : 'create');
  const [name, setName] = useState(editing ? active?.name || active?.fullName || '' : '');
  const [birthDate, setBirthDate] = useState(editing ? active?.birthDate || '' : '');
  const [gender, setGender] = useState(editing ? active?.gender || '' : '');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const today = seoulDate.format(new Date());
  const [year, month, day] = today.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year - 19, month, 0)).getUTCDate();
  const oldest = new Date(Date.UTC(year - 19, month - 1, Math.min(day, lastDay))).toISOString().slice(0, 10);
  const changeMode = (next) => { setError(''); setMode(next); };
  const close = () => { if (!pending.current) onClose(); };
  const submit = async (event) => {
    event.preventDefault();
    if (pending.current) return;
    setError('');
    if (!backendOnline) { setError('서버에 연결한 뒤 다시 시도해 주세요. 입력한 내용은 유지돼요.'); return; }
    if (mode !== 'join' && (!name.trim() || !birthDate)) {
      setError('아이 이름과 생년월일을 입력해 주세요.'); return;
    }
    if (mode !== 'join' && (birthDate < oldest || birthDate > today)) {
      setError(birthDate > today ? '생년월일은 오늘까지 선택할 수 있어요.' : '등록 가능한 생년월일 범위를 확인해 주세요.');
      return;
    }
    pending.current = true;
    setBusy(true);
    let saved;
    try {
      if (mode === 'edit') {
        saved = await api.updateChild(active.id, { name: name.trim(), birthDate, gender: gender || null });
      } else if (mode === 'create') {
        saved = await api.createChild({ name: name.trim(), birthDate, gender: gender || null });
      } else {
        saved = await api.joinChild(inviteCode.trim().toUpperCase());
      }
    } catch (failure) {
      setError(errorMessage(failure, '저장하지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요.'));
      pending.current = false; setBusy(false); return;
    }
    // The write succeeded: a refresh failure must not invite duplicate registration.
    let refreshed = true;
    try { await onCreated?.(saved?.id); }
    catch { refreshed = false; }
    pending.current = false; setBusy(false);
    onToast(!refreshed ? '저장은 완료됐어요. 목록을 보려면 화면을 새로고침해 주세요.' : mode === 'edit' ? '아이 정보를 수정했어요.' : mode === 'create' ? '아이를 등록했어요.' : '가족의 아이 기록에 연결했어요.');
    onClose();
  };

  const title = mode === 'edit' ? '아이 정보 수정' : mode === 'create' ? '아이 등록' : mode === 'join' ? '가족 기록 연결' : '아이 선택';
  const description = mode === 'edit' ? '이름과 생년월일, 성별을 수정할 수 있어요.' : mode === 'create' ? '아이의 기본 정보를 알려주세요.' : mode === 'join' ? '가족에게 받은 공유 코드로 함께 돌봐요.' : '건강 기록을 확인할 아이를 선택해 주세요.';
  return <ProfileEditSheet title={title} description={description} icon={UsersRound} pending={pending} onClose={onClose}>
      {mode === 'list' ? <>
        <div className="child-list">{children.map(child => <button key={child.id} onClick={() => onSelect(child)} className={active?.id === child.id ? 'selected' : ''}>
          <span className="child-face">{child.emoji || '👶🏻'}</span><span><b>{child.fullName || child.name}</b><small>{child.age}{child.gender === 'MALE' ? ' · 남아' : child.gender === 'FEMALE' ? ' · 여아' : ''}</small></span>{active?.id === child.id ? <CheckCircle2/> : <ChevronRight/>}
        </button>)}</div>
        <div className="child-sheet-options"><button onClick={() => changeMode('create')}><UserRoundPlus size={20}/> 새 아이 등록 <ChevronRight size={18}/></button><button onClick={() => changeMode('join')}><Link2 size={20}/> 가족 공유 코드로 연결 <ChevronRight size={18}/></button></div>
      </> : <>
        {mode !== 'edit' && <div className="child-mode-switch" aria-label="아이 연결 방법">
          <button type="button" disabled={busy} aria-pressed={mode === 'create'} onClick={() => changeMode('create')}><UserRoundPlus size={18}/>새 아이 등록</button>
          <button type="button" disabled={busy} aria-pressed={mode === 'join'} onClick={() => changeMode('join')}><Link2 size={18}/>가족 코드 연결</button>
        </div>}
        <form className="child-profile-form" onSubmit={submit}>
        <fieldset disabled={busy} className="child-profile-fields">
          {mode !== 'join' ? <>
            <label htmlFor="child-name">아이 이름 <span>필수</span></label>
            <input id="child-name" autoComplete="off" placeholder="예: 박도윤" value={name} maxLength={100} required onChange={e => setName(e.target.value)}/>
            <label htmlFor="child-birthdate">생년월일 <span>필수</span></label>
            <p id="child-birthdate-help" className="child-field-help">아이가 태어난 날짜를 선택해 주세요.</p>
            <input id="child-birthdate" type="date" aria-describedby="child-birthdate-help" value={birthDate} min={oldest} max={today} required onChange={e => setBirthDate(e.target.value)}/>
            <fieldset className="child-gender"><legend>성별 <span>선택</span></legend><div>
              {[['MALE', '남아'], ['FEMALE', '여아'], ...((mode === 'edit' && active?.gender) ? [] : [['', '나중에 선택']])].map(([value, label]) => <label key={label} className={gender === value ? 'selected' : ''}><input type="radio" name="child-gender" value={value} checked={gender === value} onChange={() => setGender(value)}/>{label}</label>)}
            </div></fieldset>
          </> : <>
            <label htmlFor="child-invite">가족 공유 코드 <span>필수</span></label>
            <p className="child-field-help" id="child-invite-help">이미 아이를 등록한 가족에게 공유 코드를 받아 입력해 주세요.</p>
            <input id="child-invite" aria-describedby="child-invite-help" placeholder="공유 코드 8자리" autoCapitalize="characters" autoComplete="off" value={inviteCode} maxLength={16} required onChange={e => setInviteCode(e.target.value.toUpperCase())}/>
          </>}
        </fieldset>
        {error && <p role="alert" className="child-form-error">{error}</p>}
        <div className="child-form-actions"><button type="button" disabled={busy} onClick={() => mode === 'edit' ? close() : children.length ? changeMode('list') : close()}>취소</button><button type="submit" disabled={busy} className="child-save">{busy ? '저장 중…' : mode === 'edit' ? '변경사항 저장' : mode === 'create' ? '아이 등록' : '가족 기록 연결'}</button></div>
      </form></>}
  </ProfileEditSheet>;
}
