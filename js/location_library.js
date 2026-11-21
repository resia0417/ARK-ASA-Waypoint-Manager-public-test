// =============================================================
// location_library.js
// Location Library(収録Waypointデータベース)の読み込みを担当するモジュール。
//
// Location Libraryは固定データとして扱う: 起動時に同梱の
// location_library.json を初期表示し、利用者が自分のファイルを
// 選んだ場合はそちらを読み込む。アプリ内での編集・保存は行わない。
//
// フォーマット:
//   { "waypoints": [ { "rawText": "SavedMinimapMarks=(...)", "map": "...", "category": "..." }, ... ] }
//
// RawTextはARKのSavedMinimapMarks形式そのものであり、Map/Categoryを
// 内包できないため(Categoryは元々ARK側の概念に存在しない)、
// 各Waypointの属性として個別に保持する。Mapは通常RawText内の
// MapNameと一致するが、未設定の場合に備えて明示的に保持している。
// =============================================================

import { parseSavedMinimapMarks, convertToWaypointData } from './ini_parser.js';
import { t } from './i18n.js';
import { createWaypoint } from './waypoint.js';

/**
 * Location Library(JSON)のテキストをパースし、Waypointモデルの
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
    throw new Error(t('error.libraryJsonSyntax', { error: err.message }));
  }
  if (!data || !Array.isArray(data.waypoints)) {
    throw new Error(t('error.libraryJsonStructure'));
  }

  const list = [];
  for (const entry of data.waypoints) {
    const rawText = typeof entry === 'string' ? entry : entry?.rawText;
    if (!rawText || rawText.trim() === '') continue;

    const parsedEntries = parseSavedMinimapMarks(rawText);
    if (parsedEntries.length === 0) continue; // 解析できない行はスキップ(全体は継続)

    const parsed = convertToWaypointData(parsedEntries[0]);
    if (typeof entry === 'object') {
      // entry.map は rawText に MapName が無い場合の予備としてのみ使う。
      // rawText 側を上書きすると、コピー時に rawText の MapName と
      // 食い違ってしまうため(v0.6.9)
      if (entry.map && (!parsed.map || parsed.map.trim() === '')) parsed.map = String(entry.map);
      parsed.category = String(entry.category ?? '').trim();
      parsed.nameJa = String(entry.nameJa ?? '').trim();
    } else {
      parsed.category = '';
    }

    list.push(createWaypoint({ rawText: parsedEntries[0].rawText, parsed, source: 'LocationLibrary' }));
  }

  return list;
}
