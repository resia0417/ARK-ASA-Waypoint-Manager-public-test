// =============================================================
// map_viewer.js
// Map Viewer本体(地図描画)。v0.4.0 からはタブではなく、画面上部の
// 地図エリアに2台並べて常時表示する構成になった:
//
//   左: GameUserSettings.ini の Waypoint を表示するビューア
//   右: My Storage / Location Library の Waypoint を表示するビューア
//
// 2台は「同じマップを表示し、パン/ズームが連動する」ことで、
// INI側と保存側のWaypointを見比べられるようにしている。
//
// 実装方針:
// - 外部ライブラリ(Leaflet等)は使わず、DOM + CSS transform で
//   描画する。このアプリはビルドなしの静的ファイル構成であり、
//   オフラインでもそのまま動くことを優先したため。
// - 地図画像は maps/<folder>/<folder>_map.webp を通常のURLとして
//   読み込む(config.json の fetch と同じ方式)。画像の左上隅が
//   Lat 0 / Lon 0、右下隅が Lat 100 / Lon 100 に対応する前提で、
//   マーカー位置は Lat/Lon のパーセント配置で決まる。
// - 座標変換そのものは一切ここに書かない。UE座標⇔Lat/Lon は
//   CoordinateConverter と、app.js から渡される getLatLon
//   コールバック経由でのみ行う(要件「UIから直接座標計算を
//   行わない」への対応)。
// - アイコン描画もここでは行わず、app.js の getIconMarkup
//   (= waypoint_icon.js のラッパー)が返すHTMLをそのまま使う。
// - 複数インスタンス対応: 要素は document 全体ではなく、生成時に
//   渡された root 要素の中からクラスで引く(idは使わない)。
//
// app.js との連携:
// - 生成時に handlers を受け取る(依存の注入)。
//   getWaypoints(): このビューアが表示すべき { waypoint, listKey } 配列
//   getCurrentMap(): Current Map の値('__all__' または MapName)
//   getMapName(): 2台で共有している表示マップ名(未定なら '')
//   getAvailableMaps(): 表示候補の MapName 配列
//   getLatLon(wp) / getIconMarkup(wp): app.js の既存コールバック
//   onSelect(wp, listKey): マーカークリック時の選択通知
//   onMapChange(name): このビューアで表示マップが変更された通知
//   onViewChange(view): パン/ズームが変わった通知(相手側へ連動させる)
// - リスト側で選択が変わると app.js が window へ
//   'waypoint:selected' イベントを発火するので、それを購読して
//   該当マーカーをハイライトする(既存の拡張ポイントを利用)。
// =============================================================

import { CoordinateConverter } from './coordinate_converter.js';
import {
  mapNameToFolder,
  getMapImageFilename,
  resolveMapConfig,
  resolveEffectiveMapName,
  GENESIS_MAP_NAME,
} from './map_config.js';

const GRID_STEP = 10; // グリッド線・ラベルの間隔(Lat/Lon)

