// =============================================================
// waypoint.js
// Waypoint データモデルと検証ロジック
//
// v0.3.4でのモデル変更:
// parsed に color / iconColor ({r,g,b,a}、各0〜1)を追加した。
// ARKのSavedMinimapMarksにおける Color=(...) / IconColor=(...) に対応する。
//
// rawTextを正(せい)としたデータ保持方針に変更したため、
// 表示・検索・編集に使う情報はすべて parsed 配下にまとめる。
// source は、このWaypointが現在どのリストに属しているかを示す。
//   "GameUserSettings" | "Storage" | "LocationLibrary" | "Log"
// =============================================================

let idCounter = 0;

/** 未設定時のデフォルト色(不透明の白)。ARKの既定に近い中立色として採用している。 */
export function defaultColor() {
  return { r: 1, g: 1, b: 1, a: 1 };
}

/**
 * Waypointオブジェクトを生成する。
 * 不足フィールドはデフォルト値で補完される。
 * @param {object} data - { id?, rawText?, parsed?, source? } または
 *                          v0.1形式のフラットなデータも受け付ける(移行用)
 * @returns {object} Waypoint
 */
export function createWaypoint(data = {}) {
  // v0.1形式(フラット構造)からの移行を許容する
  const flatParsed = data.parsed ?? {
    name: data.name,
    map: data.map,
    x: data.x,
    y: data.y,
    z: data.z,
    customTag: data.customTag,
    markIcon: data.markIcon,
  };

  return {
    id: data.id ?? generateId(),
    rawText: data.rawText ?? '',
    parsed: {
      name: flatParsed.name ?? '',
      map: flatParsed.map ?? '',
      x: toFiniteNumber(flatParsed.x),
      y: toFiniteNumber(flatParsed.y),
      z: toFiniteNumber(flatParsed.z),
      customTag: flatParsed.customTag ?? '',
      markIcon: flatParsed.markIcon ?? '',
      category: flatParsed.category ?? '', // Location Library等で使用するカテゴリ
      color: normalizeColor(flatParsed.color),
      iconColor: normalizeColor(flatParsed.iconColor),
    },
    source: data.source ?? 'Storage',
    libraryPath: data.libraryPath ?? null, // Location Library由来の場合、そのファイルパス
  };
}

/** color/iconColorの入力を { r, g, b, a } (各0〜1の数値) へ正規化する */
function normalizeColor(c) {
  if (!c || typeof c !== 'object') return defaultColor();
  return {
    r: toFiniteNumberInRange(c.r, 1),
    g: toFiniteNumberInRange(c.g, 1),
    b: toFiniteNumberInRange(c.b, 1),
    a: toFiniteNumberInRange(c.a, 1),
  };
}

function toFiniteNumberInRange(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function toFiniteNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function generateId() {
  idCounter += 1;
  return `wp_${Date.now()}_${idCounter}`;
}

/**
 * Waypointのparsedフォームの入力値を検証する。
 * @param {object} parsed - { name, x, y, z, ... }
 * @returns {string[]} エラーメッセージ配列(空配列なら正常)
 */
export function validateWaypoint(parsed) {
  const errors = [];

  if (!parsed.name || String(parsed.name).trim() === '') {
    errors.push('Name は必須です。');
  }
  if (parsed.x === '' || isNaN(Number(parsed.x))) errors.push('X は数値である必要があります。');
  if (parsed.y === '' || isNaN(Number(parsed.y))) errors.push('Y は数値である必要があります。');
  if (parsed.z === '' || isNaN(Number(parsed.z))) errors.push('Z は数値である必要があります。');

  return errors;
}

/**
 * 2つのWaypointが同一座標(Map + X + Y + Z)を示すかどうかを判定する。
 * Waypoint選択同期ハイライトおよび座標衝突確認で共通利用する。
 * @param {object} a - Waypoint (rawText/parsed/source構造)
 * @param {object} b - Waypoint
 * @returns {boolean}
 */
export function isSameLocation(a, b) {
  if (!a || !b) return false;
  return (
    a.parsed.map === b.parsed.map &&
    a.parsed.x === b.parsed.x &&
    a.parsed.y === b.parsed.y &&
    a.parsed.z === b.parsed.z
  );
}

/**
 * 2つのWaypointが同一CustomTagを持つかどうかを判定する。
 * 空のCustomTag同士は「未設定」とみなし、衝突扱いしない。
 * @param {object} a
 * @param {object} b
 * @returns {boolean}
 */
export function isSameCustomTag(a, b) {
  if (!a || !b) return false;
  const tagA = (a.parsed.customTag ?? '').trim();
  const tagB = (b.parsed.customTag ?? '').trim();
  if (tagA === '' || tagB === '') return false;
  return tagA === tagB;
}

/**
 * 指定したリスト内で重複しないCustomTag名を生成する。
 * 例: "Waypoint" が既に存在する場合 → "Waypoint2" → "Waypoint3" ...
 * @param {string} baseTag
 * @param {object[]} list - 既存Waypoint配列
 * @returns {string}
 */
export function generateUniqueTag(baseTag, list) {
  const existingTags = new Set(list.map((w) => (w.parsed.customTag ?? '').trim()));
  if (!existingTags.has(baseTag)) return baseTag;

  let n = 2;
  while (existingTags.has(`${baseTag}${n}`)) n += 1;
  return `${baseTag}${n}`;
}
