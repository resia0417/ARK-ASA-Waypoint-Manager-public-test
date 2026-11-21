// =============================================================
// waypoint_icon.js
// WaypointIcon — Waypointのアイコン(六角形の背景 + MarkIconの図形)を
// 描画するための共通モジュール。
//
// 要件7〜9(WaypointIconコンポーネント)への対応。元の要件は
// Reactコンポーネント(.tsx)として書かれているが、本プロジェクトは
// v0.1以来ビルド不要の素のJavaScript構成を採用しているため、
// 同じ役割・同じAPIの発想を持つ関数として実装している。
//
//   本来の要件のAPI:
//     <WaypointIcon type="Location" baseColor={Color} iconColor={IconColor} size={20} />
//
//   本実装でのAPI(同じ入力で同じ見た目を作れる関数として提供):
//     renderWaypointIconHtml({ type, baseColor, iconColor, size }, onLoaded)
//       → HTML文字列を返す(WaypointListControllerのセル描画に直接埋め込める)
//     mountWaypointIcon(container, { type, baseColor, iconColor, size })
//       → 指定した要素の中にアイコンを描画する(Waypoint Preview等で使用)
//
// 一覧・詳細・Add/Edit・Map Viewer(将来)は、すべてこのモジュールだけを
// 経由してアイコンを描画する(要件12「アイコン描画処理はWaypointIconへ
// 集約してください」への対応)。個々の画面がSVGやfill処理を直接書くことはない。
// =============================================================

import { MARK_ICON_DEFINITIONS, findMarkIconById, findMarkIconByRawText, DEFAULT_MARK_ICON_ID } from './mark_icon.js';
import { ICON_IMAGES } from './icon_images.js';
import { escapeHtml, clamp01 } from './util.js';

const ICON_ASSET_DIR = 'assets/waypoint-icons/';
const BASE_ICON_ID = 'BaseIcon';

// アイコンID(またはBaseIcon) -> 取得済みのSVGマークアップ文字列
const svgCache = new Map();
// アイコンID -> 読み込み中のPromise(重複fetch防止)
const pendingFetches = new Map();

/**
 * 指定したSVGアセットを同期的にキャッシュから取得する。
 * キャッシュに無い場合は null を返し、裏でfetchを開始する。
 * 完了時に onLoaded コールバックを呼び出す(呼び出し側はこれを使って
 * 再描画をトリガーする。MapConfigのgetCachedMapConfig()と同じ設計)。
 * @param {string} assetId - 'BaseIcon' またはMarkIconDefinitionのsvgフィールド
 * @param {() => void} [onLoaded]
 * @returns {string|null}
 */
// 読込完了コールバックは呼び出し元ごとに保持する(最初の呼び出し元の分だけ
// 残すと、後続の呼び出し元の再描画が漏れるため)
const pendingSvgCallbacks = new Map();

function getCachedSvg(assetId, onLoaded) {
  if (svgCache.has(assetId)) return svgCache.get(assetId);

  if (onLoaded) {
    if (!pendingSvgCallbacks.has(assetId)) pendingSvgCallbacks.set(assetId, new Set());
    pendingSvgCallbacks.get(assetId).add(onLoaded);
  }
  if (!pendingFetches.has(assetId)) {
    const notifyLoaded = () => {
      const callbacks = pendingSvgCallbacks.get(assetId) ?? [];
      pendingSvgCallbacks.delete(assetId);
      callbacks.forEach((cb) => cb());
    };
    // Set で保持するため、同一参照のコールバックは1回だけ呼ばれる
    const promise = fetch(`${ICON_ASSET_DIR}${assetId}.svg`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        svgCache.set(assetId, text);
        pendingFetches.delete(assetId);
        notifyLoaded();
        return text;
      })
      .catch((err) => {
        console.warn(`アイコンSVGの読み込みに失敗しました(${assetId}):`, err);
        svgCache.set(assetId, ''); // 空文字をキャッシュし、以後リトライで詰まらないようにする
        pendingFetches.delete(assetId);
        notifyLoaded();
        return '';
      });
    pendingFetches.set(assetId, promise);
  }
  return null;
}

/**
 * RGBA(0〜1の各成分)をCSSのrgba()文字列へ変換する。
 * @param {{r:number,g:number,b:number,a:number}} color
 * @returns {string}
 */
function toCssColor(color) {
  const c = color ?? { r: 1, g: 1, b: 1, a: 1 };
  const r = Math.round(clamp01(c.r) * 255);
  const g = Math.round(clamp01(c.g) * 255);
  const b = Math.round(clamp01(c.b) * 255);
  const a = clamp01(c.a ?? 1);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * WaypointIconのHTML文字列を生成する。一覧のセルなど、innerHTMLへ
 * そのまま挿入できる文字列が必要な場面で使用する。
 * @param {{type:string, baseColor:object, iconColor:object, size?:number, title?:string}} props
 * @param {() => void} [onLoaded] - SVGアセット読み込み完了時に呼ばれる(再描画トリガー用)
 * @returns {string}
 */
export function renderWaypointIconHtml({ type, baseColor, iconColor, size = 20, title }, onLoaded) {
  const def = findMarkIconById(type) ?? findMarkIconById(DEFAULT_MARK_ICON_ID);
  const baseSvg = getCachedSvg(BASE_ICON_ID, onLoaded);
  // 資源系アイコンは実物画像(icon_images.js)で描画し、SVGは取得しない(v0.6.3)
  const imageUri = ICON_IMAGES[def.id] ?? null;
  const glyphSvg = imageUri || !def.svg ? '' : getCachedSvg(def.svg, onLoaded);

  const tooltip = escapeHtml(title ?? def.displayName);

  if (baseSvg == null || glyphSvg == null) {
    // 読み込み中: 枠だけのプレースホルダーを表示し、読み込み完了後に再描画される
    return `<span class="waypoint-icon waypoint-icon-loading" style="width:${size}px;height:${size}px;" title="${tooltip}"></span>`;
  }

  const baseColorCss = toCssColor(baseColor);
  const iconColorCss = toCssColor(iconColor);

  const glyphHtml = imageUri
    ? `<img class="waypoint-icon-img" src="${imageUri}" alt="">`
    : glyphSvg;

  return `
    <span class="waypoint-icon" style="width:${size}px;height:${size}px;" title="${tooltip}">
      <span class="waypoint-icon-layer waypoint-icon-base" style="color:${baseColorCss}">${baseSvg}</span>
      <span class="waypoint-icon-layer waypoint-icon-glyph" style="color:${iconColorCss}">${glyphHtml}</span>
    </span>`;
}

/**
 * 指定したDOM要素の中身をWaypointIconで置き換える。
 * Add/Editダイアログの Waypoint Preview のように、DOM要素へ直接
 * マウントしたい場面で使用する(内部的には renderWaypointIconHtml を使う)。
 * @param {HTMLElement} container
 * @param {{type:string, baseColor:object, iconColor:object, size?:number, title?:string}} props
 */
export function mountWaypointIcon(container, props) {
  const html = renderWaypointIconHtml(props, () => mountWaypointIcon(container, props));
  container.innerHTML = html;
}


export { findMarkIconById, findMarkIconByRawText, DEFAULT_MARK_ICON_ID, MARK_ICON_DEFINITIONS };

