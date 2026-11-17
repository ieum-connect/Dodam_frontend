import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Gift, Heart, Link2, Save, Search, ShieldCheck, Sparkles, X } from 'lucide-react';
import './welfare.css';
import { api, errorMessage } from '../api';
import { useBackLayer } from '../backNavigation';

const EMPTY_PROFILE = { region:'', regionCode:'', household:'', income:'', childcare:'', childCount:'', dualIncome:false, singleParent:false, multicultural:false, disability:false };
const isRegionCode = value => /^\d{10}$/.test(String(value||''));
const profileFromApi = p => ({ region:p.regionName||(isRegionCode(p.regionCode)?'':p.regionCode||''), regionCode:isRegionCode(p.regionCode)?p.regionCode:'', household:p.householdSize==null?'':String(p.householdSize), income:p.incomeBand||'', childcare:p.childcareStatus||'', childCount:p.childCount==null?'':String(p.childCount), dualIncome:Boolean(p.dualIncome), singleParent:Boolean(p.singleParent), multicultural:Boolean(p.multicultural), disability:Boolean(p.disability) });
const programFromApi = p => ({ id:p.id, name:p.name, agency:p.agencyName, deadline:p.applicationDeadline, summary:p.purposeSummary||p.purposeDetail, target:p.target||p.selectionCriteria, benefit:p.benefit, documents:p.requiredDocuments, method:p.applicationMethod, applicationUrl:p.onlineApplicationUrl||p.detailUrl, modifiedAtSource:p.modifiedAtSource });
const recommendationFromApi = item => ({ id:item.programId, name:item.name, summary:item.summary, agency:item.agencyName,
  deadline:item.applicationDeadline, score:item.score, status:item.status, regionScope:item.regionScope, regionLabel:item.regionLabel,
  matchedConditions:item.matchedConditions||[], missingConditions:item.missingConditions||[], conditions:item.conditions||[] });
const statusLabel = status => status==='ELIGIBLE'?'조건 충족':'추가 확인 필요';
const CONDITION_STATUS = { MET:{ label:'충족', className:'met' }, UNMET:{ label:'미충족', className:'unmet' }, UNKNOWN:{ label:'확인 필요', className:'unknown' } };
const regionScopeLabel = (scope, label) => scope==='NATIONAL'?'전국':(label||'');
const formatWelfareText = value => String(value||'').replace(/\s+(?=[○※])/g,'\n').replace(/\s+-\s+(?=[가-힣0-9])/g,'\n- ');
const WelfareSelect=({value,onChange,disabled,options,placeholder='선택해 주세요',ariaLabel,compact=false})=>{
  const [open,setOpen]=useState(false); const root=useRef(null); const selectId=useRef(crypto.randomUUID());
  useEffect(()=>{
    const close=e=>{if(!root.current?.contains(e.target))setOpen(false)};
    const closeSibling=e=>{if(e.detail!==selectId.current)setOpen(false)};
    document.addEventListener('pointerdown',close);
    document.addEventListener('welfare-select-open',closeSibling);
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('welfare-select-open',closeSibling)};
  },[]);
  const selected=options.find(option=>String(option.value)===String(value));
  return <span ref={root} className={`welfare-select${disabled?' disabled':''}${open?' open':''}${compact?' compact':''}`}>
    <button type="button" className="welfare-select-trigger" disabled={disabled} aria-label={ariaLabel} aria-expanded={open} onClick={()=>setOpen(current=>{const next=!current;if(next)document.dispatchEvent(new CustomEvent('welfare-select-open',{detail:selectId.current}));return next})}><span>{selected?.label||placeholder}</span><ChevronDown/></button>
    {open&&<span className="welfare-select-menu" role="listbox">{options.map(option=><button type="button" role="option" aria-selected={String(option.value)===String(value)} className={String(option.value)===String(value)?'selected':''} key={option.value||'empty'} onClick={event=>{event.stopPropagation();setOpen(false);onChange(option.value)}}><span>{option.label}</span>{String(option.value)===String(value)&&<Check/>}</button>)}</span>}
  </span>;
};
const useSheetDrag = onClose => {
  const sheetRef=useRef(null), dragRef=useRef(null);
  const onPointerDown=e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    dragRef.current={startY:e.clientY,lastY:e.clientY,startTime:performance.now()};
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const sheet=sheetRef.current;if(sheet){sheet.style.transition='none';sheet.classList.add('dragging')}
  };
  const onPointerMove=e=>{
    if(!dragRef.current||!sheetRef.current)return;
    dragRef.current.lastY=e.clientY;
    const distance=Math.max(0,e.clientY-dragRef.current.startY);
    sheetRef.current.style.transform=`translateY(${distance}px)`;
  };
  const onPointerEnd=()=>{
    const drag=dragRef.current, sheet=sheetRef.current;if(!drag||!sheet)return;
    const distance=Math.max(0,drag.lastY-drag.startY), elapsed=Math.max(performance.now()-drag.startTime,1), velocity=distance/elapsed;
    dragRef.current=null;sheet.classList.remove('dragging');sheet.style.transition='transform .22s ease';
    if(distance>110||velocity>.65){sheet.style.transform='translateY(105%)';window.setTimeout(onClose,180)}
    else{sheet.style.transform='translateY(0)';window.setTimeout(()=>{if(sheet)sheet.style.transition=''},220)}
  };
  const onKeyDown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onClose()}};
  return {sheetRef,handleProps:{onPointerDown,onPointerMove,onPointerUp:onPointerEnd,onPointerCancel:onPointerEnd,onKeyDown}};
};
const ageLabel = value => {
  if (!value) return '';
  const birth = new Date(`${value}T00:00:00`); const now = new Date();
  if (Number.isNaN(birth.getTime())) return '';
  let months=(now.getFullYear()-birth.getFullYear())*12+now.getMonth()-birth.getMonth();
  if(now.getDate()<birth.getDate()) months--;
  return months<24?`생후 ${Math.max(months,0)}개월`:`만 ${Math.floor(months/12)}세`;
};

