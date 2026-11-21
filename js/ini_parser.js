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
/**
 * "SavedMinimapMarks=" で始まらないのに MinimapMarks= を含む行
 * (先頭のSが欠けた壊れた行など)の件数を返す。一覧には出ないが
 * 書き戻しでは保持されるため、存在だけを知らせる用途(v0.6.9)。
 * @param {string} iniText
 * @returns {number}
 */
export function countUnrecognizedMarkLines(iniText) {
  let count = 0;
  for (const line of iniText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('SavedMinimapMarks=') && /^[A-Za-z]*MinimapMarks=/.test(trimmed)) count++;
  }
  return count;
}

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
      const entry = { rawText, parsed };
      // LocationブロックやX/Y/Zが欠けている行は、黙って座標0にせず
      // 警告フラグを付ける(呼び出し側で件数を知らせる。v0.6.9)
      const loc = parsed.Location ?? parsed.Position ?? parsed.Pos;
      const incomplete = !loc || typeof loc !== 'object'
        || ['X', 'Y', 'Z'].some((k) => loc[k] === undefined || loc[k] === '' || isNaN(Number(loc[k])));
      if (incomplete) entry.warning = true;
      results.push(entry);
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
  let escaped = false;
  let current = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escaped) { current += ch; escaped = false; continue; }
    if (inQuotes && ch === '\\') { current += ch; escaped = true; continue; }
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
      value = value.substring(1, value.length - 1).replace(/\\(.)/g, '$1');
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
 * "(...)" の中身を、最上位のカンマだけで分割する。
 * ネストした括弧と引用符(バックスラッシュエスケープ含む)を考慮する。
 * @param {string} inner - 外側の括弧を除いた中身
 * @returns {string[]} フィールド文字列の配列(各要素は "Key=Value" 形式)
 */
function splitTopLevelFields(inner) {
  const fields = [];
  let depth = 0;
  let inQuotes = false;
  let escaped = false;
  let current = '';
  for (const ch of inner) {
    if (escaped) { current += ch; escaped = false; continue; }
    if (inQuotes && ch === '\\') { current += ch; escaped = true; continue; }
    if (ch === '"') inQuotes = !inQuotes;
    if (!inQuotes) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
    }
    if (ch === ',' && depth === 0 && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current !== '') fields.push(current);
  return fields;
}

/**
 * SavedMinimapMarks行の最上位フィールドを、キー名の完全一致で
 * 更新(存在すれば置換、存在しなければ先頭へ挿入)する。
 *
 * v0.6.8で正規表現による置換から置き換えた。従来方式は
 * Name が MapName の、Color が IconColor の内側に先にマッチし、
 * フィールドの並び順によっては編集が保存されない不具合があった。
 * また置換文字列中の $ パターン展開による破損も起きない。
 * 対象外のフィールド(ID・bIsShowing等の未知フィールド)は
 * 元の文字列のまま保持される。
 * @param {string} text - 1件分のSavedMinimapMarks行
 * @param {string} key - フィールド名 (Name, Color 等)
 * @param {string} valueText - 新しい値の文字列表現(引用符や括弧を含む)
 * @returns {string}
 */
function setTopLevelField(text, key, valueText) {
  const open = text.indexOf('(');
  const close = text.lastIndexOf(')');
  if (open === -1 || close <= open) return text;

  const fields = splitTopLevelFields(text.slice(open + 1, close));
  const entry = `${key}=${valueText}`;
  const idx = fields.findIndex((f) => {
    const eq = f.indexOf('=');
    return eq !== -1 && f.slice(0, eq).trim() === key;
  });
  if (idx >= 0) fields[idx] = entry;
  else fields.unshift(entry);

  return text.slice(0, open + 1) + fields.join(',') + text.slice(close);
}

/** 引用符付き文字列値の文字列表現を作る。「\」を先にエスケープしてから
 * 「"」をエスケープする(読み込み側 parseParenObject のアンエスケープと対称)。 */
