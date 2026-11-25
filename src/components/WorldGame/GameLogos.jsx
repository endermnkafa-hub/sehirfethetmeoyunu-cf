import React from 'react';

// Custom Multi-Layered Vector Game Logos & Emblems (Zero Emojis)

export function LogoSwords({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <defs>
        <linearGradient id="bladeGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F8FAFC" />
          <stop offset="50%" stopColor="#94A3B8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
        <linearGradient id="hiltGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14" fill="#1E1B4B" stroke="url(#hiltGrad)" strokeWidth="1.8" />
      <path d="M8 24L23 9M23 9H19M23 9V13" stroke="url(#bladeGrad)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 24L9 9M9 9H13M9 9V13" stroke="url(#bladeGrad)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 26L11 21M26 26L21 21" stroke="url(#hiltGrad)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function LogoShield({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <defs>
        <linearGradient id="shieldBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="shieldRim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
      </defs>
      <path
        d="M16 3L27 7.5V15.5C27 22.5 22.2 27.4 16 29.5C9.8 27.4 5 22.5 5 15.5V7.5L16 3Z"
        fill="url(#shieldBody)"
        stroke="url(#shieldRim)"
        strokeWidth="2.2"
      />
      <path d="M16 6V26.5" stroke="#FEF08A" strokeWidth="1.5" strokeOpacity="0.6" />
      <path d="M8 14H24" stroke="#FEF08A" strokeWidth="1.5" strokeOpacity="0.6" />
    </svg>
  );
}