export function WelfarePrototype({ child, onChildOpen, onBackChange }) {
  const [profile,setProfile]=useState(null), [draft,setDraft]=useState(EMPTY_PROFILE);
  const [profileOpen,setProfileOpen]=useState(false), [confirmOpen,setConfirmOpen]=useState(false), [selected,setSelected]=useState(null);
  const [recommendations,setRecommendations]=useState([]), [favorites,setFavorites]=useState([]);
  const [childContext,setChildContext]=useState(null), [excludedCount,setExcludedCount]=useState(0), [detail,setDetail]=useState(null);
  const [incomeBands,setIncomeBands]=useState([]), [childcareOptions,setChildcareOptions]=useState([]);
  const [provinces,setProvinces]=useState([]), [districts,setDistricts]=useState([]), [neighborhoods,setNeighborhoods]=useState([]);
  const [provinceCode,setProvinceCode]=useState(''), [districtCode,setDistrictCode]=useState(''), [neighborhoodCode,setNeighborhoodCode]=useState('');
  const [incomeGuide,setIncomeGuide]=useState(null), [monthlyIncome,setMonthlyIncome]=useState('');
  const [query,setQuery]=useState(''), [favoritesOnly,setFavoritesOnly]=useState(false);
  const [loading,setLoading]=useState(true), [saving,setSaving]=useState(false), [error,setError]=useState(''), [explanation,setExplanation]=useState(null), [revision,setRevision]=useState(0);
  const explanationCache=useRef(new Map());
  const childId=child?.id, childName=child?.name||child?.fullName||'', childAge=ageLabel(child?.birthDate);

  useEffect(()=>{api.welfareProfileOptions().then(result=>{setIncomeBands(result?.incomeBands||[]);setChildcareOptions(result?.childcareOptions||[]);setIncomeGuide(result?.incomeGuide||null)}).catch(e=>setError(errorMessage(e,'복지 입력 선택지를 불러오지 못했어요.')));api.welfareRegions().then(result=>setProvinces(result?.items||[])).catch(e=>setError(errorMessage(e,'행정구역을 불러오지 못했어요.')));},[]);
  useEffect(()=>{ if(!childId)return; api.welfareProfile(childId).then(remote=>{if(remote?.storageConsent){const next=profileFromApi(remote);setProfile(next);setDraft(next)}}).catch(()=>{setProfile(null);setDraft(EMPTY_PROFILE)}); api.welfareFavorites(childId).then(setFavorites).catch(()=>setFavorites([])); },[childId,revision]);
  useEffect(()=>{ if(!childId){setRecommendations([]);setChildContext(null);setExcludedCount(0);setLoading(false);return} let active=true; setLoading(true);setError('');
    api.welfareRecommendations(childId,'SUGGESTIVE').then(result=>{ if(!active)return; setRecommendations((result?.items||[]).map(recommendationFromApi)); setChildContext(result?.child||null); setExcludedCount(result?.excludedCount||0); })
      .catch(e=>{ if(!active)return; setRecommendations([]);setChildContext(null);setError(errorMessage(e,'맞춤 추천을 불러오지 못했어요.')) }).finally(()=>active&&setLoading(false)); return()=>{active=false}; },[childId,revision]);
  useEffect(()=>{onBackChange?.(selected?()=>()=>setSelected(null):()=>null);return()=>onBackChange?.(()=>null)},[selected,onBackChange]);
  useBackLayer(profileOpen,()=>setProfileOpen(false));
  useBackLayer(confirmOpen,()=>setConfirmOpen(false));
  const {sheetRef,handleProps}=useSheetDrag(()=>setProfileOpen(false));
  const visible=useMemo(()=>recommendations.filter(item=>(!favoritesOnly||favorites.includes(item.id))&&`${item.name||''} ${item.summary||''} ${item.agency||''}`.includes(query.trim())),[recommendations,query,favoritesOnly,favorites]);

  useEffect(()=>{ if(!selected){setDetail(null);return} let active=true; setDetail(null);
    api.welfareProgram(selected.id).then(row=>active&&setDetail(programFromApi(row))).catch(e=>{if(!active)return;setDetail({});setError(errorMessage(e,'복지 서비스 상세를 불러오지 못했어요.'))}); return()=>{active=false}; },[selected]);
  useEffect(()=>{if(!selected){setExplanation(null);return}if(!detail){setExplanation({loading:true});return}const cacheKey=`${selected.id}|${revision}`;const cached=explanationCache.current.get(cacheKey);if(cached){setExplanation(cached);return}setExplanation({loading:true});
    api.welfareAiExplain(childId, {
      program:{program_id:selected.id,name:selected.name,purpose_summary:selected.summary,agency_name:selected.agency,
        target:detail?.target,benefit:detail?.benefit,application_method:detail?.method,required_documents:detail?.documents},
      recommendation:{program_id:selected.id,name:selected.name,score:selected.score,status:selected.status,
        region_scope:selected.regionScope,region_label:selected.regionLabel,
        matched_conditions:selected.matchedConditions,missing_conditions:selected.missingConditions,
        conditions:selected.conditions.map(c=>({key:c.key,label:c.label,status:c.status,weight:c.weight,message:c.message}))},
      child:childContext?{child_name:childContext.childName,age_label:childContext.ageLabel,age_months:childContext.ageMonths,
        region_label:childContext.regionLabel,income_band_label:childContext.incomeBandLabel,household_size:childContext.householdSize,
        child_count:childContext.childCount,dual_income:childContext.dualIncome,single_parent:childContext.singleParent,
        multicultural:childContext.multicultural,disability:childContext.disability,childcare_status:childContext.childcareStatus,
        profile_saved:childContext.profileSaved}:null,
      evidence:selected.matchedConditions,
    }, childId).then(result=>{explanationCache.current.set(cacheKey,result);setExplanation(result)}).catch(e=>setExplanation({error:errorMessage(e)}));},[selected,detail,childContext,revision,childId]);
  const calculateIncomeBand=()=>{const size=Number(draft.household), income=Number(monthlyIncome);if(!incomeGuide||!size||!income)return;const values=incomeGuide.medianMonthlyIncomeByHouseholdSize||[];const base=size<=values.length?values[size-1]:values.at(-1)+(size-values.length)*(values.at(-1)-values.at(-2));const percent=income/base*100;const option=incomeBands.find(item=>item.maximumPercent!=null&&percent<=item.maximumPercent)||incomeBands.find(item=>item.maximumPercent==null);if(option)setDraft({...draft,income:option.value})};
  const openProfile=async()=>{
    const next=profile||EMPTY_PROFILE; setDraft(next); setProfileOpen(true);
    const code=next.regionCode||''; if(!isRegionCode(code)){setProvinceCode('');setDistrictCode('');setNeighborhoodCode('');setDistricts([]);setNeighborhoods([]);return}
    const province=`${code.slice(0,2)}00000000`, district=`${code.slice(0,5)}00000`;
    setProvinceCode(province); setDistrictCode('');setNeighborhoodCode('');setDistricts([]);setNeighborhoods([]);
    try{
      const districtResult=await api.welfareRegions('DISTRICT',province); setDistricts(districtResult?.items||[]);
      if(code.slice(2,5)==='000')return;
      setDistrictCode(district);
      const neighborhoodResult=await api.welfareRegions('NEIGHBORHOOD',district); setNeighborhoods(neighborhoodResult?.items||[]);
      if(code.slice(5,8)!=='000')setNeighborhoodCode(code);
    }catch(e){setError(errorMessage(e,'행정구역을 불러오지 못했어요.'))}
  };
  const selectProvince=async code=>{setProvinceCode(code);setDistrictCode('');setNeighborhoodCode('');setDistricts([]);setNeighborhoods([]);const selectedOption=provinces.find(v=>v.code===code);setDraft(current=>({...current,region:selectedOption?.name||'',regionCode:code||''}));if(code){const result=await api.welfareRegions('DISTRICT',code);const items=result?.items||[];setDistricts(items);if(items.length===1&&items[0].code===code){setDistrictCode(code);const neighborhoodsResult=await api.welfareRegions('NEIGHBORHOOD',code);setNeighborhoods(neighborhoodsResult?.items||[])}}};
  const selectDistrict=async code=>{
    setDistrictCode(code);setNeighborhoodCode('');setNeighborhoods([]);
    const selectedOption=districts.find(v=>v.code===code);
    setDraft(current=>({...current,region:selectedOption?.name||current.region,regionCode:code||provinceCode||''}));
    if(!code)return;
    try{
      const result=await api.welfareRegions('NEIGHBORHOOD',code);let items=result?.items||[];
      if(!items.length&&selectedOption?.name?.endsWith('시')){
        const childDistricts=districts.filter(option=>option.code!==code&&option.name.startsWith(`${selectedOption.name} `));
        const childResults=await Promise.all(childDistricts.map(option=>api.welfareRegions('NEIGHBORHOOD',option.code)));
        items=childResults.flatMap(response=>(response?.items||[]).map(item=>({...item,displayName:item.name.split(' ').slice(-2).join(' ')})));
      }
      setNeighborhoods(items);
    }catch(e){setError(errorMessage(e,'읍·면·동을 불러오지 못했어요.'))}
  };
  const selectNeighborhood=code=>{setNeighborhoodCode(code);const selectedOption=neighborhoods.find(v=>v.code===code);setDraft(current=>({...current,region:selectedOption?.name||current.region,regionCode:code||districtCode||''}))};
  const saveProfile=async()=>{if(!childId)return;setSaving(true);setError('');try{const saved=await api.saveWelfareProfile(childId,{regionCode:draft.regionCode.trim()||null,regionName:draft.region.trim()||null,householdSize:draft.household===''?null:Number(draft.household),incomeBand:draft.income.trim()||null,childCount:draft.childCount===''?null:Number(draft.childCount),dualIncome:draft.dualIncome,childcareStatus:draft.childcare.trim()||null,singleParent:draft.singleParent,multicultural:draft.multicultural,disability:draft.disability,storageConsent:true,healthDataConsent:false});const next=profileFromApi(saved);setProfile(next);setDraft(next);setRevision(v=>v+1);setConfirmOpen(false);setProfileOpen(false)}catch(e){setError(errorMessage(e,'맞춤정보를 저장하지 못했어요.'))}finally{setSaving(false)}};
  const removeProfile=async()=>{if(!childId)return;try{await api.deleteWelfareProfile(childId);setProfile(null);setDraft(EMPTY_PROFILE);setRevision(v=>v+1);setProfileOpen(false)}catch(e){setError(errorMessage(e,'맞춤정보를 삭제하지 못했어요.'))}};
  const toggleFavorite=async id=>{if(!childId)return;const exists=favorites.includes(id);try{if(exists)await api.removeWelfareFavorite(childId,id);else await api.addWelfareFavorite(childId,id);setFavorites(items=>exists?items.filter(v=>v!==id):[...items,id])}catch(e){setError(errorMessage(e,'관심 혜택을 변경하지 못했어요.'))}};

  if(selected)return <div className="page padded welfare-page welfare-detail-view">
    <button className="welfare-back" onClick={()=>setSelected(null)}><ChevronLeft/> 추천 목록</button>
    <div className="welfare-detail-title"><div>{selected.agency&&<span>{selected.agency}</span>}<h2>{selected.name}</h2>{selected.summary&&<p>{selected.summary}</p>}</div><button aria-label={favorites.includes(selected.id)?'관심 혜택 해제':'관심 혜택 저장'} className={favorites.includes(selected.id)?'saved':''} onClick={()=>toggleFavorite(selected.id)}><Heart fill={favorites.includes(selected.id)?'currentColor':'none'}/></button></div>
    <div className="eligibility-summary"><Sparkles/><div><b>입력한 정보와 조건 일치율 {Math.round(Number(selected.score))}%</b><p>{[regionScopeLabel(selected.regionScope,selected.regionLabel),statusLabel(selected.status)].filter(Boolean).join(' · ')} · 자격을 확정하는 결과가 아니며 신청기관의 최종 확인이 필요해요.</p></div></div>
    {!!selected.conditions.length&&<section className="welfare-info-card"><h3>조건별 판정</h3><ul className="condition-list">{selected.conditions.map(condition=><li key={condition.key} className={CONDITION_STATUS[condition.status]?.className||''}><b>{condition.label}</b><span className="condition-flag">{CONDITION_STATUS[condition.status]?.label||condition.status}</span><p>{condition.message}</p></li>)}</ul><small>일치율은 이 사업이 요구하는 조건 가운데 충족한 비중이에요. 확인 필요 항목은 일부만 반영돼요.</small></section>}
    <section className="welfare-info-card"><h3>AI 추천 설명</h3>{explanation?.loading&&<p>추천 이유를 정리하고 있어요...</p>}{explanation?.summary&&<p className="ai-reason">{explanation.summary}</p>}{explanation?.summary&&explanation?.ai_generated===false&&<small>AI 설명을 받지 못해 판정 결과를 그대로 정리했어요.</small>}{explanation?.error&&<p>{explanation.error}</p>}</section>
    {!detail&&<p className="welfare-detail-loading">상세 내용을 불러오는 중이에요...</p>}
    {[['지원대상',detail?.target],['지원내용',detail?.benefit],['신청방법',detail?.method],['준비서류',detail?.documents],['신청기한',detail?.deadline||selected.deadline]].filter(([,v])=>v).map(([title,body])=><section className="welfare-copy-block" key={title}><h3>{title}</h3><p>{formatWelfareText(body)}</p></section>)}
    {detail?.applicationUrl&&<button className="primary-button welfare-apply" onClick={()=>window.open(detail.applicationUrl,'_blank','noopener,noreferrer')}><Link2/> 공식 사이트에서 확인하기</button>}
    {detail?.modifiedAtSource&&<p className="source-note"><ShieldCheck/> 공공서비스 원천정보 수정일 {new Date(detail.modifiedAtSource).toLocaleDateString('ko-KR')}</p>}
  </div>;

  return <div className="page padded detail-page welfare-page">
    <div className="detail-hero welfare-page-heading"><span className="detail-icon"><Gift/></span><div><h2>맞춤 복지</h2><p>{childName?`${childName}에게 맞는 복지혜택을 확인해보세요.`:'가족정보를 기준으로 맞춤 혜택을 찾아드려요.'}</p></div></div>
    {childId?<button className="welfare-child-card" onClick={onChildOpen}><span className="child-face">{child?.emoji||'👶🏻'}</span><span><b>{childName}</b><small>{[childAge,profile?.region||'거주지역 미입력'].filter(Boolean).join(' · ')}</small></span><ChevronRight/></button>:<button className="welfare-child-card empty" onClick={onChildOpen}><span className="child-face">👶🏻</span><span><b>아이를 선택해 주세요</b><small>추천받을 자녀를 선택할 수 있어요.</small></span><ChevronRight/></button>}
    {childId&&<section className="profile-progress-card"><div className="profile-progress-head"><div><span>{profile?'저장된 맞춤정보':'맞춤정보를 입력해 주세요'}</span><b>{profile?'저장됨':'미입력'}</b></div><button onClick={openProfile}>{profile?'수정하기':'입력하기'} <ChevronRight/></button></div><p>{profile?'저장된 가족정보를 적용해 추천했어요.':'지역과 가구정보를 저장하면 추천에 반영돼요.'}</p></section>}
    <label className="welfare-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="복지 서비스 검색"/></label>
    <div className="welfare-summary-row"><div><b>{visible.filter(v=>v.status==='ELIGIBLE').length}</b><span>맞춤 추천</span></div><div><b>{visible.length}</b><span>전체 추천</span></div><div><b>{favorites.length}</b><span>관심 혜택</span></div></div>
    {!loading&&!!excludedCount&&<p className="welfare-filter-note"><ShieldCheck/> 거주지역·연령·가구 조건에 맞지 않는 {excludedCount}건은 추천에서 제외했어요.{childContext&&!childContext.profileSaved&&' 가족정보를 저장하면 소득·가구 조건까지 반영돼요.'}</p>}
    <div className="welfare-list-head"><div><Sparkles/><b>{childName?`${childName} 맞춤 추천`:'맞춤 추천'}</b></div><button type="button" className={`favorites-filter${favoritesOnly?' active':''}`} aria-pressed={favoritesOnly} onClick={()=>setFavoritesOnly(value=>!value)}><Heart fill={favoritesOnly?'currentColor':'none'}/>{favoritesOnly?'전체 보기':'관심목록 보기'}</button></div>
    {error&&<div className="welfare-empty"><b>{error}</b></div>}
    {loading?<div className="welfare-empty"><Clock3/><b>복지 데이터를 불러오는 중이에요</b></div>:<div className="welfare-program-list">{visible.map(item=>{const saved=favorites.includes(item.id);return <article key={item.id} className="welfare-program-card"><div className="program-top"><span className={item.status==='ELIGIBLE'?'high':'possible'}>{statusLabel(item.status)}</span><button aria-label={saved?'관심 혜택 해제':'관심 혜택 저장'} className={saved?'saved':''} onClick={()=>toggleFavorite(item.id)}><Heart fill={saved?'currentColor':'none'}/></button></div>{item.summary&&<p className="program-summary">{item.summary}</p>}<h3>{item.name}</h3><div className="score-row"><span><i style={{width:`${Math.min(Number(item.score),100)}%`}}/></span><b>조건 일치율 {Math.round(Number(item.score))}%</b></div><div className="program-meta">{regionScopeLabel(item.regionScope,item.regionLabel)&&<span className="program-region">{regionScopeLabel(item.regionScope,item.regionLabel)}</span>}{item.agency&&<span className="program-agency">{item.agency}</span>}{item.deadline&&<span className="program-deadline"><Clock3/><b>신청기간</b><span>{item.deadline.split('※').map((part,index)=><React.Fragment key={`${item.id}-deadline-${index}`}>{index>0&&<br/>}{index>0?'※ ':''}{part.trim()}</React.Fragment>)}</span></span>}</div><button className="program-detail-button" onClick={()=>setSelected(item)}>추천 결과와 상세보기 <ChevronRight/></button></article>})}</div>}
    {!loading&&!error&&childId&&!visible.length&&<div className="welfare-empty"><Search/><b>{query.trim()?'검색 결과가 없어요':'조건에 맞는 추천 결과가 없어요'}</b>{!query.trim()&&<p>{childContext?.regionLabel?`${childContext.regionLabel} 기준으로 신청할 수 있는 사업을 찾지 못했어요.`:'거주지역을 입력하면 내 지역 사업을 찾아드려요.'}</p>}</div>}
    {profileOpen&&<div className="modal-backdrop" onMouseDown={()=>setProfileOpen(false)}><div ref={sheetRef} className="sheet welfare-profile-sheet" role="dialog" aria-modal="true" aria-label="복지 맞춤정보" onMouseDown={e=>e.stopPropagation()}><header className="welfare-sheet-header"><div className="sheet-handle" role="button" tabIndex="0" aria-label="아래로 끌어 닫기" {...handleProps}/><button className="sheet-close" aria-label="닫기" onClick={()=>setProfileOpen(false)}><X/></button><div className="sheet-heading"><Gift/><div><h3>복지 맞춤정보</h3><p>입력한 값은 맞춤 추천 정보로 안전하게 저장돼요.</p></div></div></header>
      <fieldset className="welfare-field-group welfare-region-field"><legend>거주지역</legend><span className="welfare-field-hint">시·도, 시·군·구 순서로 선택하고 읍·면·동은 필요한 경우에만 선택해 주세요</span><div className="region-select-grid"><WelfareSelect value={provinceCode} onChange={selectProvince} options={provinces.map(v=>({value:v.code,label:v.name}))} placeholder="시·도" ariaLabel="시도"/><WelfareSelect value={districtCode} onChange={selectDistrict} disabled={!provinceCode} options={districts.map(v=>({value:v.code,label:v.name.split(' ').slice(1).join(' ')}))} placeholder="시·군·구" ariaLabel="시군구"/><WelfareSelect value={neighborhoodCode} onChange={selectNeighborhood} disabled={!districtCode} options={neighborhoods.map(v=>({value:v.code,label:v.displayName||v.name.split(' ').at(-1)}))} placeholder="읍·면·동 (선택)" ariaLabel="읍면동"/></div>{draft.region&&<small className="selected-region">선택 지역: {draft.region}</small>}</fieldset>
      <div className="welfare-form-row"><label>가구원 수<input type="number" min="1" value={draft.household} onChange={e=>setDraft({...draft,household:e.target.value})}/></label><label>자녀 수<input type="number" min="0" value={draft.childCount} onChange={e=>setDraft({...draft,childCount:e.target.value})}/></label></div>
      <label>소득 구간<WelfareSelect value={draft.income} onChange={value=>setDraft({...draft,income:value})} options={[{value:'',label:'선택하지 않음'},...incomeBands.map(option=>({value:option.value,label:option.label}))]} ariaLabel="소득 구간"/></label>
      <div className="income-helper"><b>{incomeGuide?.year}년 기준중위소득 간편 계산</b><p>가구원 수와 월 소득을 입력하면 대략적인 구간을 선택해 드려요.</p><div><input type="number" min="0" value={monthlyIncome} onChange={e=>setMonthlyIncome(e.target.value)} placeholder="가구 월 소득(원)"/><button type="button" onClick={calculateIncomeBand}>계산하기</button></div><small>간편 계산은 월 소득만 비교한 참고값입니다. 실제 복지사업의 소득인정액은 소득평가액과 재산의 소득환산액을 합산하며 공제·부채·자동차 등 사업별 기준이 달라질 수 있어요.</small>{incomeGuide?.sourceUrl&&<a href={incomeGuide.sourceUrl} target="_blank" rel="noreferrer">보건복지부 기준중위소득 근거 보기</a>}</div>
      <label>현재 양육 형태<WelfareSelect value={draft.childcare} onChange={value=>setDraft({...draft,childcare:value})} options={[{value:'',label:'선택하지 않음'},...childcareOptions.map(option=>({value:option.value,label:option.label}))]} ariaLabel="현재 양육 형태"/></label>
      <div className="welfare-checks"><label><input type="checkbox" checked={draft.dualIncome} onChange={e=>setDraft({...draft,dualIncome:e.target.checked})}/><span>맞벌이 가구</span></label><label><input type="checkbox" checked={draft.singleParent} onChange={e=>setDraft({...draft,singleParent:e.target.checked})}/><span>한부모 가정</span></label></div><div className="welfare-checks"><label><input type="checkbox" checked={draft.multicultural} onChange={e=>setDraft({...draft,multicultural:e.target.checked})}/><span>다문화 가정</span></label><label><input type="checkbox" checked={draft.disability} onChange={e=>setDraft({...draft,disability:e.target.checked})}/><span>장애 관련 조건</span></label></div>
      <p className="privacy-help"><ShieldCheck/> 민감한 정보는 선택사항이며 복지 추천 목적으로만 저장해요.</p>{profile&&<button className="welfare-delete-profile" onClick={removeProfile}>저장된 맞춤정보 삭제</button>}<button className="primary-button" onClick={()=>setConfirmOpen(true)}><Sparkles/> 이 정보로 추천받기</button>
    </div></div>}
    {confirmOpen&&<div className="modal-backdrop confirm-layer"><div className="welfare-confirm"><span><Save/></span><h3>입력한 정보를 저장할까요?</h3><p>저장한 값은 다음 맞춤 추천부터 API 요청에 반영돼요.</p><div className="confirm-data">{draft.region&&<b>{draft.region}</b>}<span>가구원 {draft.household||'미입력'}명 · {incomeBands.find(option=>option.value===draft.income)?.label||'소득 구간 미입력'}</span></div><button className="primary-button" disabled={saving} onClick={saveProfile}>{saving?'저장 중...':'저장하고 맞춤 추천'}</button><button className="text-button" onClick={()=>setConfirmOpen(false)}>다시 확인하기</button></div></div>}
  </div>;
}
