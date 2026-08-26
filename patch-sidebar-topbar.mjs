import { readFileSync, writeFileSync } from 'fs';

// ─── Sidebar improvements ──────────────────────────────────────────────────
const sidebarFile = './Frontend/src/components/Sidebar.tsx';
let sidebar = readFileSync(sidebarFile, 'utf8');
let sidebarChanges = 0;

function replaceSidebar(old, neu) {
  if (sidebar.includes(old)) {
    sidebar = sidebar.replace(old, neu);
    sidebarChanges++;
    return true;
  }
  console.warn('[Sidebar] NOT FOUND:', old.substring(0, 80));
  return false;
}

// Improve sidebar wordmark subtitle
replaceSidebar(
  `<span className="text-[10px] font-mono tracking-widest text-[#6B1420] block mt-0.5 font-bold">
                  REPAIR MANAGEMENT
                </span>`,
  `<span className="text-[9px] font-mono tracking-[0.15em] text-[#6B1420]/70 block mt-0.5 font-bold uppercase">
                  Facilities Portal
                </span>`
);

// Improve sidebar h1 size
replaceSidebar(
  `<h1 className="font-display font-bold text-lg tracking-tight text-[#241012] leading-none truncate">`,
  `<h1 className="font-display font-bold text-[15px] tracking-tight text-[#241012] leading-none truncate">`
);

// Replace "Institution" footer label text
replaceSidebar(
  `<div className="text-[10px] uppercase tracking-widest text-[#9A8A82] font-bold mb-1">Institution</div>
            <p className="font-display text-xs font-semibold text-[#4A322E]">
              COLEGIO DE SANTA CATALINA
            </p>
            <p className="font-mono text-xs text-[#6B1420] tracking-wider mt-0.5">
              DE ALEJANDRIA (COSCA)
            </p>`,
  `<div className="flex items-center gap-2">
              <img src="/cosca-seal.png" alt="COSCA" className="w-7 h-7 object-contain shrink-0 opacity-80" />
              <div className="min-w-0">
                <p className="font-display text-[11px] font-bold text-[#4A322E] leading-tight">Colegio de Santa Catalina</p>
                <p className="font-mono text-[9px] text-[#6B1420] tracking-wider mt-0.5 opacity-70">DE ALEJANDRIA (COSCA)</p>
              </div>
            </div>`
);

// Replace collapsed COSCA text with seal image
replaceSidebar(
  `<div className="font-mono text-[10px] font-bold text-[#6B1420] tracking-tighter">
            COSCA
          </div>`,
  `<div className="flex justify-center">
            <img src="/cosca-seal.png" alt="COSCA" className="w-8 h-8 object-contain opacity-80" />
          </div>`
);

writeFileSync(sidebarFile, sidebar, 'utf8');
console.log(`✅ Sidebar — ${sidebarChanges} replacements applied`);

// ─── Topbar improvements ──────────────────────────────────────────────────
const topbarFile = './Frontend/src/components/Topbar.tsx';
let topbar = readFileSync(topbarFile, 'utf8');
let topbarChanges = 0;

function replaceTopbar(old, neu) {
  if (topbar.includes(old)) {
    topbar = topbar.replace(old, neu);
    topbarChanges++;
    return true;
  }
  console.warn('[Topbar] NOT FOUND:', old.substring(0, 80));
  return false;
}

// Add onOpenSettings to interface
replaceTopbar(
  `  onToggleSidebar?: () => void;\n  // Real, authenticated user info`,
  `  onToggleSidebar?: () => void;\n  onOpenSettings?: () => void;\n  // Real, authenticated user info`
);

// Add onOpenSettings to destructured props
replaceTopbar(
  `  onToggleSidebar,\n  displayName,`,
  `  onToggleSidebar,\n  onOpenSettings,\n  displayName,`
);

// Improve topbar header height  
replaceTopbar(
  `<header className="h-20 bg-white border-b border-[#E6DDD3] flex items-center justify-between px-4 sm:px-8 text-[#2B1210] shrink-0 select-none relative z-10 shadow-sm">`,
  `<header className="h-16 bg-white/95 backdrop-blur-sm border-b border-[#E6DDD3] flex items-center justify-between px-4 sm:px-6 text-[#2B1210] shrink-0 select-none relative z-10 shadow-sm">`
);

// Improve topbar title styling
replaceTopbar(
  `<h2 className="font-display font-semibold text-base sm:text-xl text-[#6B1420] tracking-tight leading-none truncate">`,
  `<h2 className="font-display font-bold text-sm sm:text-base text-[#241012] tracking-tight leading-none truncate">`
);

replaceTopbar(
  `<p className="text-xs sm:text-sm text-[#9A8A82] font-sans tracking-widest uppercase mt-1 truncate">`,
  `<p className="text-[10px] sm:text-xs text-[#6B1420]/70 font-mono tracking-wider mt-0.5 truncate">`
);

// Improve logout button
replaceTopbar(
  `className="flex items-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-md border border-[#EF4444] text-[#EF4444] hover:bg-[#EF4444] hover:text-white text-xs sm:text-sm font-mono font-bold transition-all uppercase cursor-pointer bg-white shadow-sm"`,
  `className="flex items-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-lg border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444] hover:text-white text-xs font-mono font-semibold transition-all uppercase cursor-pointer bg-white shadow-sm hover:shadow-md hover:border-[#EF4444]"`
);

writeFileSync(topbarFile, topbar, 'utf8');
console.log(`✅ Topbar — ${topbarChanges} replacements applied`);