export function LogoMobilization({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <defs>
        <linearGradient id="boltGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#DC2626" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14" fill="#27120B" stroke="#F59E0B" strokeWidth="1.8" />
      <path d="M18 5L9 17H16L14 27L23 15H16L18 5Z" fill="url(#boltGrad)" stroke="#FEF9C3" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

export function LogoLogistics({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <defs>
        <linearGradient id="crateGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>
      </defs>
      <rect x="4" y="6" width="24" height="20" rx="3" fill="url(#crateGrad)" stroke="#FBBF24" strokeWidth="2" />
      <path d="M4 12H28M12 6V26M20 6V26" stroke="#FDE68A" strokeWidth="1.6" strokeOpacity="0.75" />
      <circle cx="16" cy="16" r="3" fill="#FEF08A" />
    </svg>
  );
}

export function LogoGold({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <defs>
        <radialGradient id="coinGrad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FEF9C3" />
          <stop offset="45%" stopColor="#FACC15" />
          <stop offset="100%" stopColor="#B45309" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="13" fill="url(#coinGrad)" stroke="#FEF08A" strokeWidth="1.8" />
      <circle cx="16" cy="16" r="9.5" stroke="#78350F" strokeWidth="1.2" strokeDasharray="3 2" />
      <path d="M16 10V22M13 12.5H17.5C18.8 12.5 19.5 13.5 19.5 14.5C19.5 15.5 18.8 16 17.5 16H14.5C13.2 16 12.5 16.8 12.5 17.8C12.5 19 13.5 19.8 15 19.8H19" stroke="#78350F" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function LogoPopulation({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <defs>
        <linearGradient id="popGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14" fill="#0C2538" stroke="#38BDF8" strokeWidth="1.6" />
      <circle cx="16" cy="11" r="4" fill="url(#popGrad)" />
      <path d="M9 24C9 19.8 12.1 17 16 17C19.9 17 23 19.8 23 24" fill="url(#popGrad)" />
    </svg>
  );
}

export function LogoTerritory({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <defs>
        <linearGradient id="terrGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <polygon points="16,3 28,10 28,22 16,29 4,22 4,10" fill="#062E22" stroke="url(#terrGrad)" strokeWidth="2.2" />
      <polygon points="16,8 23,12 23,20 16,24 9,20 9,12" fill="url(#terrGrad)" fillOpacity="0.65" />
    </svg>
  );
}

export function LogoHousing({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="14" fill="#0F291E" stroke="#10B981" strokeWidth="1.8" />
      <path d="M16 7L6 15H9V24H23V15H26L16 7Z" fill="#10B981" stroke="#A7F3D0" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="13.5" y="18" width="5" height="6" fill="#064E3B" />
    </svg>
  );
}

export function LogoSiege({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="13" fill="#2A0F18" stroke="#F43F5E" strokeWidth="2" />
      <circle cx="16" cy="16" r="8" stroke="#FDA4AF" strokeWidth="1.5" strokeDasharray="3 2" />
      <circle cx="16" cy="16" r="3" fill="#F43F5E" />
      <path d="M16 2V7M16 25V30M2 16H7M25 16H30" stroke="#F43F5E" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function LogoCitadel({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <defs>
        <linearGradient id="fortGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
      </defs>
      <path
        d="M5 26V10H8V13H11V10H14V14H18V10H21V13H24V10H27V26H5Z"
        fill="url(#fortGrad)"
        stroke="#F8FAFC"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M13 26V20C13 18.3 14.3 17 16 17C17.7 17 19 18.3 19 20V26H13Z" fill="#0F172A" />
    </svg>
  );
}

export function LogoNavy({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <defs>
        <linearGradient id="shipGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0369A1" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14" fill="#082F49" stroke="#38BDF8" strokeWidth="1.8" />
      {/* Sail & Mast */}
      <path d="M16 6V19M16 7L24 17H16V7ZM15 9L9 17H15V9Z" fill="#F0F9FF" />
      {/* Hull */}
      <path d="M6 19H26L23 24H9L6 19Z" fill="url(#shipGrad)" stroke="#BAE6FD" strokeWidth="1.2" />
      {/* Waves */}
      <path d="M6 26.5C8.5 25 11 28 13.5 26.5C16 25 18.5 28 21 26.5C23.5 25 25 27 26.5 26.5" stroke="#7DD3FC" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function LogoPan({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M16 4L12 8H20L16 4ZM16 28L12 24H20L16 28ZM4 16L8 12V20L4 16ZM28 16L24 12V20L28 16Z" fill="#A5B4FC" />
      <path d="M16 7V25M7 16H25" stroke="#818CF8" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="16" cy="16" r="3" fill="#E0E7FF" />
    </svg>
  );
}

export function LogoNuclear({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <defs>
        <radialGradient id="nukeGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="70%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#DC2626" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="14" fill="#18181B" stroke="#F59E0B" strokeWidth="1.8" />
      {/* 3 Radioactive Trefoil blades */}
      <path d="M16 16 L12 6 A11 11 0 0 1 20 6 Z" fill="url(#nukeGrad)" />
      <path d="M16 16 L6 22 A11 11 0 0 1 8 13 Z" fill="url(#nukeGrad)" />
      <path d="M16 16 L26 22 A11 11 0 0 0 24 13 Z" fill="url(#nukeGrad)" />
      {/* Center core */}
      <circle cx="16" cy="16" r="3.2" fill="#18181B" stroke="#FEF08A" strokeWidth="1.2" />
    </svg>
  );
}

export function LogoPalette({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="13" fill="#1E293B" stroke="#F43F5E" strokeWidth="2" />
      <circle cx="11" cy="12" r="2.5" fill="#E11D48" />
      <circle cx="17" cy="10" r="2.5" fill="#3B82F6" />
      <circle cx="22" cy="15" r="2.5" fill="#10B981" />
      <circle cx="19" cy="21" r="2.5" fill="#F59E0B" />
    </svg>
  );
}

export function UpgradeLogo({ upgradeKey, size = 20 }) {
  switch (upgradeKey) {
    case 'mobilization':
      return <LogoMobilization size={size} />;
    case 'weapons':
      return <LogoSwords size={size} />;
    case 'fortification':
      return <LogoShield size={size} />;
    case 'logistics':
      return <LogoLogistics size={size} />;
    case 'economy':
      return <LogoGold size={size} />;
    case 'housing':
      return <LogoHousing size={size} />;
    case 'siege':
      return <LogoSiege size={size} />;
    case 'citadel':
      return <LogoCitadel size={size} />;
    case 'navy':
      return <LogoNavy size={size} />;
    default:
      return <LogoShield size={size} />;
  }
}
