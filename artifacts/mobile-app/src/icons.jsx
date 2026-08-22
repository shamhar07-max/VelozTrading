const S = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
export const IconChart = (p) => (<svg viewBox="0 0 24 24" {...S} {...p}><path d="M3 3v18h18"/><path d="m7 14 4-4 4 4 5-5"/></svg>);
export const IconSwap = (p) => (<svg viewBox="0 0 24 24" {...S} {...p}><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>);
export const IconWallet = (p) => (<svg viewBox="0 0 24 24" {...S} {...p}><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M21 12H13a2 2 0 0 0 0 4h8a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1z"/></svg>);
export const IconUser = (p) => (<svg viewBox="0 0 24 24" {...S} {...p}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>);
export const IconSearch = (p) => (<svg viewBox="0 0 24 24" {...S} {...p}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>);
export const IconDown = (p) => (<svg viewBox="0 0 24 24" {...S} {...p}><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>);
export const IconUp = (p) => (<svg viewBox="0 0 24 24" {...S} {...p}><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>);
export const IconShield = (p) => (<svg viewBox="0 0 24 24" {...S} {...p}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>);
export const IconLayers = (p) => (<svg viewBox="0 0 24 24" {...S} {...p}><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>);
export const IconBell = (p) => (<svg viewBox="0 0 24 24" {...S} {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>);
export const IconStar = ({ filled, ...p }) => (<svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={filled ? "currentColor" : "none"} {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>);
export const IconTrophy = (p) => (<svg viewBox="0 0 24 24" {...S} {...p}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>);
export const IconZap = (p) => (<svg viewBox="0 0 24 24" {...S} {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>);
export const IconCal = (p) => (<svg viewBox="0 0 24 24" {...S} {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>);
export const IconCopy = (p) => (<svg viewBox="0 0 24 24" {...S} {...p}><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>);
export const IconBook = (p) => (<svg viewBox="0 0 24 24" {...S} {...p}><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>);
export const IconBack = (p) => (<svg viewBox="0 0 24 24" {...S} {...p}><path d="m15 18-6-6 6-6"/></svg>);
export const IconX = (p) => (<svg viewBox="0 0 24 24" {...S} {...p}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>);
export const IconExt = (p) => (<svg viewBox="0 0 24 24" {...S} {...p}><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>);
export const IconUsers = (p) => (<svg viewBox="0 0 24 24" {...S} {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>);

export function BrandMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <defs>
        <linearGradient id="vtbg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#040C1A"/><stop offset="100%" stopColor="#061828"/>
        </linearGradient>
        <linearGradient id="vtmk" x1="16" y1="76" x2="84" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00C6FF"/><stop offset="55%" stopColor="#0072FF"/><stop offset="100%" stopColor="#7C3AED"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill="url(#vtbg)"/>
      <line x1="16" y1="24" x2="50" y2="76" stroke="url(#vtmk)" strokeWidth="8.5" strokeLinecap="round"/>
      <polyline points="50,76 62,49 71,61 84,20" stroke="url(#vtmk)" strokeWidth="8.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="84" cy="20" r="6.5" fill="#00C6FF"/>
      <circle cx="84" cy="20" r="3" fill="#fff"/>
    </svg>
  );
}
