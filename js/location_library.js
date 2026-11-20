// =============================================================
// location_library.js
// Location Library(単一のWaypointデータベース)の読み書きを担当するモジュール。
//
// v0.3.4での変更:
// 「Location Libraryはカテゴリ別ファイルへ分割しません。1つのWaypoint
//  データベースとして扱ってください」という要件のため、v0.3.3までの
// 「フォルダを再帰スキャンし、カテゴリ別に分割されたJSONファイルを
//  複数読み込む」方式を廃止し、My Storageと同様の単一JSONファイル
// (waypoints.json)を読み書きする方式へ変更した。
//
// フォーマット:
//   { "waypoints": [ { "rawText": "SavedMinimapMarks=(...)", "map": "...", "category": "..." }, ... ] }
//
// RawTextはARKのSavedMinimapMarks形式そのものであり、Map/Categoryを
// 内包できないため(Categoryは元々ARK側の概念に存在しない)、
// 各Waypointの属性として個別に保持する。Mapは通常RawText内の
// MapNameと一致するが、手動追加時など未設定の場合に備えて
// 明示的に保持している。
//
// v0.3.4よりLocation LibraryはMy Storageと同じく編集可能なリストとして
// 扱う(Add/Edit/Delete/Save)。読み取り専用という制約は撤廃した。
// =============================================================

import { parseSavedMinimapMarks, convertToWaypointData } from './ini_parser.js';
import { createWaypoint } from './waypoint.js';

/** 空のLocation Library構造を生成する。 */
export function createEmptyLibrary() {
  return { waypoints: [] };
}

/**
 * Waypoint配列(rawText/parsed/source構造)をLocation Library用のJSON文字列へ
 * シリアライズする。Map/Categoryを各エントリの属性として明示的に保存する。
 * @param {object[]} waypoints
 * @returns {string} 整形済みJSON文字列
 */
export function serializeLibrary(waypoints) {
  const payload = {
    waypoints: waypoints.map((wp) => ({
      rawText: wp.rawText ?? '',
      map: wp.parsed.map ?? '',
      category: wp.parsed.category ?? '',
    })),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Location Library(waypoints.json)のテキストをパースし、Waypointモデルの
 * 配列を返す。1件ごとに独立してRawTextを解析するため、一部の行が不正な
 * 形式であっても他のWaypointの読み込みには影響しない
 * (「ファイル追加のみで利用可能」という既存方針を単一ファイル内の
 *  各エントリにも適用している)。
 * @param {string} jsonText
 * @returns {object[]} Waypointモデル配列
 */
export function parseLibrary(jsonText) {
  if (!jsonText || jsonText.trim() === '') return [];

  let data;
  try {
    data = JSON.parse(jsonText);
  } catch (err) {
    throw new Error('waypoints.jsonのJSON構文が不正です: ' + err.message);
  }
  if (!data || !Array.isArray(data.waypoints)) {
    throw new Error('waypoints.jsonの構造が不正です(waypoints配列がありません)。');
  }

  const list = [];
  for (const entry of data.waypoints) {
    const rawText = typeof entry === 'string' ? entry : entry?.rawText;
    if (!rawText || rawText.trim() === '') continue;

    const parsedEntries = parseSavedMinimapMarks(rawText);
    if (parsedEntries.length === 0) continue; // 解析できない行はスキップ(全体は継続)

    const parsed = convertToWaypointData(parsedEntries[0]);
    if (typeof entry === 'object') {
      if (entry.map) parsed.map = String(entry.map);
      parsed.category = String(entry.category ?? '').trim();
    } else {
      parsed.category = '';
    }

    list.push(createWaypoint({ rawText: parsedEntries[0].rawText, parsed, source: 'LocationLibrary' }));
  }

  return list;
}
