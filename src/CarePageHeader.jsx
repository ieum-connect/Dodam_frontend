import React from 'react';

export default function CarePageHeader({ icon: Icon, title, description, children }) {
  return <header className="care-page-header">
    <div className="detail-hero">
      <span className="detail-icon"><Icon aria-hidden="true"/></span>
      <div><h2>{title}</h2><p>{description}</p></div>
    </div>
    {children}
  </header>;
}