export function createMapViewer(handlers, root) {
  const q = (sel) => root.querySelector(sel);
  const els = {
    // v0.5.0: ツールバー廃止。ドロップダウンは左ペインのみ(共有・オーバーレイ表示)、
    // Fit/±ボタンとGridトグルは廃止(Fitはダブルクリック、Gridは常時表示)。
    mapSelect: q('.mv-map-select'), // 右ペインでは null
    readout: q('.mv-readout'),
    info: q('.mv-info'),
    viewport: q('.mv-viewport'),
    stage: q('.mv-stage'),
    image: q('.mv-image'),
    grid: q('.mv-grid'),
    markers: q('.mv-markers'),
    labels: q('.mv-labels'),
    notice: q('.mv-notice'),
  };

  const state = {
    mapName: '',
    config: null,
    converter: null,
    imgW: 0,
    imgH: 0,
    fitScale: 1,
    zoom: 1,
    tx: 0,
    ty: 0,
    selected: null, // 選択中Waypoint(リスト側と同期)
    clickPoint: null, // { lat, lon } 地図クリック位置
    markerItems: [], // { el, lat, lon, waypoint }
    loadSeq: 0, // 地図切替の競合防止
    applyingRemoteView: false, // 連動で相手の視点適用中(通知ループ防止)
  };

  const scale = () => state.fitScale * state.zoom;

  // --- 視点(パン/ズーム)の連動 -------------------------------------------

  function getView() {
    return { zoom: state.zoom, tx: state.tx, ty: state.ty, fitScale: state.fitScale };
  }

  function setView(view) {
    if (!view || !state.imgW) return;
    state.applyingRemoteView = true;
    // ビューポート寸法が同じ前提で fitScale は共通になるが、寸法差が
    // ある場合は相手の fitScale をそのまま使う方が見た目が揃う
    if (view.fitScale) state.fitScale = view.fitScale;
    state.zoom = view.zoom;
    state.tx = view.tx;
    state.ty = view.ty;
    render();
    state.applyingRemoteView = false;
  }

  function emitView() {
    if (state.applyingRemoteView) return;
    handlers.onViewChange?.(getView());
  }

  // --- 地図の読み込み -------------------------------------------------

  async function loadMap(mapName) {
    const seq = ++state.loadSeq;
    state.mapName = mapName;
    state.selected = null;
    state.clickPoint = null;
    state.markerItems = [];
    els.markers.innerHTML = '';
    setNotice('読み込み中…');

    const config = await resolveMapConfig(mapName);
    if (seq !== state.loadSeq) return;
    state.config = config;
    state.converter = new CoordinateConverter(config);

    const folder = mapNameToFolder(mapName);
    const url = `maps/${folder}/${getMapImageFilename(folder)}`;
    const img = new Image();
    img.onload = () => {
      if (seq !== state.loadSeq) return;
      state.imgW = img.naturalWidth;
      state.imgH = img.naturalHeight;
      els.image.src = url;
      els.image.style.width = `${state.imgW}px`;
      els.image.style.height = `${state.imgH}px`;
      fit();
      refreshMarkers();
      updateNotice();
    };
    img.onerror = () => {
      if (seq !== state.loadSeq) return;
      state.imgW = 0;
      state.imgH = 0;
      els.image.removeAttribute('src');
      els.markers.innerHTML = '';
      setNotice(`地図画像が読み込めませんでした(${url})。実画像が配置されているか確認してください。`);
    };
    img.src = url;
  }

  function updateNotice() {
    if (state.config && !state.config.isCalibrated) {
      setNotice('このマップは未キャリブレーションです(config.json が見つからないため、座標変換は初期値のままです)。');
    } else {
      setNotice('');
    }
  }

  function setNotice(text) {
    els.notice.textContent = text;
    els.notice.classList.toggle('hidden', !text);
  }

  // --- マーカー ---------------------------------------------------------

  function refreshMarkers() {
    if (!state.mapName || !state.imgW) return;
    els.markers.innerHTML = '';
    state.markerItems = [];

    let shown = 0;
    let skipped = 0;
    for (const { waypoint, listKey } of handlers.getWaypoints()) {
      // Genesis_WP はZ座標で陸・海へ振り分けた実効MapNameで照合する
      if (resolveEffectiveMapName(waypoint.parsed.map, waypoint.parsed.z) !== state.mapName) continue;
      const latLon = handlers.getLatLon(waypoint);
      if (!latLon || !isFinite(latLon.lat) || !isFinite(latLon.lon) ||
          latLon.lat < 0 || latLon.lat > 100 || latLon.lon < 0 || latLon.lon > 100) {
        skipped++;
        continue;
      }
      const el = document.createElement('div');
      el.className = 'mv-marker';
      el.title = waypoint.parsed.name || '(無名)';
      el.innerHTML = handlers.getIconMarkup(waypoint);
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        handlers.onSelect(waypoint, listKey);
      });
      els.markers.appendChild(el);
      state.markerItems.push({ el, lat: latLon.lat, lon: latLon.lon, waypoint });
      shown++;
    }
    els.info.textContent = skipped > 0
      ? `${shown} Waypoints を表示中(範囲外のため ${skipped} 件を非表示)`
      : `${shown} Waypoints を表示中`;
    render();
  }

  // --- 描画(パン・ズームの反映) -----------------------------------------

  function stagePointToScreen(lat, lon) {
    const s = scale();
    return {
      x: state.tx + (lon / 100) * state.imgW * s,
      y: state.ty + (lat / 100) * state.imgH * s,
    };
  }

  function render() {
    const s = scale();
    els.stage.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${s})`;

    for (const item of state.markerItems) {
      const p = stagePointToScreen(item.lat, item.lon);
      item.el.style.left = `${p.x}px`;
      item.el.style.top = `${p.y}px`;
      const isSel = state.selected != null &&
        (item.waypoint === state.selected || item.waypoint.id === state.selected.id);
      item.el.classList.toggle('selected', isSel);
    }
    renderClickMarker();
    renderLabels();
  }

  let clickEl = null;
  function renderClickMarker() {
    if (!state.clickPoint) {
      if (clickEl) { clickEl.remove(); clickEl = null; }
      return;
    }
    if (!clickEl) {
      clickEl = document.createElement('div');
      clickEl.className = 'mv-click-marker';
      els.markers.appendChild(clickEl);
    }
    const p = stagePointToScreen(state.clickPoint.lat, state.clickPoint.lon);
    clickEl.style.left = `${p.x}px`;
    clickEl.style.top = `${p.y}px`;
  }

  function renderLabels() {
    const show = state.imgW > 0; // Grid常時表示(v0.5.0)
    els.grid.style.display = show ? 'block' : 'none';
    els.labels.innerHTML = '';
    if (!show) return;
    const frag = document.createDocumentFragment();
    for (let lon = 0; lon <= 100; lon += GRID_STEP) {
      const p = stagePointToScreen(0, lon);
      if (p.x < -20 || p.x > els.viewport.clientWidth + 20) continue;
      const span = document.createElement('span');
      span.className = 'mv-label mv-label-top';
      span.style.left = `${p.x}px`;
      span.textContent = String(lon);
      frag.appendChild(span);
    }
    for (let lat = GRID_STEP; lat < 100; lat += GRID_STEP) {
      const p = stagePointToScreen(lat, 0);
      if (p.y < -20 || p.y > els.viewport.clientHeight + 20) continue;
      const span = document.createElement('span');
      span.className = 'mv-label mv-label-left';
      span.style.top = `${p.y}px`;
      span.textContent = String(lat);
      frag.appendChild(span);
    }
    els.labels.appendChild(frag);
  }

  // --- パン・ズーム -------------------------------------------------------

  function fit() {
    if (!state.imgW) return;
    const vw = els.viewport.clientWidth;
    const vh = els.viewport.clientHeight;
    if (!vw || !vh) return;
    state.fitScale = Math.min(vw / state.imgW, vh / state.imgH);
    state.zoom = state.config ? clampZoom(state.config.defaultZoom) : 1;
    const s = scale();
    state.tx = (vw - state.imgW * s) / 2;
    state.ty = (vh - state.imgH * s) / 2;
    render();
    emitView();
  }

  function clampZoom(z) {
    const min = state.config ? state.config.minZoom : 0.5;
    const max = state.config ? state.config.maxZoom : 4;
    return Math.min(max, Math.max(min, z));
  }

  function zoomAt(cx, cy, factor) {
    if (!state.imgW) return;
    const s0 = scale();
    const newZoom = clampZoom(state.zoom * factor);
    const s1 = state.fitScale * newZoom;
    // カーソル位置の地図上の点が動かないように平行移動を調整する
    state.tx = cx - (cx - state.tx) * (s1 / s0);
    state.ty = cy - (cy - state.ty) * (s1 / s0);
    state.zoom = newZoom;
    render();
    emitView();
  }

  function screenToLatLon(clientX, clientY) {
    const rect = els.viewport.getBoundingClientRect();
    const px = clientX - rect.left - state.tx;
    const py = clientY - rect.top - state.ty;
    const s = scale();
    return {
      lon: (px / s / state.imgW) * 100,
      lat: (py / s / state.imgH) * 100,
    };
  }

  function bindViewportEvents() {
    let drag = null;
    els.viewport.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, tx: state.tx, ty: state.ty, moved: false };
      els.viewport.setPointerCapture(e.pointerId);
    });
    els.viewport.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      if (drag.moved) {
        state.tx = drag.tx + dx;
        state.ty = drag.ty + dy;
        render();
        emitView();
      }
    });
    els.viewport.addEventListener('pointerup', (e) => {
      const wasDrag = drag && drag.moved;
      drag = null;
      if (wasDrag || !state.imgW || !state.converter) return;
      const { lat, lon } = screenToLatLon(e.clientX, e.clientY);
      if (lat < 0 || lat > 100 || lon < 0 || lon > 100) {
        state.clickPoint = null;
        els.readout.textContent = '';
        render();
        return;
      }
      state.clickPoint = { lat, lon };
      els.readout.textContent = `Lat ${lat.toFixed(1)} / Lon ${lon.toFixed(1)}`; // v0.6.0: Lat/Lonのみ
      render();
    });
    els.viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = els.viewport.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });
    els.image.addEventListener('dragstart', (e) => e.preventDefault());
  }

  // --- 公開API ------------------------------------------------------------

  function refreshMapOptions() {
    if (!els.mapSelect) return; // 右ペインにはドロップダウンが無い
    const maps = handlers.getAvailableMaps();
    const current = els.mapSelect.value;
    // MapNameはファイル由来の文字列のため、innerHTMLではなく
    // DOM生成でoptionを作る(未エスケープによるXSS防止。v0.6.8)
    const options = maps.map((m) => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      return opt;
    });
    els.mapSelect.replaceChildren(...options);
    if (maps.includes(current)) els.mapSelect.value = current;
  }

  function refresh() {
    refreshMapOptions();
    const maps = handlers.getAvailableMaps();
    const currentMap = handlers.getCurrentMap();
    const sharedMap = handlers.getMapName ? handlers.getMapName() : '';
    // Genesis_WP は陸・海どちらの地図か一意に決まらないため、Current Map が
    // Genesis_WP の場合は共有マップ名(ドロップダウンの選択)を優先する
    let target = '';
    if (currentMap && currentMap !== '__all__' && currentMap !== GENESIS_MAP_NAME) {
      target = currentMap;
    } else if (sharedMap && maps.includes(sharedMap)) {
      target = sharedMap;
    } else {
      target = (els.mapSelect ? els.mapSelect.value : '') || maps[0] || '';
    }
    if (!target) {
      setNotice('表示できるマップがありません。');
      return;
    }
    if (els.mapSelect && els.mapSelect.value !== target) els.mapSelect.value = target;
    if (target !== state.mapName) {
      loadMap(target);
    } else {
      refreshMarkers();
      updateNotice();
    }
  }

  if (els.mapSelect) {
    els.mapSelect.addEventListener('change', () => {
      handlers.onMapChange?.(els.mapSelect.value);
      loadMap(els.mapSelect.value);
    });
  }
  els.viewport.addEventListener('dblclick', fit); // Fitボタン廃止の代替(v0.5.0)
  window.addEventListener('waypoint:selected', (e) => {
    state.selected = e.detail ?? null;
    render();
  });
  if (typeof ResizeObserver === 'function') {
    let first = true;
    new ResizeObserver(() => {
      if (!state.imgW) return;
      if (first) { first = false; fit(); } else { render(); }
    }).observe(els.viewport);
  }
  bindViewportEvents();

  return { refresh, loadMap, refreshMarkers, getView, setView };
}
