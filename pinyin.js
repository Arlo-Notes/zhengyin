// 拼音规则和汉字转拼音。不依赖浏览器，Node 测试也能直接用。

const MARKS = {
  'ā': ['a', 1], 'á': ['a', 2], 'ǎ': ['a', 3], 'à': ['a', 4],
  'ē': ['e', 1], 'é': ['e', 2], 'ě': ['e', 3], 'è': ['e', 4],
  'ī': ['i', 1], 'í': ['i', 2], 'ǐ': ['i', 3], 'ì': ['i', 4],
  'ō': ['o', 1], 'ó': ['o', 2], 'ǒ': ['o', 3], 'ò': ['o', 4],
  'ū': ['u', 1], 'ú': ['u', 2], 'ǔ': ['u', 3], 'ù': ['u', 4],
  'ǖ': ['ü', 1], 'ǘ': ['ü', 2], 'ǚ': ['ü', 3], 'ǜ': ['ü', 4],
};
const TONED = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', 'ü': 'ǖǘǚǜ' };

export const TONE_NAMES = { 1: '一声', 2: '二声', 3: '三声', 4: '四声', 5: '轻声' };

/** 'hǎo' -> { base: 'hao', tone: 3 }；轻声 tone 为 5 */
export function split(syllable) {
  let base = '';
  let tone = 5;
  for (const ch of syllable) {
    const m = MARKS[ch];
    if (m) { base += m[0]; tone = m[1]; } else { base += ch; }
  }
  return { base, tone };
}

/** ('hao', 3) -> 'hǎo'。有 a 标 a，没 a 找 o、e，iu、ui 标在后一个字母上 */
export function mark(base, tone) {
  if (!(tone >= 1 && tone <= 4)) return base;
  const letters = Array.from(base);
  let idx = letters.indexOf('a');
  if (idx < 0) idx = letters.indexOf('e');
  if (idx < 0 && base.includes('ou')) idx = letters.indexOf('o');
  if (idx < 0) {
    for (let i = letters.length - 1; i >= 0; i--) if (TONED[letters[i]]) { idx = i; break; }
  }
  if (idx < 0) return base;
  letters[idx] = TONED[letters[idx]][tone - 1];
  return letters.join('');
}

/** 声母 + 韵母按拼写规则拼成音节：j q x y 后的 ü 写成 u，y、w 开头省写 i、u */
export function spell(initial, final) {
  let f = final;
  if (['j', 'q', 'x', 'y'].includes(initial) && f.startsWith('ü')) f = 'u' + f.slice(1);
  if (initial === 'y') {
    if (f === 'iu') f = 'ou';
    else if (f.startsWith('i') && !['i', 'in', 'ing'].includes(f)) f = f.slice(1);
  }
  if (initial === 'w') {
    if (f === 'ui') f = 'ei';
    else if (f === 'un') f = 'en';
    else if (f === 'ueng') f = 'eng';
    else if (f.startsWith('u') && f !== 'u') f = f.slice(1);
  }
  return initial + f;
}

/** 录音文件名（不含扩展名）：ü 写作 v，比如 lü 三声 -> 'lv3' */
export function recordingName(base, tone) {
  return base.replace(/ü/g, 'v') + tone;
}

/** 多音字：除轻声外有两个以上读音（“巴掌”的“掌”读轻声不算） */
export function isPolyphonic(readings) {
  return new Set(readings.filter((r) => split(r).tone !== 5)).size > 1;
}

/** 汉字转拼音：正向最大匹配找词组，词组里的多音字按词定音，其余用单字默认读音 */
export class Converter {
  constructor(hanziText, phrasesText) {
    this.hanzi = new Map();
    for (const line of hanziText.split('\n')) {
      const tab = line.indexOf('\t');
      if (tab > 0) this.hanzi.set(line.slice(0, tab), line.slice(tab + 1).split(','));
    }
    this.phrases = new Map();
    this.maxLen = 1;
    for (const line of phrasesText.split('\n')) {
      const tab = line.indexOf('\t');
      if (tab <= 0) continue;
      const word = line.slice(0, tab);
      this.phrases.set(word, line.slice(tab + 1).split(' '));
      const len = Array.from(word).length;
      if (len > this.maxLen) this.maxLen = len;
    }
  }

  /** 返回 [{ id, text, readings, reading, fromPhrase }]；非汉字的 reading 为 null */
  convert(text) {
    const chars = Array.from(text);
    const tokens = [];
    let i = 0;
    while (i < chars.length) {
      const ch = chars[i];
      const readings = this.hanzi.get(ch);
      if (!readings) {
        tokens.push({ id: i, text: ch, readings: [], reading: null, fromPhrase: false });
        i += 1;
        continue;
      }
      let matched = false;
      const limit = Math.min(this.maxLen, chars.length - i);
      for (let len = limit; len >= 2; len--) {
        const syllables = this.phrases.get(chars.slice(i, i + len).join(''));
        if (syllables) {
          syllables.forEach((syl, k) => {
            const c = chars[i + k];
            tokens.push({ id: i + k, text: c, readings: this.hanzi.get(c) || [syl], reading: syl, fromPhrase: true });
          });
          i += len;
          matched = true;
          break;
        }
      }
      if (!matched) {
        tokens.push({ id: i, text: ch, readings, reading: readings[0], fromPhrase: false });
        i += 1;
      }
    }
    return tokens;
  }

  pinyin(text) {
    return this.convert(text).filter((t) => t.reading).map((t) => t.reading).join(' ');
  }
}
