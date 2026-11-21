// =============================================================
// util.js
// 複数モジュールで使う小さな共通関数。
// v0.6.9で app.js / waypoint_icon.js / waypoint_list.js に
// 重複していた定義をここへ集約した。
// =============================================================

/** HTML文字列へ埋め込む際のエスケープ。 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

/** 数値を表示用文字列にする(数値でなければ '0')。 */
export function formatNum(n) {
  return Number.isFinite(n) ? String(n) : '0';
}

/** 色チャンネル値を 0〜1 へ丸める(数値でなければ 1)。 */
export function roundTo(n, digits) {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

export function clamp01(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 1;
  return Math.min(1, Math.max(0, v));
}