function quotedValue(value) {
  const escaped = String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/** Color=(R=...,G=...,B=...,A=...) の文字列表現を作る。 */
function colorValue(color) {
  return `(R=${color.r},G=${color.g},B=${color.b},A=${color.a})`;
}

/**
 * 編集後の parsed 内容を反映した rawText を再構築する。
 *
 * 既存のrawTextがある場合(INI/Waypoint Logから読み込んだ、または
 * 過去に一度書き出したWaypoint)は、Name/CustomTag/Location/MapName/MarkIcon/
 * Color/IconColorのみを最上位フィールド単位で置換し、ID・bIsShowing等の
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

  text = setTopLevelField(text, 'Name', quotedValue(parsed.name));
  text = setTopLevelField(text, 'CustomTag', quotedValue(parsed.customTag));
  text = setTopLevelField(text, 'MapName', quotedValue(parsed.map));
  text = setTopLevelField(text, 'MarkIcon', quotedValue(parsed.markIcon));
  text = setTopLevelField(text, 'Location', `(X=${parsed.x},Y=${parsed.y},Z=${parsed.z})`);
  if (parsed.color) text = setTopLevelField(text, 'Color', colorValue(parsed.color));
  if (parsed.iconColor) text = setTopLevelField(text, 'IconColor', colorValue(parsed.iconColor));

  return text;
}

/**
 * 現在のWaypoint一覧(GameUserSettings.iniカラムの内容)を反映した
 * INIテキスト全体を再構築する。
 *
 * 元のINIテキストから既存の "SavedMinimapMarks=" 行をすべて取り除き、
 * その最初の出現位置に、現在のWaypoint一覧のrawTextを差し込む。
 * SavedMinimapMarksが元々存在しなかった場合は、ゲームが読むセクション内へ追加する。
 * SavedMinimapMarks以外の行(他の設定項目)はすべてそのまま保持される。
 *
 * @param {string} originalIniText
 * @param {Array<{rawText: string}>} waypoints
 * @returns {string}
 */
export function rebuildIniText(originalIniText, waypoints) {
  // 元ファイルの改行コード(CRLF/LF)をそのまま使う(v0.6.9)
  const newline = originalIniText.includes('\r\n') ? '\r\n' : '\n';
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
    // SavedMinimapMarksが元々無いINIでは、ファイル末尾ではなく
    // ゲームが読む [/Script/ShooterGame.ShooterGameUserSettings] セクション内へ
    // 入れる(末尾だと [ARKASAWaypointManager] 等の別セクションに属して
    // ゲームに読まれない恐れがある。v0.6.9)
    const sectionIdx = keptLines.findIndex((l) => l.trim() === '[/Script/ShooterGame.ShooterGameUserSettings]');
    if (sectionIdx !== -1) {
      insertIndex = sectionIdx + 1;
    } else {
      const mgrIdx = keptLines.findIndex((l) => l.trim() === '[ARKASAWaypointManager]');
      if (mgrIdx !== -1) insertIndex = mgrIdx;
    }
  }

  if (insertIndex === -1) {
    return keptLines.concat(newMarkLines).join(newline);
  }

  keptLines.splice(insertIndex, 0, ...newMarkLines);
  return keptLines.join(newline);
}

/**
 * [ARKASAWaypointManager] セクションが「目印だけ」(DatabaseFile行のみ)
 * の場合に限り取り除く。このセクションは旧版が目印として書き込んでいた
 * だけで、実際には何にも使われていないため v0.6.10 で廃止した。
 * 中身が目印以外の行を含む場合は、ユーザーが転用している可能性を
 * 考えて触らない。
 * @param {string} iniText
 * @returns {{text: string, removed: boolean}}
 */
export function removeWaypointManagerSection(iniText) {
  const newline = iniText.includes('\r\n') ? '\r\n' : '\n';
  const lines = iniText.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === '[ARKASAWaypointManager]');
  if (start === -1) return { text: iniText, removed: false };

  let end = start + 1;
  const body = [];
  while (end < lines.length && !/^\s*\[.*\]\s*$/.test(lines[end])) {
    body.push(lines[end]);
    end++;
  }
  const meaningful = body.filter((l) => l.trim() !== '');
  const isMarkerOnly = meaningful.length === 1
    && /^DatabaseFile=(ARKASAWaypointManager_MyStorage\.txt|ARKASAWaypoints\.json)$/.test(meaningful[0].trim());
  if (!isMarkerOnly) return { text: iniText, removed: false };

  const kept = lines.slice(0, start).concat(lines.slice(end));
  return { text: kept.join(newline), removed: true };
}
