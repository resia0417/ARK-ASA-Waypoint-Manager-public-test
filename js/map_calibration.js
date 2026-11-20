// =============================================================
// map_calibration.js
// Debug Mode専用の「Map Calibration」機能が使う、純粋な計算ロジック。
// UI(DOM操作)には一切関与しない(要件12「UIへ計算式を書かないでください」
// への対応。app.js はこのクラスの入出力を画面へ反映するだけに留める)。
//
// 5つの固定キャリブレーションポイント(ゲーム内座標は固定、UE座標は
// ユーザー入力またはAuto Detectで取得)から、MapConfigの4つの数値
// (latitudeScale/longitudeScale/latitudeOrigin/longitudeOrigin)を
// 算出し、あわせて軸の相関診断(Axis)と残差誤差(Residual Error)を
// 報告する。
// =============================================================

import { MapConfig } from './map_config.js';

/**
 * 固定のキャリブレーションポイント(ゲーム内座標)。
 * 要件通り、常にこの5点・この順序を使用する。
 * 各ポイントの name は Auto Detect が GameUserSettings.ini 内の
 * Waypoint名(CustomTagではない)を検索する際のキーとしても使う。
 * 命名規則は CAL_<Latitude>_<Longitude> に統一している。
 */
export const CALIBRATION_POINTS = [
  { id: 'CAL_0_0', name: 'CAL_0_0', lat: 0, lon: 0 },
  { id: 'CAL_100_0', name: 'CAL_100_0', lat: 100, lon: 0 },
  { id: 'CAL_0_100', name: 'CAL_0_100', lat: 0, lon: 100 },
  { id: 'CAL_100_100', name: 'CAL_100_100', lat: 100, lon: 100 },
  { id: 'CAL_50_50', name: 'CAL_50_50', lat: 50, lon: 50 },
];

/**
 * GameUserSettings.ini(ini一覧)から、5つのキャリブレーションポイントの
 * Name(CustomTagではない)に一致するWaypointを検索する。
 * @param {object[]} iniWaypoints - GameUserSettings.iniカラムのWaypoint配列
 * @returns {Record<string, {x:number, y:number} | null>} ポイントidごとの検出結果
 */
export function autoDetectCalibrationPoints(iniWaypoints) {
  const result = {};
  for (const point of CALIBRATION_POINTS) {
    const found = iniWaypoints.find((wp) => wp.parsed.name === point.name);
    result[point.id] = found ? { x: found.parsed.x, y: found.parsed.y } : null;
  }
  return result;
}

/**
 * 入力された5点(ゲーム内座標は固定、UE座標は points[].ue)から
 * MapConfigを算出する。
 *
 * 算出方法:
 * - Lat軸: CAL_0_0(Lat=0)とCAL_100_0(Lat=100)は共にLon=0であるため、
 *   この2点間のUE座標変化量からLatitudeScale/Originを算出する。
 * - Lon軸: CAL_0_0(Lon=0)とCAL_0_100(Lon=100)は共にLat=0であるため、
 *   同様にLongitudeScale/Originを算出する。
 * - CAL_100_100とCAL_50_50は検証用の点として、算出済みの式で
 *   予測したUE座標と実際の入力値との誤差(Residual Error)を求める。
 * - Axisは、Lat/Lonそれぞれの変化が実際にどちらのUE軸(X/Y)へ
 *   大きく現れているかを診断し、想定(Lat→Y, Lon→X)と一致するかを
 *   報告する(診断のみ。実際の変換式は常にLat→Y, Lon→Xの固定規約を使う。
 *   詳細はcoordinate_converter.js参照)。
 *
 * @param {string} mapName
 * @param {Record<string, {x:number,y:number}>} uePoints - ポイントidごとのUE座標
 * @returns {{ config: MapConfig, axisReport: string, residualError: number, warnings: string[] }}
 */
export function calculateMapConfig(mapName, uePoints) {
  const byId = (id) => uePoints[id];
  const p00 = byId('CAL_0_0');
  const p100_0 = byId('CAL_100_0');
  const p0_100 = byId('CAL_0_100');
  const p100_100 = byId('CAL_100_100');
  const p50_50 = byId('CAL_50_50');

  const warnings = [];

  // Lat軸(Y): CAL_0_0 → CAL_100_0
  const latitudeScale = (p100_0.y - p00.y) / 100;
  const latitudeOrigin = p00.y;

  // Lon軸(X): CAL_0_0 → CAL_0_100
  const longitudeScale = (p0_100.x - p00.x) / 100;
  const longitudeOrigin = p00.x;

  // Axis診断: Lat変化はY軸に、Lon変化はX軸に大きく現れるはずという想定を確認する
  const latDeltaX = Math.abs(p100_0.x - p00.x);
  const latDeltaY = Math.abs(p100_0.y - p00.y);
  const lonDeltaX = Math.abs(p0_100.x - p00.x);
  const lonDeltaY = Math.abs(p0_100.y - p00.y);

  const latAxis = latDeltaY >= latDeltaX ? 'Y' : 'X';
  const lonAxis = lonDeltaX >= lonDeltaY ? 'X' : 'Y';
  let axisReport = `Lat → ${latAxis}, Lon → ${lonAxis}`;
  if (latAxis !== 'Y' || lonAxis !== 'X') {
    warnings.push('想定と異なる軸相関が検出されました(通常はLat→Y, Lon→Xです)。キャリブレーションポイントを確認してください。');
    axisReport += '(想定外)';
  } else {
    axisReport += '(想定通り)';
  }

  // 残差誤差: CAL_100_100 と CAL_50_50 を検証用に使う
  const predict = (lat, lon) => ({
    x: lon * longitudeScale + longitudeOrigin,
    y: lat * latitudeScale + latitudeOrigin,
  });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const predicted100 = predict(100, 100);
  const predicted50 = predict(50, 50);
  const error100 = dist(predicted100, p100_100);
  const error50 = dist(predicted50, p50_50);
  const residualError = (error100 + error50) / 2;

  if (residualError > 1) {
    warnings.push(`残差誤差が大きい値です(${residualError.toFixed(2)})。入力したUE座標を確認してください。`);
  }

  const config = new MapConfig({
    mapName,
    displayName: mapName,
    latitudeScale,
    longitudeScale,
    latitudeOrigin,
    longitudeOrigin,
    isCalibrated: true,
  });

  return { config, axisReport, residualError, warnings };
}
