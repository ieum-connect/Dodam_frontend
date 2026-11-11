import React from 'react';
import { Baby, UserRoundPlus } from 'lucide-react';

export default function ChildRequiredState({ icon: Icon, title, description, message, onChildOpen }) {
  return <div className="page padded detail-page">
    <div className="detail-hero">
      <span className="detail-icon"><Icon aria-hidden="true"/></span>
      <div><h2>{title}</h2><p>{description || '아이별로 건강 기록을 안전하게 관리해요.'}</p></div>
    </div>
    <div className="child-required">
      <Baby aria-hidden="true"/>
      <h3>아이를 먼저 등록해 주세요</h3>
      <p>{message || '건강 기록을 관리하려면 먼저 아이 프로필이 필요해요.'}</p>
      <button type="button" className="primary-button" onClick={onChildOpen}><UserRoundPlus aria-hidden="true"/> 아이 등록하기</button>
    </div>
  </div>;
}
