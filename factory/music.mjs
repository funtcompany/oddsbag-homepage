// 트렌디 BGM 엔진 — 카테고리별 스타일. 비트(킥/햇/클랩) + 베이스 + 아르페지오 + 패드.
// 전부 직접 합성 → 저작권 안전. 스타일마다 BPM·코드진행·리듬이 다르다.
import fs from "node:fs";

const midiFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
const saw = (f, t, n = 8) => { let s = 0; for (let k = 1; k <= n; k++) s += Math.sin(2 * Math.PI * k * f * t) / k; return s * (2 / Math.PI); };
const tri = (f, t) => (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * f * t));

const CH = { Am: [57, 60, 64], F: [53, 57, 60], C: [60, 64, 67], G: [55, 59, 62], Em: [52, 55, 59], Dm: [50, 53, 57] };
const rootOf = { Am: 45, F: 41, C: 48, G: 43, Em: 40, Dm: 38 };

const STYLES = {
  synthwave: { bpm: 104, prog: ["Am", "F", "C", "G"], bright: 9, padVol: 0.05,
    kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], hat: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,1], clap: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], bass: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], arp: true, arpVol: 0.16 },
  energetic: { bpm: 122, prog: ["C", "G", "Am", "F"], bright: 10, padVol: 0.04,
    kick: [1,0,0,0, 1,0,0,1, 1,0,0,0, 1,0,1,0], hat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], clap: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], bass: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1], arp: true, arpVol: 0.17 },
  newsy: { bpm: 96, prog: ["Am", "Em", "F", "C"], bright: 5, padVol: 0.07,
    kick: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0], hat: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], clap: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0], bass: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], arp: true, arpVol: 0.10 },
  lofi: { bpm: 80, prog: ["Am", "Dm", "G", "C"], bright: 4, padVol: 0.08, vinyl: true,
    kick: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0], hat: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0], clap: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], bass: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0], arp: false, arpVol: 0 },
};

export const styleForCategory = (cat) => ({
  "IT·테크": "synthwave", "트렌드": "synthwave", "스포츠": "energetic",
  "경제": "newsy", "사회": "newsy", "문화·연예": "lofi",
}[cat] || "lofi");

export function makeMusic(styleName, totalDur, SR = 44100) {
  const st = STYLES[styleName] || STYLES.lofi;
  const N = Math.ceil((totalDur + 1) * SR);
  const B = new Float32Array(N);
  const add = (start, arr) => { for (let i = 0; i < arr.length; i++) { const idx = start + i; if (idx >= 0 && idx < N) B[idx] += arr[i]; } };
  const spb = 60 / st.bpm, stepDur = spb / 4;
  const steps = Math.ceil(totalDur / stepDur) + 4;
  const drum = (fn, len) => { const buf = new Float32Array(Math.floor(len * SR)); for (let i = 0; i < buf.length; i++) buf[i] = fn(i / SR); return buf; };
  const kick = () => drum((t) => Math.sin(2 * Math.PI * (45 + 80 * Math.exp(-t * 32)) * t) * Math.exp(-t * 20) * 0.9, 0.16);
  const hat = () => drum((t) => (Math.random() * 2 - 1) * Math.exp(-t * 90) * 0.22, 0.05);
  const clap = () => drum((t) => (Math.random() * 2 - 1) * Math.exp(-t * 15) * 0.33, 0.14);

  for (let s = 0; s < steps; s++) {
    const startS = Math.floor(s * stepDur * SR);
    const bar = Math.floor(s / 16), s16 = s % 16;
    const chName = st.prog[bar % st.prog.length];
    const chord = CH[chName], root = rootOf[chName];
    if (st.kick[s16]) add(startS, kick());
    if (st.hat[s16]) add(startS, hat());
    if (st.clap[s16]) add(startS, clap());
    if (st.bass[s16]) {
      const f = midiFreq(root), dur = stepDur * 1.6, L = Math.floor(dur * SR), buf = new Float32Array(L);
      for (let i = 0; i < L; i++) { const t = i / SR; buf[i] = tri(f, t) * Math.min(1, t / 0.004) * Math.exp(-t * 5) * 0.5; }
      add(startS, buf);
    }
    if (st.arp) {
      const note = chord[s % chord.length] + 12, f = midiFreq(note), dur = stepDur * 0.9, L = Math.floor(dur * SR), buf = new Float32Array(L);
      for (let i = 0; i < L; i++) { const t = i / SR; buf[i] = saw(f, t, st.bright) * Math.min(1, t / 0.003) * Math.exp(-t * 9) * st.arpVol; }
      add(startS, buf);
    }
    if (s16 === 0) {
      const dur = spb * 4, L = Math.floor(dur * SR), buf = new Float32Array(L);
      for (let i = 0; i < L; i++) { const t = i / SR; let v = 0; for (const m of chord) v += Math.sin(2 * Math.PI * midiFreq(m) * t); v *= Math.min(1, t / 0.4) * Math.min(1, (dur - t) / 0.6) * st.padVol; buf[i] = v; }
      add(startS, buf);
    }
  }
  if (st.vinyl) for (let i = 0; i < N; i++) B[i] += (Math.random() * 2 - 1) * 0.012;
  return B;
}

export function writeWav(file, B, SR = 44100) {
  const n = B.length, buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { const v = Math.max(-32767, Math.min(32767, B[i] * 32767)) | 0; buf.writeInt16LE(v, 44 + i * 4); buf.writeInt16LE(v, 46 + i * 4); }
  fs.writeFileSync(file, buf);
}
