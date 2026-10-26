"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import type { CandidateId } from "@/lib/elections";

// Flat illustrated portraits from scripts/generate-portraits.ts. Candidates are tall posters with empty space
// above the head for the slogan; `face` is where the head is (as percentages of the image) so round avatars
// can crop in on it.
const candidates: Record<CandidateId, { file: string; backdrop: string; face: [number, number] }> = {
  A: { file: "aarav", backdrop: "#a9d4fc", face: [52, 38] },
  B: { file: "meera", backdrop: "#f4c1d5", face: [47, 40] },
  C: { file: "kabir", backdrop: "#d7cbfa", face: [50, 41] },
};

function frame(face: [number, number], zoom: number) {
  const at = `${face[0]}% ${face[1]}%`;
  return { objectPosition: at, transformOrigin: at, transform: `scale(${zoom})` } satisfies CSSProperties;
}

// The flat colour behind each candidate, so a frame around a portrait can blend into it.
export const portraitBackdrop = (id: CandidateId) => candidates[id].backdrop;

// `small` crops in on the face for round avatars.
export function Portrait({ id, small = false }: { id: CandidateId; small?: boolean }) {
  const c = candidates[id];
  return <Image src={`/portraits/${c.file}.webp`} alt="" width={640} height={960} sizes={small ? "96px" : "(orientation: portrait) 50vw, 33vw"} className="portrait-img" data-small={small}
    style={{ background: c.backdrop, ...(small ? frame(c.face, 2.1) : {}) }} />;
}

// One face per AI student name. Some names borrow the portrait of another student of the same gender,
// so the pool can have more names than drawings. A name with no portrait at all shows its initial.
const borrowed: Record<string, string> = {
  Navya: "riya", Ojasvi: "ananya", Pari: "diya", Radhika: "leela", Sia: "tara", Trisha: "shreya", Urvi: "jiya",
  Vanya: "avni", Yamini: "kavya", Zoya: "myra", Alisha: "nandini", Fatima: "aisha", Simran: "meghna",
  Vihaan: "arjun", Abhay: "vikram", Ayaan: "ishaan", Chirag: "harsh", Darsh: "dev", Eshan: "arnav",
  Gaurav: "om", Hrithik: "krish", Ibrahim: "farhan", Jai: "dhruv", Kartik: "kiran", Laksh: "siddharth",
  Mihir: "reyansh", Nikhil: "rahul", Parth: "pranav", Rudra: "rohan", Shaurya: "yash", Tanish: "kunal",
  Utkarsh: "aditya", Ved: "neel", Yuvraj: "samar", Zubin: "aryan", Aniket: "varun", Ritvik: "manav",
  Sahil: "rohan", Joseph: "neel",
};
export function StudentPortrait({ name }: { name: string }) {
  const [missing, setMissing] = useState<string | null>(null);
  if (missing === name) return <span className="portrait-initial">{name[0]}</span>;
  return <Image src={`/portraits/${borrowed[name] ?? name.toLowerCase()}.webp`} alt="" width={256} height={256} sizes="128px" className="portrait-img" data-small
    style={{ background: "#f3ead8", ...frame([50, 38], 1.3) }} onError={() => setMissing(name)} />;
}
