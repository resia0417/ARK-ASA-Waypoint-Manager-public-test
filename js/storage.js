// =============================================================
// storage.js
// My Storage(ARKASAWaypointManager_MyStorage.txt)の読み書きを担当する。
//
// v0.3.6でのフォーマット変更:
// 旧: ARKASAWaypoints.json ({ version:1, waypoints:["SavedMinimapMarks=(...)"] })
// 新: ARKASAWaypointManager_MyStorage.txt (UTF-8プレーンテキスト、1行1Waypoint)
//
// ```text
// SavedMinimapMarks=(Name="Metal",CustomTag="Waypoint",Location=(...),...)
// SavedMinimapMarks=(Name="Crystal",CustomTag="Waypoint",Location=(...),...)
// ```
//
// JSON形式は使用しない(要件「JSONのような保存形式は禁止」への対応)。
// GameUserSettings.iniと全く同じ行形式・同じParser(ini_parser.js)を
// 利用することで、GameUserSettings.iniとの間でテキストをそのまま
// コピー&ペーストできる互換性を持たせている。
//
// この採用理由(要件より):
// - GameUserSettings.iniへそのままコピーできる/貼り付けできる
// - JSONの記号を除去する変換が不要
// - メモ帳等のテキストエディタだけで編集・バックアップできる
//
// 重要な設計方針:
// Waypointデータ本体は localStorage / IndexedDB へは保存しない。
// 正式なデータストアは常に ARKASAWaypointManager_MyStorage.txt ファイル
// 自身である。localStorage / IndexedDB は「前回開いたファイルの情報」
// (File System Access API のファイルハンドル)のみを保持する。
// これは file_manager.js が担当する。
// =============================================================

import { parseSavedMinimapMarks, convertToWaypointData } from './ini_parser.js';
import { createWaypoint } from './waypoint.js';

/** My Storageの既定ファイル名(v0.3.6より)。 */
export const STORAGE_FILE_NAME = 'ARKASAWaypointManager_MyStorage.txt';

/**
 * Waypoint配列(rawText/parsed/source構造)を、1行1WaypointのSavedMinimapMarks
 * テキストへシリアライズする。RawTextが空(手動追加直後で未生成)の
 * エントリは書き出し対象から除外する。
 * @param {object[]} waypoints
 * @returns {string} 改行区切りのプレーンテキスト
 */
export function serializeStorage(waypoints) {
  const lines = waypoints
    .map((wp) => wp.rawText)
    .filter((line) => typeof line === 'string' && line.trim() !== '');
  // 末尾に改行を1つ付けておく(一般的なテキストファイルの慣習に合わせる)
  return lines.length > 0 ? lines.join('\n') + '\n' : '';
}

/**
 * My Storage(プレーンテキスト)の内容をパースし、Waypointモデルの配列を返す。
 * 要件通り、GameUserSettings.iniと全く同じParser(ini_parser.js)を利用する。
 * - 空行は無視する
 * - "SavedMinimapMarks=" で始まる行のみを読み込む(ini_parser.jsの
 *   parseSavedMinimapMarks自体がこの判定を行う)
 * @param {string} text
 * @returns {object[]} Waypointモデル配列
 */
export function parseStorage(text) {
  if (!text || text.trim() === '') return [];

  const entries = parseSavedMinimapMarks(text);
  return entries.map((e) =>
    createWaypoint({ rawText: e.rawText, parsed: convertToWaypointData(e), source: 'Storage' })
  );
}
