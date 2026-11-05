import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Gift,
  HeartPulse, Link2, Save, Search, ShieldCheck, Sparkles, X,
} from 'lucide-react';
import './welfare.css';
import { api } from '../api';

const PROGRAMS = [
  { id:'childcare', type:'PROACTIVE', name:'아이돌봄 서비스', agency:'여성가족부', deadline:'상시 신청', score:92, status:'신청 가능성이 높아요', summary:'맞벌이 등 양육 공백이 있는 가정에 아이돌보미가 찾아갑니다.', matches:['만 7세 이하 연령 일치','서울 강서구 이용 가능','맞벌이 가구 조건 일치'], checks:['소득 구간에 따른 본인부담금 확인'], target:'생후 3개월 이상 만 12세 이하 아동 중 양육 공백이 발생한 가정', benefit:'아이돌보미가 가정으로 방문하여 임시보육, 놀이 활동, 등·하원 등을 지원합니다.', documents:'사회보장급여 신청서, 정부지원 자격 증빙서류', method:'복지로 또는 주소지 주민센터에서 신청' },
  { id:'meal', type:'PROACTIVE', name:'아동 급식 지원', agency:'보건복지부', deadline:'지역별 상이', score:84, status:'조건을 확인해 보세요', summary:'결식 우려가 있는 만 18세 미만 아동에게 식사를 지원합니다.', matches:['만 7세 이하 연령 일치','거주지역 서비스 확인'], checks:['소득 및 가구 상황 확인 필요'], target:'보호자의 근로·질병 등으로 결식 우려가 있는 만 18세 미만 아동', benefit:'지역 여건에 따라 급식카드, 도시락 또는 지역아동센터 급식을 지원합니다.', documents:'신청서 및 가구 상황 확인서류', method:'주소지 주민센터에 방문 또는 전화 신청' },
  { id:'care', type:'SUGGESTIVE', name:'시간제 보육 지원', agency:'교육부', deadline:'이용일 전 예약', score:78, status:'대상 가능성이 있어요', summary:'가정양육 중인 영아가 필요한 시간만 어린이집을 이용할 수 있습니다.', matches:['연령 조건 확인','서울 강서구 제공기관 있음'], checks:['어린이집 이용 여부 확인 필요'], target:'어린이집을 이용하지 않고 가정에서 양육 중인 6~36개월 영아', benefit:'지정 어린이집에서 시간 단위 보육 서비스를 이용할 수 있습니다.', documents:'시간제보육 이용신청서, 신분증', method:'아이사랑 포털에서 아동 등록 후 예약' },
  { id:'culture', type:'SUGGESTIVE', name:'유아 문화예술교육 지원', agency:'문화체육관광부', deadline:'기관별 모집', score:70, status:'관심 분야와 잘 맞아요', summary:'유아와 보호자가 함께 참여하는 문화예술 체험 프로그램입니다.', matches:['만 7세 이하 연령 일치','문화·교육 관심사 일치'], checks:['참여기관별 일정 확인'], target:'만 3~7세 유아 및 보호자', benefit:'미술·음악·공연 등 지역 문화시설 연계 체험교육을 제공합니다.', documents:'참여기관 신청서', method:'지역 문화시설 또는 운영기관에서 신청' },
];

const EMPTY_PROFILE = {
  region:'서울특별시 강서구', household:'4', income:'기준중위소득 100% 이하',
  dualIncome:true, multiChild:true, childcare:'가정양육',
};

const readSavedProfile = () => {
  try { return JSON.parse(localStorage.getItem('dodam-welfare-profile')) || null; }
  catch { return null; }
};

