// =============================================================
// ini_parser.js
// GameUserSettings.ini を解析し、SavedMinimapMarks を
// Waypoint 用データへ変換するモジュール。
//
// v0.2での修正点:
// - XYZが常に0になる不具合を修正。
//   原因: 座標は "Location=(X=...,Y=...,Z=...)" というキー名で
//   格納されているが、v0.1では候補キーに "Location" が
//   含まれていなかったため取得に失敗していた。
// - 「X=」「Y=」「Z=」を単純な文字列検索で取得することは禁止。
//   必ず "Location=(...)" のブロックを抽出してから、その内部を
//   再帰的にパースする方式のみを用いる(parseParenObjectが担う)。
// - 出力形式を { rawText, parsed } のネスト構造に変更し、
//   RawTextを正としたデータ保持方針に統一した。
// =============================================================

/**
 * INIテキスト全体から SavedMinimapMarks 行を抽出する。
 * @param {string} iniText - GameUserSettings.ini の内容
 * @returns {Array<{rawText: string, parsed: object}>} 生の解析結果(キー名はゲーム内表記のまま)
 */
export function parseSavedMinimapMarks(iniText) {
  const lines = iniText.split(/\r?\n/);
  const results = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('SavedMinimapMarks=')) continue;

    const rawText = line; // 元の行はそのまま保持し、将来のINI再生成に使用する
    const valuePart = trimmed.substring('SavedMinimapMarks='.length);

    try {
      const parsed = parseParenObject(valuePart);
      results.push({ rawText, parsed });
    } catch (err) {
      // 1行の解析に失敗しても他の行の処理は続行する
      console.error('SavedMinimapMarks行の解析に失敗しました:', line, err);
    }
  }

  return results;
}

/**
 * "(Key=Value,Key2=(Nested=1))" 形式の文字列を
 * 再帰的にJavaScriptオブジェクトへ変換する。
 * ネストされた丸括弧(例: Location=(...), Color=(...))も
 * この再帰処理により正しくオブジェクト化される。
 * @param {string} str
 * @returns {object}
 */
function parseParenObject(str) {
  str = str.trim();
  if (str.startsWith('(') && str.endsWith(')')) {
    str = str.substring(1, str.length - 1);
  }

  // 括弧の深さと引用符の中を考慮しつつ、最上位のカンマだけで分割する
  const pairs = [];
  let depth = 0;
  let inQuotes = false;
  let current = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '"') inQuotes = !inQuotes;
    if (!inQuotes) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
    }
    if (ch === ',' && depth === 0 && !inQuotes) {
      pairs.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim() !== '') pairs.push(current);

  const obj = {};
  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) continue;

    const key = pair.substring(0, eqIndex).trim();
    let value = pair.substring(eqIndex + 1).trim();

    if (value.startsWith('(') && value.endsWith(')')) {
      value = parseParenObject(value);
    } else if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value !== '' && !isNaN(Number(value))) {
      value = Number(value);
    }

    obj[key] = value;
  }

  return obj;
}

/**
 * 単一のオブジェクトから候補キー配列を優先順位順に探索する
 */
function pick(obj, keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
  }
  return undefined;
}

