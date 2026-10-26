// 拼音表内容：每个格子 = 字母 + 例字（像墙上的拼音挂图），点格子放例字的真人读音。
// sound：点格子时放的录音（就是例字的读音）；pure：拼读时用的纯音（声母念呼读音，韵母念一声），不写就和 sound 相同；
// blendable=false：不能单独念出来参与拼读（ong）。

const item = (symbol, char, sound, extra = {}) => ({ symbol, char, sound, ...extra });

export const TONES = [
  { tone: 1, example: 'mā', char: '妈', rhyme: '一声平', mark: 'ˉ' },
  { tone: 2, example: 'má', char: '麻', rhyme: '二声扬', mark: 'ˊ' },
  { tone: 3, example: 'mǎ', char: '马', rhyme: '三声拐弯', mark: 'ˇ' },
  { tone: 4, example: 'mà', char: '骂', rhyme: '四声降', mark: 'ˋ' },
];

/** 声母 23 个。例字用《汉语拼音方案》的呼读字，n 用更常见的「呢」 */
export const INITIALS = [
  item('b', '玻', 'bō'), item('p', '坡', 'pō'), item('m', '摸', 'mō'), item('f', '佛', 'fó', { pure: 'fō' }),
  item('d', '得', 'dé', { pure: 'dē' }), item('t', '特', 'tè', { pure: 'tē' }), item('n', '呢', 'nē'), item('l', '乐', 'lè', { pure: 'lē' }),
  item('g', '哥', 'gē'), item('k', '科', 'kē'), item('h', '喝', 'hē'),
  item('j', '鸡', 'jī'), item('q', '七', 'qī'), item('x', '西', 'xī'),
  item('zh', '知', 'zhī'), item('ch', '吃', 'chī'), item('sh', '诗', 'shī'), item('r', '日', 'rì', { pure: 'rī' }),
  item('z', '资', 'zī'), item('c', '词', 'cí', { pure: 'cī' }), item('s', '思', 'sī'),
  item('y', '衣', 'yī'), item('w', '乌', 'wū'),
];

/** 韵母 24 个：单韵母 6、复韵母 9、鼻韵母 9。eng、ong 没有单独成字的，借「灯」「钟」 */
export const FINALS = [
  item('a', '啊', 'ā'), item('o', '喔', 'ō'), item('e', '鹅', 'é', { pure: 'ē' }),
  item('i', '衣', 'yī'), item('u', '乌', 'wū'), item('ü', '鱼', 'yú', { pure: 'yū' }),
  item('ai', '爱', 'ài', { pure: 'āi' }), item('ei', '诶', 'ēi'), item('ui', '威', 'wēi'),
  item('ao', '袄', 'ǎo', { pure: 'āo' }), item('ou', '欧', 'ōu'), item('iu', '优', 'yōu'),
  item('ie', '椰', 'yē'), item('üe', '月', 'yuè', { pure: 'yuē' }), item('er', '儿', 'ér'),
  item('an', '安', 'ān'), item('en', '恩', 'ēn'), item('in', '音', 'yīn'),
  item('un', '温', 'wēn'), item('ün', '云', 'yún', { pure: 'yūn' }),
  item('ang', '昂', 'áng', { pure: 'āng' }), item('eng', '灯', 'dēng', { pure: 'ēng' }),
  item('ing', '鹰', 'yīng'), item('ong', '钟', 'zhōng', { blendable: false }),
];

export const FINAL_GROUPS = [
  ['单韵母', FINALS.slice(0, 6)],
  ['复韵母', FINALS.slice(6, 15)],
  ['鼻韵母', FINALS.slice(15)],
];

/** 整体认读音节 16 个：整个记住，不用拆开拼 */
export const WHOLE = [
  item('zhi', '知', 'zhī'), item('chi', '吃', 'chī'), item('shi', '狮', 'shī'), item('ri', '日', 'rì'),
  item('zi', '字', 'zì'), item('ci', '刺', 'cì'), item('si', '丝', 'sī'), item('yi', '衣', 'yī'),
  item('wu', '屋', 'wū'), item('yu', '鱼', 'yú'), item('ye', '叶', 'yè'), item('yue', '月', 'yuè'),
  item('yuan', '圆', 'yuán'), item('yin', '音', 'yīn'), item('yun', '云', 'yún'), item('ying', '鹰', 'yīng'),
];

/** 拼一拼里带 i、u、ü 的韵母 */
export const MEDIAL_FINALS = [
  item('ia', '鸭', 'yā'), item('iao', '腰', 'yāo'), item('ian', '烟', 'yān'), item('iang', '央', 'yāng'),
  item('iong', '拥', 'yōng'), item('ua', '挖', 'wā'), item('uo', '窝', 'wō'), item('uai', '歪', 'wāi'),
  item('uan', '弯', 'wān'), item('uang', '汪', 'wāng'), item('üan', '冤', 'yuān'),
];

export const BLEND_FINALS = FINALS.filter((f) => f.symbol !== 'er');

/** 拼读用的音：pure 优先；不能单独念的返回 null */
export function blendSound(it) {
  return it.blendable === false ? null : (it.pure || it.sound);
}

export const ALL_ITEMS = [...INITIALS, ...FINALS, ...WHOLE, ...MEDIAL_FINALS];
