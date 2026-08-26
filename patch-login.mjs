import { readFileSync, writeFileSync } from 'fs';

const file = './Frontend/src/App.tsx';
let text = readFileSync(file, 'utf8');

let changes = 0;

function replace(old, neu) {
  if (text.includes(old)) {
    text = text.replace(old, neu);
    changes++;
    return true;
  }
  console.warn('NOT FOUND:', old.substring(0, 80));
  return false;
}

// 1. Improve back button styling
replace(
  `className="mb-5 flex items-center gap-2 text-[#8A7A72] hover:text-[#241012] transition-colors text-xs font-mono group cursor-pointer"`,
  `className="mb-6 flex items-center gap-2 text-[#8A7A72] hover:text-[#6B1420] transition-colors text-xs font-mono group cursor-pointer px-3 py-1.5 rounded-lg hover:bg-[#FBF2F2] border border-transparent hover:border-[#E8C4C9]"`
);

// 2. Improve the feature list to use SVG icons instead of emojis for reliability
replace(
  `              <p className="text-[9px] font-mono text-white/25 uppercase tracking-[0.22em] mb-3">
                System Capabilities
              </p>`,
  `              <p className="text-[9px] font-mono text-white/30 uppercase tracking-[0.22em] mb-4 flex items-center gap-2">
                <span className="h-px flex-1 bg-white/10" />
                System Capabilities
                <span className="h-px flex-1 bg-white/10" />
              </p>`
);

// 3. Make feature list items more polished
replace(
  `                  <span className="text-sm leading-none shrink-0">{icon}</span>
                  <span className="text-[12px] font-sans text-white/48 leading-snug">{label}</span>`,
  `                  <span className="w-6 h-6 rounded-md bg-white/10 border border-white/10 flex items-center justify-center text-[11px] shrink-0 leading-none">{icon}</span>
                  <span className="text-[12px] font-sans text-white/55 leading-snug">{label}</span>`
);

// 4. Improve the bottom security strip
replace(
  `              <p className="text-[9px] font-mono text-white/18 mt-5">
                JORS COSCA v2.0`,
  `              <p className="text-[9px] font-mono text-white/25 mt-5">
                JORS COSCA v2.0`
);

// 5. Improve login form card - input section padding
replace(
  `                    <div className="px-7 py-6">`,
  `                    <div className="px-7 py-7">`
);

// 6. Improve the "Select your access terminal" badge (secure badge)
replace(
  `                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FBF2F2] border border-[#E8C4C9]/80 text-xs font-mono font-semibold text-[#6B1420] mb-4 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#6B1420] animate-pulse" />`,
  `                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#FBF2F2] to-[#F0EAE4] border border-[#E8C4C9] text-xs font-mono font-semibold text-[#6B1420] mb-5 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#6B1420] animate-pulse" />`
);

// 7. Improve the mobile security strip
replace(
  `                  <div className="lg:hidden mt-6 flex flex-wrap gap-x-4 gap-y-2 justify-center">
                    {["Encrypted", "JWT Secured", "8h expiry", "5-attempt lockout"].map((item) => (
                      <span key={item} className="flex items-center gap-1.5 text-[10px] text-[#9A8A82] font-sans">
                        <span className="w-1 h-1 rounded-full bg-emerald-500" />
                        {item}
                      </span>
                    ))}
                  </div>`,
  `                  <div className="lg:hidden mt-7 p-3 rounded-xl bg-[#F5F1EC] border border-[#E6DDD3] flex flex-wrap gap-x-4 gap-y-2 justify-center">
                    {["🔒 Encrypted", "🪙 JWT Secured", "⏱ 8h expiry", "🛡 5-attempt lockout"].map((item) => (
                      <span key={item} className="flex items-center gap-1.5 text-[10px] text-[#8A7A72] font-sans font-medium">
                        {item}
                      </span>
                    ))}
                  </div>`
);

// 8. Improve the left panel feature list items visual style
replace(
  `                  className="flex items-center gap-3 py-2.5 border-b border-white/[0.06] last:border-0"`,
  `                  className="flex items-center gap-3 py-3 border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03] rounded-lg px-1 transition-colors"`
);

writeFileSync(file, text, 'utf8');
console.log(`✅ Done — ${changes} replacements applied`);