function toNumber(v, fallback = 0) {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

/**
 * parseSavedMinimapMarks() の解析結果を Waypoint用の parsed オブジェクトへ変換する。
 *
 * 座標は必ず "Location=(X=...,Y=...,Z=...)" ブロックから取得する。
 * "Location" が見つからない古い形式・別バージョン対応のため、
 * Position / Pos も候補として残すが、優先順位はLocationを最上位とする。
 * Color / IconColor も同様に、必ずそれぞれのネストブロックから
 * R/G/B/Aを取得する(v0.3.4で追加)。
 *
 * @param {{rawText: string, parsed: object}} entry
 * @returns {{name:string, map:string, x:number, y:number, z:number, customTag:string, markIcon:string,
 *            color:{r:number,g:number,b:number,a:number}, iconColor:{r:number,g:number,b:number,a:number}}}
 */
export function convertToWaypointData(entry) {
  const p = entry.parsed;

  const name = pick(p, ['Name', 'MarkerLabel', 'Label']) ?? '';
  const map = pick(p, ['MapName', 'Map', 'Level']) ?? '';

  // 座標ブロックは必ず "Location=(...)" のネストオブジェクトから取得する
  const location = pick(p, ['Location', 'Position', 'Pos']) ?? {};
  const x = toNumber(pick(location, ['X']));
  const y = toNumber(pick(location, ['Y']));
  const z = toNumber(pick(location, ['Z']));

  const customTag = pick(p, ['CustomTag', 'MarkerTag', 'Tag']) ?? '';
  const markIcon = pick(p, ['MarkIcon', 'MarkerType', 'Icon', 'ImageIndex']) ?? '';

  const color = extractColor(pick(p, ['Color']));
  const iconColor = extractColor(pick(p, ['IconColor']));

  return {
    name: String(name),
    map: String(map),
    x, y, z,
    customTag: String(customTag),
    markIcon: String(markIcon),
    color,
    iconColor,
  };
}

/**
 * Color=(R=...,G=...,B=...,A=...) ブロックをパースする。
 * ブロックが存在しない場合は不透明の白(未設定)を返す。
 * @param {object|undefined} colorBlock
 * @returns {{r:number,g:number,b:number,a:number}}
 */
function extractColor(colorBlock) {
  if (!colorBlock || typeof colorBlock !== 'object') return { r: 1, g: 1, b: 1, a: 1 };
  return {
    r: toNumber(pick(colorBlock, ['R']), 1),
    g: toNumber(pick(colorBlock, ['G']), 1),
    b: toNumber(pick(colorBlock, ['B']), 1),
    a: toNumber(pick(colorBlock, ['A']), 1),
  };
}

/**
 * 引用符付き文字列フィールド(例: Name="...")を、指定した行テキスト内で
 * 更新(存在すれば置換、存在しなければ挿入)する。
 * 正規表現によるブロック単位の置換のみを行い、それ以外の部分
 * (Color, ID, bIsShowing 等の未知のフィールド)は一切変更しない。
 * @param {string} text - 1件分のSavedMinimapMarks行(またはその値部分)
 * @param {string} key - フィールド名 (Name, CustomTag, MapName, MarkIcon)
 * @param {string} value - 新しい値
 * @returns {string}
 */
function upsertQuotedField(text, key, value) {
  const re = new RegExp(`${key}="[^"]*"`);
  const escaped = String(value ?? '').replace(/"/g, '\\"');
  const replacement = `${key}="${escaped}"`;

  if (re.test(text)) {
    return text.replace(re, replacement);
  }
  // 既存フィールドがない場合は、開始の "(" の直後に挿入する
  return text.replace('(', `(${replacement},`);
}

/**
 * Location=(X=...,Y=...,Z=...) ブロックを更新(存在すれば置換、なければ挿入)する。
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {string}
 */
function upsertLocationField(text, x, y, z) {
  const re = /Location=\([^)]*\)/;
  const replacement = `Location=(X=${x},Y=${y},Z=${z})`;

  if (re.test(text)) return text.replace(re, replacement);
  return text.replace('(', `(${replacement},`);
}

/**
 * Color=(R=...,G=...,B=...,A=...) / IconColor=(...) ブロックを
 * 更新(存在すれば置換、なければ挿入)する。
 * @param {string} text
 * @param {string} key - 'Color' または 'IconColor'
 * @param {{r:number,g:number,b:number,a:number}} color
 * @returns {string}
 */
function upsertColorField(text, key, color) {
  const re = new RegExp(`${key}=\\([^)]*\\)`);
  const replacement = `${key}=(R=${color.r},G=${color.g},B=${color.b},A=${color.a})`;

  if (re.test(text)) return text.replace(re, replacement);
  return text.replace('(', `(${replacement},`);
}

/**
 * 編集後の parsed 内容を反映した rawText を再構築する。
 *
 * 既存のrawTextがある場合(INI/Waypoint Logから読み込んだ、または
 * 過去に一度書き出したWaypoint)は、Name/CustomTag/Location/MapName/MarkIcon/
 * Color/IconColorのみを正規表現でピンポイント置換し、ID・bIsShowing等の
 * 未知フィールドはそのまま保持する(RawTextを正としたデータ保持方針)。
 *
 * rawTextが空(手動追加された新規Waypoint)の場合は、
 * 最小限のSavedMinimapMarks行を新規生成する。
 *
 * @param {string} originalRawText
 * @param {{name:string, map:string, x:number, y:number, z:number, customTag:string, markIcon:string,
 *          color?:{r:number,g:number,b:number,a:number}, iconColor?:{r:number,g:number,b:number,a:number}}} parsed
 * @returns {string}
 */
export function buildRawText(originalRawText, parsed) {
  let text = originalRawText && originalRawText.trim() !== ''
    ? originalRawText
    : 'SavedMinimapMarks=()';

  text = upsertQuotedField(text, 'Name', parsed.name);
  text = upsertQuotedField(text, 'CustomTag', parsed.customTag);
  text = upsertQuotedField(text, 'MapName', parsed.map);
  text = upsertQuotedField(text, 'MarkIcon', parsed.markIcon);
  text = upsertLocationField(text, parsed.x, parsed.y, parsed.z);
  if (parsed.color) text = upsertColorField(text, 'Color', parsed.color);
  if (parsed.iconColor) text = upsertColorField(text, 'IconColor', parsed.iconColor);

  // 挿入処理により生じる可能性のある不要なカンマ(",)"など)を整理する
  text = text.replace(/,\s*\)/g, ')').replace(/\(\s*,/g, '(');

  return text;
}

/**
 * 現在のWaypoint一覧(GameUserSettings.iniカラムの内容)を反映した
 * INIテキスト全体を再構築する。
 *
 * 元のINIテキストから既存の "SavedMinimapMarks=" 行をすべて取り除き、
 * その最初の出現位置に、現在のWaypoint一覧のrawTextを差し込む。
 * SavedMinimapMarksが元々存在しなかった場合は、ファイル末尾に追加する。
 * SavedMinimapMarks以外の行(他の設定項目)はすべてそのまま保持される。
 *
 * @param {string} originalIniText
 * @param {Array<{rawText: string}>} waypoints
 * @returns {string}
 */
export function rebuildIniText(originalIniText, waypoints) {
  const lines = originalIniText.split(/\r?\n/);
  const keptLines = [];
  let insertIndex = -1;

  for (const line of lines) {
    if (line.trim().startsWith('SavedMinimapMarks=')) {
      if (insertIndex === -1) insertIndex = keptLines.length;
      // この行はいったん除去し、後で現在の一覧から生成した行に差し替える
      continue;
    }
    keptLines.push(line);
  }

  const newMarkLines = waypoints.map((wp) => wp.rawText);

  if (insertIndex === -1) {
    return keptLines.concat(newMarkLines).join('\n');
  }

  keptLines.splice(insertIndex, 0, ...newMarkLines);
  return keptLines.join('\n');
}

/**
 * [ARKASAWaypointManager] セクションの有無を確認し、
 * 存在しない場合はINIテキスト末尾へ追加する。
 * 既に存在する場合は変更しない(重複追加を防止)。
 * @param {string} iniText
 * @returns {{text: string, added: boolean}}
 */
export function ensureWaypointManagerSection(iniText) {
  if (iniText.includes('[ARKASAWaypointManager]')) {
    return { text: iniText, added: false };
  }

  const needsNewline = iniText.length > 0 && !iniText.endsWith('\n');
  // v0.3.6より My Storage は ARKASAWaypointManager_MyStorage.txt
  // (プレーンテキスト形式)で保存するため、DatabaseFileの参照先もそれに合わせる。
  const section = `${needsNewline ? '\n' : ''}\n[ARKASAWaypointManager]\nDatabaseFile=ARKASAWaypointManager_MyStorage.txt\n`;

  return { text: iniText + section, added: true };
}
