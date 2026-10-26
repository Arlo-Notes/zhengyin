// 发音：音节一律放真人录音（Web Audio，延迟低、连读不断）；只有「整句」用系统声音（speechSynthesis）。
import { split, recordingName, mark } from './pinyin.js';

const AUDIO_CACHE = 'zy-audio-v1';
let ctx = null;
const buffers = new Map();   // 解码好的录音，最多留 300 条
let generation = 0;
let current = null;          // 正在播放的 AudioBufferSourceNode
const listeners = new Set();
export const state = { speakingId: null, sequence: null };

function notify() { listeners.forEach((fn) => fn(state)); }
export function onChange(fn) { listeners.add(fn); }

/** 必须在用户点击里调用一次：iOS 要求声音由点击触发 */
export function unlock() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    // iOS：静音开关打开时也出声
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) { /* 旧系统没有 */ }
  }
  if (ctx.state !== 'running') ctx.resume();
}

export function audioURL(name) { return `audio/${name}.m4a`; }

async function getBuffer(name) {
  if (buffers.has(name)) {
    const b = buffers.get(name);
    buffers.delete(name); buffers.set(name, b); // 最近用过的放到最后
    return b;
  }
  const res = await fetch(audioURL(name));
  if (!res.ok) throw new Error('no recording ' + name);
  const data = await res.arrayBuffer();
  const buf = await new Promise((ok, fail) => ctx.decodeAudioData(data, ok, fail));
  buffers.set(name, buf);
  if (buffers.size > 300) buffers.delete(buffers.keys().next().value);
  return buf;
}

/** 一个带调音节对应的片段。轻声没有录音：用一声录音只放前半段、音量调低，近似「又轻又短」 */
export function syllableClip(sound, id = null, fallbackText = null) {
  const { base, tone } = split(sound);
  if (tone === 5) return { name: recordingName(base, 1), light: true, id, fallbackText };
  return { name: recordingName(base, tone), light: false, id, fallbackText };
}

function playBuffer(buf, light) {
  return new Promise((resolve) => {
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    src.connect(gain).connect(ctx.destination);
    const now = ctx.currentTime;
    let duration = buf.duration;
    if (light) {
      duration = Math.min(buf.duration * 0.6, 0.38);
      gain.gain.setValueAtTime(0.55, now);
      gain.gain.setValueAtTime(0.55, now + duration - 0.06);
      gain.gain.linearRampToValueAtTime(0, now + duration);
    }
    src.onended = resolve;
    current = src;
    src.start(now, 0, duration);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 依次播放片段：{ name, light, id } 是录音，{ pause: 秒 } 是停顿。
 * 片段带 id 时按片段高亮（逐字朗读），否则整串用 sequenceId 高亮。
 */
export async function play(clips, sequenceId = null) {
  unlock();
  stop();
  const gen = generation;
  state.sequence = sequenceId;
  notify();
  // 先把要用的录音都准备好，播放时字和字之间不卡顿
  const ready = await Promise.all(clips.map((c) => (c.name ? getBuffer(c.name).catch(() => null) : null)));
  for (let i = 0; i < clips.length; i++) {
    if (gen !== generation) return;
    const clip = clips[i];
    if (clip.pause) { await sleep(clip.pause * 1000); continue; }
    if (!ready[i]) {
      if (clip.fallbackText) { speak(clip.fallbackText, clip.id || sequenceId); return; }
      continue;
    }
    state.speakingId = clip.id || sequenceId;
    notify();
    await playBuffer(ready[i], clip.light);
  }
  if (gen === generation) finish();
}

/** 播放几个带调音节，中间停顿：拼读用长停顿，读词用短停顿 */
export function playSounds(sounds, id = null, pause = 0.35) {
  const clips = [];
  sounds.forEach((s, i) => {
    if (i > 0) clips.push({ pause });
    clips.push(syllableClip(s));
  });
  return play(clips, id);
}

export function playSound(sound, id = null, fallbackText = null) {
  return play([syllableClip(sound, null, fallbackText)], id);
}

export function playSyllable(base, tone, id = null, fallbackText = null) {
  return playSound(mark(base, tone), id, fallbackText);
}

// ---- 系统声音（只用于「整句」）----

export const speech = {
  rate: Number(localStorage.getItem('zy-rate') || 0.9),
  voiceURI: localStorage.getItem('zy-voice') || null,
};

export function mandarinVoices() {
  if (!('speechSynthesis' in window)) return [];
  return speechSynthesis.getVoices().filter((v) => v.lang.replace('_', '-').toLowerCase() === 'zh-cn');
}

export function speak(text, id = null) {
  stop();
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.rate = speech.rate;
  const voice = mandarinVoices().find((v) => v.voiceURI === speech.voiceURI);
  if (voice) u.voice = voice;
  const gen = generation;
  u.onend = u.onerror = () => { if (gen === generation) finish(); };
  state.speakingId = id;
  state.sequence = id;
  notify();
  speechSynthesis.speak(u);
}

export function stop() {
  generation += 1;
  if (current) { try { current.stop(); } catch (_) { /* 已经停了 */ } current = null; }
  if ('speechSynthesis' in window && speechSynthesis.speaking) speechSynthesis.cancel();
  if (state.speakingId || state.sequence) { state.speakingId = null; state.sequence = null; notify(); }
}

function finish() {
  current = null;
  state.speakingId = null;
  state.sequence = null;
  notify();
}

// ---- 离线：把全部录音存进缓存 ----

export async function offlineStatus(names) {
  if (!('caches' in window)) return { cached: 0, total: names.length };
  const cache = await caches.open(AUDIO_CACHE);
  const keys = new Set((await cache.keys()).map((r) => new URL(r.url).pathname.split('/').pop()));
  return { cached: names.filter((n) => keys.has(`${n}.m4a`)).length, total: names.length };
}

/** 后台逐批下载没缓存的录音，onProgress(cached, total) */
export async function cacheAll(names, onProgress) {
  if (!('caches' in window)) return;
  const cache = await caches.open(AUDIO_CACHE);
  const keys = new Set((await cache.keys()).map((r) => new URL(r.url).pathname.split('/').pop()));
  const missing = names.filter((n) => !keys.has(`${n}.m4a`));
  let done = names.length - missing.length;
  onProgress?.(done, names.length);
  for (let i = 0; i < missing.length; i += 8) {
    const batch = missing.slice(i, i + 8);
    await Promise.all(batch.map((n) => cache.add(audioURL(n)).catch(() => null)));
    done += batch.length;
    onProgress?.(done, names.length);
  }
}