export function WelfarePrototype({ child }) {
  const [savedProfile,setSavedProfile] = useState(readSavedProfile);
  const [sessionProfile,setSessionProfile] = useState(null);
  const [draft,setDraft] = useState(savedProfile || EMPTY_PROFILE);
  const [profileOpen,setProfileOpen] = useState(false);
  const [confirmOpen,setConfirmOpen] = useState(false);
  const [selected,setSelected] = useState(null);
  const [query,setQuery] = useState('');
  const [favorites,setFavorites] = useState([]);
  const [remotePrograms,setRemotePrograms] = useState(null);
  const [mode,setMode] = useState('PROACTIVE');
  const [sort,setSort] = useState('추천순');
  const profile = savedProfile || sessionProfile;
  const persistent = Boolean(savedProfile);
  const childName = child?.fullName || child?.name || '도윤이';

  useEffect(() => {
    if (!child?.id || String(child.id).startsWith('demo-')) return;
    api.welfareProfile(child.id).then((remote) => {
      if (!remote?.storageConsent) return;
      const next = {
        region: remote.regionCode || EMPTY_PROFILE.region,
        household: String(remote.householdSize || EMPTY_PROFILE.household),
        income: remote.incomeBand || EMPTY_PROFILE.income,
        dualIncome: Boolean(remote.dualIncome),
        multiChild: Number(remote.childCount || 1) > 1,
        childcare: remote.childcareStatus || EMPTY_PROFILE.childcare,
      };
      setSavedProfile(next); setDraft(next);
    }).catch(() => {});
  }, [child?.id]);

  useEffect(() => {
    if (!child?.id || String(child.id).startsWith('demo-')) return;
    api.welfareRecommendations(child.id, mode).then((result) => {
      const items = (result?.items || []).map((item) => ({
        id: item.programId, type: mode, name: item.name, agency: '공공서비스',
        deadline: '상세 확인', score: Math.round(item.score),
        status: item.status === 'ELIGIBLE' ? '신청 가능성이 높아요' : '조건을 확인해 보세요',
        summary: '행정안전부 공공서비스 정보에서 제공하는 복지 서비스입니다.',
        matches: ['아이 연령·프로필 기준 추천'], checks: ['신청기관의 최종 자격 확인'],
        target: '공식 상세 페이지에서 지원대상을 확인해 주세요.', benefit: '지원내용은 공공서비스 상세정보를 확인해 주세요.',
        documents: '서비스별 구비서류 확인', method: '공식 신청 페이지 또는 주민센터 신청',
      }));
      if (items.length) setRemotePrograms(items);
    }).catch(() => {});
  }, [child?.id, mode]);

  const visible = useMemo(() => (remotePrograms || PROGRAMS)
    .filter(item => (!persistent || item.type === mode) && `${item.name} ${item.summary} ${item.agency}`.includes(query.trim()))
    .sort((a,b) => sort === '추천순' ? b.score-a.score : a.name.localeCompare(b.name,'ko')),
  [mode,persistent,query,sort,remotePrograms]);

  const saveProfile = async () => {
    if (child?.id && !String(child.id).startsWith('demo-')) {
      try {
        await api.saveWelfareProfile(child.id, {
          regionCode: draft.region, householdSize: Number.parseInt(draft.household, 10) || null,
          incomeBand: draft.income, childCount: draft.multiChild ? 2 : 1,
          dualIncome: draft.dualIncome, childcareStatus: draft.childcare,
          storageConsent: true, healthDataConsent: false,
        });
      } catch { /* local fallback keeps the prototype usable while the API is unavailable */ }
    }
    localStorage.setItem('dodam-welfare-profile', JSON.stringify(draft));
    setSavedProfile(draft); setSessionProfile(null); setConfirmOpen(false); setProfileOpen(false);
  };
  const useOnce = () => {
    setSessionProfile(draft); setSavedProfile(null); setMode('SUGGESTIVE');
    localStorage.removeItem('dodam-welfare-profile'); setConfirmOpen(false); setProfileOpen(false);
  };
  const removeProfile = () => {
    localStorage.removeItem('dodam-welfare-profile'); setSavedProfile(null); setSessionProfile(null);
    setDraft(EMPTY_PROFILE); setProfileOpen(false);
  };
  const toggleFavorite = id => {
    const exists = favorites.includes(id);
    setFavorites(items => exists ? items.filter(v=>v!==id) : [...items,id]);
    if (child?.id && !String(child.id).startsWith('demo-')) {
      const call = exists ? api.removeWelfareFavorite(child.id, id) : api.addWelfareFavorite(child.id, id);
      call.catch(() => {});
    }
  };

  if (selected) return <div className="page padded welfare-page welfare-detail-view">
    <button className="welfare-back" onClick={()=>setSelected(null)}><ChevronLeft/> 추천 목록</button>
    <div className="welfare-detail-title"><div><span>{selected.agency}</span><h2>{selected.name}</h2><p>{selected.summary}</p></div><button className={favorites.includes(selected.id)?'saved':''} onClick={()=>toggleFavorite(selected.id)} aria-label="관심 서비스 저장"><HeartPulse/></button></div>
    <div className="eligibility-summary"><Sparkles/><div><b>현재 입력한 정보 기준 {selected.score}% 일치</b><p>자격을 확정하는 결과가 아니며, 신청기관의 최종 확인이 필요해요.</p></div></div>
    <section className="welfare-info-card"><h3>도담이가 추천한 이유</h3>{selected.matches.map(v=><p className="match-line" key={v}><CheckCircle2/> {v}</p>)}{selected.checks.map(v=><p className="check-line" key={v}><Clock3/> 추가 확인: {v}</p>)}</section>
    {[['지원대상',selected.target],['지원내용',selected.benefit],['신청방법',selected.method],['준비서류',selected.documents],['신청기한',selected.deadline]].map(([title,body])=><section className="welfare-copy-block" key={title}><h3>{title}</h3><p>{body}</p></section>)}
    <button className="primary-button welfare-apply" onClick={()=>window.alert('프로토타입: 실제 서비스에서는 정부24 공식 신청 페이지로 이동합니다.')}><Link2/> 공식 사이트에서 확인하기</button>
    <p className="source-note"><ShieldCheck/> 행정안전부 대한민국 공공서비스 정보 · 프로토타입 예시 · 2026.11.05 기준</p>
  </div>;

  return <div className="page padded detail-page welfare-page">
    <div className="welfare-hero"><div><span className="eyebrow">WELFARE FOR FAMILY</span><h2>{childName}에게 맞는<br/><strong>복지혜택</strong>을 찾았어요</h2><p>출생부터 만 7세까지, 놓치기 쉬운 혜택을 모아드려요.</p></div><span className="welfare-hero-icon"><Gift/></span></div>
    <button className="welfare-child-card"><span className="child-face">{child?.emoji || '👶🏻'}</span><span><b>{childName}</b><small>{child?.age || '생후 18개월'} · {profile?.region || '거주지역 미입력'}</small></span><ChevronRight/></button>
    <section className="profile-progress-card"><div className="profile-progress-head"><div><span>{profile ? persistent ? '저장된 맞춤정보' : '이번 추천에만 적용 중' : '맞춤정보를 입력해 주세요'}</span><b>{profile?'100':'25'}%</b></div><button onClick={()=>{setDraft(profile || EMPTY_PROFILE);setProfileOpen(true)}}>{profile?'수정하기':'입력하기'} <ChevronRight/></button></div><div className="profile-progress"><i style={{width:profile?'100%':'25%'}}/></div><p>{persistent?'저장된 정보를 자동으로 적용해 추천했어요.':sessionProfile?'화면을 벗어나면 입력정보를 폐기해요.':'지역과 가구정보를 입력하면 추천이 더 정확해져요.'}</p></section>

    {persistent && <><div className="recommendation-mode-tabs"><button className={mode==='PROACTIVE'?'active':''} onClick={()=>setMode('PROACTIVE')}><Bell/>선제형 추천</button><button className={mode==='SUGGESTIVE'?'active':''} onClick={()=>setMode('SUGGESTIVE')}><Sparkles/>제안형 추천</button></div><div className={`recommendation-mode-note ${mode.toLowerCase()}`}><b>{mode==='PROACTIVE'?'지금 확인하면 좋은 혜택이에요':'이런 혜택도 잘 맞아요'}</b><p>{mode==='PROACTIVE'?'신규 정책, 조건 변경, 신청 마감일을 확인해 먼저 알려드려요.':'저장된 가족정보와 관심사를 분석해 놓치기 쉬운 혜택을 제안해요.'}</p></div></>}
    <label className="welfare-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="지원금, 돌봄, 교육 혜택 검색"/></label>
    <div className="welfare-summary-row"><div><b>{visible.length}</b><span>맞춤 추천</span></div><div><b>{visible.filter(v=>v.score>=80).length}</b><span>가능성 높음</span></div><div><b>{favorites.length}</b><span>관심 혜택</span></div></div>
    <div className="welfare-list-head"><div><Sparkles/><b>{childName} 맞춤 추천</b></div><select value={sort} onChange={e=>setSort(e.target.value)}><option>추천순</option><option>이름순</option></select></div>
    <div className="welfare-program-list">{visible.map(item=><article key={item.id} className="welfare-program-card"><div className="program-top"><span className={item.score>=85?'high':'possible'}>{item.status}</span><button className={favorites.includes(item.id)?'saved':''} onClick={()=>toggleFavorite(item.id)} aria-label="관심 저장"><HeartPulse/></button></div><h3>{item.name}</h3><p>{item.summary}</p><div className="score-row"><span><i style={{width:`${item.score}%`}}/></span><b>{item.score}%</b></div><div className="program-tags">{item.matches.slice(0,2).map(v=><span key={v}><CheckCircle2/>{v}</span>)}</div><div className="program-meta"><span>{item.agency}</span><span><Clock3/>{item.deadline}</span></div><button className="program-detail-button" onClick={()=>setSelected(item)}>추천 이유와 상세보기 <ChevronRight/></button></article>)}</div>
    {!visible.length && <div className="welfare-empty"><Search/><b>검색 결과가 없어요</b><p>다른 검색어로 찾아보세요.</p></div>}
    <p className="source-note"><ShieldCheck/> 행정안전부 대한민국 공공서비스 정보를 기반으로 구성한 프로토타입입니다.</p>

    {profileOpen && <div className="modal-backdrop" onMouseDown={()=>setProfileOpen(false)}><div className="sheet welfare-profile-sheet" onMouseDown={e=>e.stopPropagation()}><div className="sheet-handle"/><button className="sheet-close" onClick={()=>setProfileOpen(false)}><X/></button><div className="sheet-heading"><Gift/><div><h3>복지 맞춤정보</h3><p>출생~만 7세 혜택 추천에만 사용해요.</p></div></div>
      <label>거주지역<span>지역별 서비스를 찾는 데 필요해요</span><select value={draft.region} onChange={e=>setDraft({...draft,region:e.target.value})}><option>서울특별시 강서구</option><option>서울특별시 마포구</option><option>경기도 고양시</option></select></label>
      <div className="welfare-form-row"><label>가구원 수<select value={draft.household} onChange={e=>setDraft({...draft,household:e.target.value})}><option>2</option><option>3</option><option>4</option><option>5명 이상</option></select></label><label>소득 구간<select value={draft.income} onChange={e=>setDraft({...draft,income:e.target.value})}><option>선택하지 않음</option><option>기준중위소득 80% 이하</option><option>기준중위소득 100% 이하</option><option>기준중위소득 150% 이하</option></select></label></div>
      <label>현재 양육 형태<select value={draft.childcare} onChange={e=>setDraft({...draft,childcare:e.target.value})}><option>가정양육</option><option>어린이집 이용</option><option>유치원 이용</option></select></label>
      <div className="welfare-checks"><label><input type="checkbox" checked={draft.dualIncome} onChange={e=>setDraft({...draft,dualIncome:e.target.checked})}/><span>맞벌이 가구</span></label><label><input type="checkbox" checked={draft.multiChild} onChange={e=>setDraft({...draft,multiChild:e.target.checked})}/><span>다자녀 가구</span></label></div>
      <p className="privacy-help"><ShieldCheck/> 민감한 정보는 선택사항이며, 저장하기 전 다시 확인해 드려요.</p>{persistent&&<button className="welfare-delete-profile" onClick={removeProfile}>저장된 맞춤정보 삭제</button>}<button className="primary-button" onClick={()=>setConfirmOpen(true)}><Sparkles/> 이 정보로 추천받기</button>
    </div></div>}
    {confirmOpen && <div className="modal-backdrop confirm-layer"><div className="welfare-confirm"><span><Save/></span><h3>입력한 정보를 저장할까요?</h3><p>저장하면 다음에도 맞춤 추천에 자동으로 사용해요. 저장하지 않아도 지금 한 번은 추천받을 수 있어요.</p><div className="confirm-data"><b>{draft.region}</b><span>가구원 {draft.household}명 · {draft.income}</span></div><button className="primary-button" onClick={saveProfile}>저장하고 맞춤 추천</button><button className="outline-button" onClick={useOnce}>저장하지 않고 이번만 사용</button><button className="text-button" onClick={()=>setConfirmOpen(false)}>다시 확인하기</button></div></div>}
  </div>;
}
