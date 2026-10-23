import type { CandidateId } from "@/lib/elections";

const palette = {
  A: { backdrop: "#b9d9fa", hair: "#252c38", skin: "#e6b69b", shirt: "#4d5c6b" },
  B: { backdrop: "#f6c7d9", hair: "#382b33", skin: "#bc805e", shirt: "#ece1c9" },
  C: { backdrop: "#ded3fc", hair: "#26392e", skin: "#cda17b", shirt: "#d6d08f" },
};

export function Portrait({ id, small = false }: { id: CandidateId; small?: boolean }) {
  const c = palette[id];
  return (
    <svg viewBox={small ? "50 12 120 120" : "-40 14 300 163"} preserveAspectRatio="xMidYMid meet" aria-hidden="true" className="portrait-svg">
      <rect x="-1000" y="-1000" width="2200" height="2200" fill={c.backdrop} />
      {!small && <><path d={id === "B" ? "M160 24l15 7m-19 5l12-2" : "M24 37l8-9m4 11l12-3"} stroke="#fff" strokeWidth="2" fill="none" opacity=".5" /><circle cx="184" cy="149" r="22" stroke="#fff" strokeWidth="1" fill="none" opacity=".15" /></>}
      <ellipse cx="110" cy="202" rx="79" ry="75" fill={c.shirt} />
      <path d="M94 107h32v39q-16 16-32 0" fill={c.skin} />
      <ellipse cx="110" cy="79" rx="37" ry="45" fill={c.skin} />
      {id === "A" ? <path d="M72 78q-12-64 38-58q52-7 40 65l-12-28q-34 10-53-2z" fill={c.hair} /> : id === "B" ? <><path d="M70 122q-14-91 40-102q58 0 46 102l-20-6V55q-26 19-50 3v61z" fill={c.hair} /><ellipse cx="72" cy="49" rx="12" ry="15" fill={c.hair} /><ellipse cx="144" cy="44" rx="13" ry="16" fill={c.hair} /></> : <><path d="M73 72q-6-54 32-52q50-6 48 51l-15-18q-25 7-52-3z" fill={c.hair} /><g stroke={c.hair} fill="none" strokeWidth="2"><rect x="81" y="75" width="24" height="15" rx="6" /><rect x="115" y="75" width="24" height="15" rx="6" /><path d="M105 81h10" /></g></>}
      <g fill={c.hair}><circle cx="95" cy="82" r="2" /><circle cx="125" cy="82" r="2" /></g>
      <path d="M102 102q8 6 16 0" stroke={c.hair} fill="none" strokeWidth="2" strokeLinecap="round" />
      <path d="M92 142l18 18 18-18" stroke="#fff" strokeOpacity=".6" fill="none" strokeWidth="2" />
    </svg>
  );
}
