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

import { clamp01 } from './util.js';

let idCounter = 0;

/** 未設定時のデフォルト色(不透明の白)。ARKの既定に近い中立色として採用している。 */
export function defaultColor() {
  return { r: 1, g: 1, b: 1, a: 1 };
}

/**
 * Waypointオブジェクトを生成する。
 * 不足フィールドはデフォルト値で補完される。
 * @param {object} data - { id?, rawText?, parsed? }
 * @returns {object} Waypoint
 */
export function createWaypoint(data = {}) {
  const src = data.parsed ?? {};

  return {
    id: data.id ?? generateId(),
    rawText: data.rawText ?? '',
    parsed: {
      name: src.name ?? '',
      map: src.map ?? '',
      x: toFiniteNumber(src.x),
      y: toFiniteNumber(src.y),
      z: toFiniteNumber(src.z),
      customTag: src.customTag ?? '',
      markIcon: src.markIcon ?? '',
      category: src.category ?? '', // Location Library等で使用するカテゴリ
      nameJa: src.nameJa ?? '', // Location Libraryの日本語名(表示言語が日本語のとき表示に使う)
      color: normalizeColor(src.color),
      iconColor: normalizeColor(src.iconColor),
    },
  };
}

/** color/iconColorの入力を { r, g, b, a } (各0〜1の数値) へ正規化する */
function normalizeColor(c) {
  if (!c || typeof c !== 'object') return defaultColor();
  return {
    r: clamp01(c.r),
    g: clamp01(c.g),
    b: clamp01(c.b),
    a: clamp01(c.a),
  };
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
  if (!parsed.map || String(parsed.map).trim() === '') {
    errors.push('MapName は必須です。');
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
