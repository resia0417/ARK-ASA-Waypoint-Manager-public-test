// =============================================================
// app.js (v0.3.4)
// アプリケーションのエントリーポイント。
// GameUserSettings.ini と、Libraryパネル(My Storage / Location Library /
// Waypoint Log のタブ切替)という2カラム構成を、共通の
// WaypointListController(waypoint_list.js)を4つ生成して構築する。
//
// 現在の設計(v0.3.4時点):
// - レイアウトは「GameUserSettings.ini | Library(タブ)」の2カラム
// - Mapフィルターは画面全体で1つ(Current Map)。選択すると全リストへ
//   同時反映される。「All Maps」以外を選ぶとMap列を隠す
// - My Storage / Location Library はいずれも単一JSONファイルを読み書きする
//   編集可能なリスト(Add/Edit/Delete/Save)。Waypoint Logのみ読み取り専用
//   (GameUserSettings.iniと同じParserを再利用する読込専用インポート元)
// - 検索・列ソート・列の表示/順序/幅・左右カラム幅(Splitter)を
//   SettingsStore経由で永続化
// - ドラッグ&ドロップは4リストすべてが対象。GameUserSettings.ini /
//   My Storage / Location Libraryは対等な編集可能リストのため「真の移動」、
//   Waypoint Logは読み取り専用の参照元のため、そこからのドラッグは
//   「コピー」(元のリストは変化しない)とし、そこへのドロップは
//   競合確認なしの「追加のみ」として扱う(Edit/Save機能が無いため、
//   上書きという概念が成立しない)。
// - Waypoint一覧のMarkIcon列・Add/EditのMarkIcon選択・Waypoint Previewは
//   すべて waypoint_icon.js の共通WaypointIcon描画関数のみを経由する
//   (アイコン描画処理をこのモジュールへ集約している)。
// =============================================================

import {
  parseSavedMinimapMarks,
  convertToWaypointData,
  ensureWaypointManagerSection,
  buildRawText,
  rebuildIniText,
} from './ini_parser.js';
import {
  createWaypoint,
  validateWaypoint,
  isSameLocation,
  isSameCustomTag,
  generateUniqueTag,
  defaultColor,
} from './waypoint.js';
import { serializeStorage, parseStorage, STORAGE_FILE_NAME } from './storage.js';
import { createEmptyLibrary, serializeLibrary, parseLibrary } from './location_library.js';
import * as fm from './file_manager.js';
import { WaypointListController } from './waypoint_list.js';
import { settingsStore } from './settings_store.js';
import { CoordinateConverter } from './coordinate_converter.js';
import { getCachedMapConfig, resolveMapConfig, setCachedMapConfig, saveMapConfigToProject, validateMapConfig, KNOWN_MAP_FOLDERS, GENESIS_MAP_NAME, GENESIS_LAND_MAP_NAME, GENESIS_OCEAN_MAP_NAME, GENESIS_OCEAN_Z_THRESHOLD, GENESIS_OCEAN_DEFAULT_Z, GENESIS_LAND_DEFAULT_Z, resolveEffectiveMapName } from './map_config.js';
import { createMapViewer } from './map_viewer.js';
import { CALIBRATION_POINTS, autoDetectCalibrationPoints, calculateMapConfig } from './map_calibration.js';
import { MARK_ICON_DEFINITIONS, findMarkIconById, findMarkIconByRawText, DEFAULT_MARK_ICON_ID, renderWaypointIconHtml, mountWaypointIcon } from './waypoint_icon.js';

const LIST_KEYS = ['ini', 'storage', 'library', 'log'];
const LABELS = { ini: 'GameUserSettings.ini', storage: 'My Storage', library: 'Location Library', log: 'Waypoint Log' };
const SOURCE_FIELD = { ini: 'GameUserSettings', storage: 'Storage', library: 'LocationLibrary', log: 'Log' };
// 対等な「編集可能リスト」。この3つの間だけ、衝突確認付きの真の移動を行う。
// v0.3.4よりLocation Libraryも単一waypoints.json形式の編集可能リストになったため追加した。
const EDITABLE_LISTS = new Set(['ini', 'storage', 'library']);
// 変更のたびに自動保存するリスト(要件「終了時自動保存」への実務的対応。v0.2.1以来の方針)
const AUTO_SAVE_HANDLERS = {}; // listKey -> () => Promise<void> (init()の末尾で設定する)

// --- アプリケーション状態 ---------------------------------------
const controllers = {};
let currentSelection = null; // { listKey, waypoint } | null
let editingRef = null; // { listKey, id: string|null }
let selectedMarkIconId = DEFAULT_MARK_ICON_ID; // Add/Editモーダルで現在選択中のMarkIcon
let colorEditorApi = null; // Add/Editモーダル内のColor編集UI(getValue/setValue)
let iconColorEditorApi = null; // 同、IconColor用

let iniFileHandle = null;
let iniOriginalText = '';
let storageFileHandle = null;
let logFileHandle = null;
let libraryFileHandle = null;
let lastCalibrationResult = null; // { config, axisReport, residualError, warnings } | null
let mapViewerIni = null; // 地図ビューア: GameUserSettings.ini 専用(v0.4.0で2台構成に)
let mapViewerLib = null; // 地図ビューア: My Storage / Location Library 専用
let viewerMapName = ''; // 選択中のマップ(実効名)。v0.6.0からリスト絞り込みと地図の唯一の正
let availableMapNames = []; // データに存在する実効マップ名の一覧(refreshMapSelectionが維持)
let activeLibraryTab = 'storage'; // 右の地図が追随するLibraryタブ(v0.6.0)

const els = {};

function cacheElements() {
  const ids = [
    'statusText', 'settingsBtn', 'settingsModal', 'settingsCloseBtn', 'debugModeCheckbox', 'mapsToggleBtn', 'libMapChip',
    // GameUserSettings.ini
    'iniReadBtn', 'iniAddBtn', 'iniSaveBtn',
    'iniSearchInput', 'iniColumnSettingsBtn', 'iniCount', 'iniTheadRow', 'iniTableBody', 'iniEmptyState', 'iniDropZone',
    // My Storage
    'storageReadBtn', 'storageAddBtn', 'storageSaveBtn',
    'storageSearchInput', 'storageColumnSettingsBtn', 'storageCount', 'storageTheadRow', 'storageTableBody', 'storageEmptyState', 'storageDropZone',
    // Location Library
    'libraryReadBtn', 'libraryAddBtn',
    'librarySearchInput', 'libraryCategoryFilter', 'libraryColumnSettingsBtn', 'libraryCount', 'libraryTheadRow', 'libraryTableBody', 'libraryEmptyState', 'libraryDropZone',
    // Waypoint Log
    'logOpenBtn',
    'logSearchInput', 'logColumnSettingsBtn', 'logCount', 'logTheadRow', 'logTableBody', 'logEmptyState', 'logDropZone',
    // Map Calibration (Debug Mode専用)
    'calibrationTabBtn', 'calibrationTargetMapLabel', 'calibrationNoMapNotice',
    'calibrationAutoDetectBtn', 'calibrationCalculateBtn', 'calibrationSaveBtn',
    'calibrationTableBody', 'calibrationDetectSummary', 'calibrationResult', 'calibrationResultText',
    'calibrationValidateResult', 'calibrationValidateList', 'calibrationSaveMessage',
    // 詳細ペイン
    'detailBar', 'detailPlaceholder', 'detailContent',
    'detailName', 'detailMap', 'detailX', 'detailY', 'detailZ', 'detailTag', 'detailIcon', 'detailRawText', 'copyRawTextBtn',
    // Add/Editモーダル
    'editModal', 'modalTitle', 'formName', 'formCategoryField', 'formCategory', 'categoryCandidates',
    'formMap', 'mapCandidates', 'formLat', 'formLon', 'formZ', 'formTag',
    'colorEditor', 'iconColorEditor', 'markIconPickerBtn',
    'waypointPreview', 'waypointPreviewName',
    'modalSaveBtn', 'modalCancelBtn',
    // 汎用選択ダイアログ
    'choiceModal', 'choiceTitle', 'choiceMessage', 'choiceButtons',
    // Library タブ・Splitter
    'libraryTabs', 'mainSplitter',
    // 地図エリア(v0.4.0)
    'mapsRow', 'mapsSplitter',
  ];
  for (const id of ids) els[id] = document.getElementById(id);
  els.colIni = document.getElementById('col-ini');
  els.mapPaneIni = document.getElementById('mapPaneIni');
  els.mapPaneLib = document.getElementById('mapPaneLib');
}

function init() {
  cacheElements();
  createControllers();
  bindToolbarEvents();
  bindDragAndDrop();
  bindModalEvents();
  bindHeaderEvents();
  bindLibraryTabs();
  bindSplitter();
  bindMapsSplitter();
  bindMapsToggle();
  bindDebugMode();
  bindCalibrationEvents();
  initMapViewers();
  restoreLayoutSettings();
  refreshMapViewers();

  AUTO_SAVE_HANDLERS.library = autoSaveLibrary;

  if (!fm.isFileSystemAccessSupported()) {
    setStatus('このブラウザはFile System Access APIに未対応です。Chrome/Edgeでの利用を推奨します。');
    return;
  }
  tryRestoreLastSession();
}

// --- 4つのWaypointListコントローラーを生成 ------------------------------

function createControllers() {
  // Current Mapフィルターは実効マップ名(Genesis陸/海分割)で比較する(v0.5.1)
  const getMapKey = (wp) => resolveEffectiveMapName(wp.parsed.map, wp.parsed.z);
  // 行内アクション(編集/削除アイコン)の共通コールバック(v0.5.0)
  const rowActionHandlers = (key) => ({
    rowActions: true,
    onEditRequest: (wp) => openAddEditModal(key, wp.id),
    onDeleteRequest: (wp) => onDeleteWaypoint(key, wp),
  });
  controllers.ini = new WaypointListController({
    listKey: 'ini', theadRow: els.iniTheadRow, tbody: els.iniTableBody,
    emptyStateEl: els.iniEmptyState, countEl: els.iniCount, searchInputEl: els.iniSearchInput,
    columnSettingsBtn: els.iniColumnSettingsBtn,
    settingsStore, onSelect: handleSelect, getLatLon, getIconMarkup, getMapKey,
    ...rowActionHandlers('ini'),
  });
  controllers.storage = new WaypointListController({
    listKey: 'storage', theadRow: els.storageTheadRow, tbody: els.storageTableBody,
    emptyStateEl: els.storageEmptyState, countEl: els.storageCount, searchInputEl: els.storageSearchInput,
    columnSettingsBtn: els.storageColumnSettingsBtn,
    settingsStore, onSelect: handleSelect, getLatLon, getIconMarkup, getMapKey,
    ...rowActionHandlers('storage'),
  });
  controllers.library = new WaypointListController({
    listKey: 'library', theadRow: els.libraryTheadRow, tbody: els.libraryTableBody,
    emptyStateEl: els.libraryEmptyState, countEl: els.libraryCount, searchInputEl: els.librarySearchInput,
    categoryFilterEl: els.libraryCategoryFilter, columnSettingsBtn: els.libraryColumnSettingsBtn,
    settingsStore, onSelect: handleSelect, getLatLon, getIconMarkup, getMapKey,
    ...rowActionHandlers('library'),
  });
  controllers.log = new WaypointListController({
    listKey: 'log', theadRow: els.logTheadRow, tbody: els.logTableBody,
    emptyStateEl: els.logEmptyState, countEl: els.logCount, searchInputEl: els.logSearchInput,
    columnSettingsBtn: els.logColumnSettingsBtn,
    settingsStore, onSelect: handleSelect, getLatLon, getIconMarkup, getMapKey,
  });
}

/**
 * Waypointの Lat/Lon(ゲーム内マップ座標)を算出する、一覧描画用のコールバック。
 * 「UIから直接座標計算を行わないでください」という要件のため、
 * WaypointListController自身は計算せず、この関数(CoordinateConverter/
 * MapConfigの薄いラッパー)を経由してのみ値を取得する。
 * MapConfigがまだ読み込まれていない場合はnullを返し(一覧には'…'と表示される)、
 * 読み込み完了時のコールバックで全リストを再描画して反映する。
 * @param {object} wp - Waypointモデル
 * @returns {{lat:number, lon:number}|null}
 */
function getLatLon(wp) {
  const mapName = wp.parsed.map;
  if (!mapName) return null;
  // Genesis_WP はZ座標で陸・海の実効MapNameへ振り分けてから config を引く
  const config = getCachedMapConfig(resolveEffectiveMapName(mapName, wp.parsed.z), () => {
    for (const key of LIST_KEYS) controllers[key].render();
  });
  if (!config) return null;
  return new CoordinateConverter(config).ueToGame(wp.parsed.x, wp.parsed.y);
}

/**
 * WaypointのMarkIcon表示(HTML文字列)を算出する、一覧描画用のコールバック。
 * 「アイコン描画処理はWaypointIconへ集約してください」という要件のため、
 * WaypointListController自身はSVGやfillを一切扱わず、この関数
 * (waypoint_icon.jsの薄いラッパー)を経由してのみ表示内容を取得する。
 * @param {object} wp - Waypointモデル
 * @returns {string} HTML文字列
 */
function getIconMarkup(wp) {
  const def = findMarkIconByRawText(wp.parsed.markIcon) ?? findMarkIconById(DEFAULT_MARK_ICON_ID);
  return renderWaypointIconHtml(
    { type: def.id, baseColor: wp.parsed.color, iconColor: wp.parsed.iconColor, size: 20 },
    () => { for (const key of LIST_KEYS) controllers[key].render(); }
  );
}

// --- 選択 → 詳細ペイン & 同期ハイライト & Map Viewer通知 ------------------

function handleSelect(waypoint, listKey) {
  if (waypoint) {
    currentSelection = { listKey, waypoint };
    for (const key of LIST_KEYS) if (key !== listKey) controllers[key].clearSelection();
  } else if (currentSelection && currentSelection.listKey === listKey) {
    currentSelection = null;
  }

  const matchTarget = currentSelection?.waypoint ?? null;
  for (const key of LIST_KEYS) {
    controllers[key].setHighlightMatcher(matchTarget ? (wp) => isSameLocation(wp, matchTarget) : null);
  }
  renderDetailBar(matchTarget);
  notifyMapViewer(matchTarget);
}

/**
 * 将来のMap Viewer拡張ポイント。地図描画は一切行わず、選択状態が
 * 変化するたびに `waypoint:selected` イベントを window へ発火するのみ。
 */
function notifyMapViewer(waypoint) {
  window.dispatchEvent(new CustomEvent('waypoint:selected', { detail: waypoint }));
}

/**
 * Map Viewer(map_viewer.js)を2台生成し、アプリ側のデータ・コールバックを
 * 注入する(v0.4.0)。左は GameUserSettings.ini のWaypoint、右は
 * My Storage / Location Library のWaypointを表示し、同じマップを
 * 見比べられるよう表示マップとパン/ズームを連動させる。
 * マーカーのクリックは通常のリスト選択(handleSelect)へそのまま流す。
 */
function initMapViewers() {
  // v0.6.0: 選択肢はデータに存在する実効マップ名のみ(refreshMapSelectionが維持する)
  const getAvailableMaps = () => availableMapNames;
  const shared = {
    getCurrentMap: () => viewerMapName || '__all__',
    getMapName: () => viewerMapName,
    getAvailableMaps,
    getLatLon,
    getIconMarkup,
    onSelect: (waypoint, listKey) => handleSelect(waypoint, listKey),
  };
  const collect = (keys) => () => keys.flatMap((key) =>
    controllers[key].getAll().map((waypoint) => ({ waypoint, listKey: key })));

  // 右の地図の表示元はLibraryのアクティブタブに追随する(v0.6.0)
  const libSourceKeys = () => activeLibraryTab === 'storage' ? ['storage']
    : activeLibraryTab === 'library' ? ['library']
    : activeLibraryTab === 'log' ? ['log'] : ['storage', 'library'];

  mapViewerIni = createMapViewer({
    ...shared,
    getWaypoints: collect(['ini']),
    onMapChange: (name) => { viewerMapName = name; applyCurrentMapFilter(true); },
    onViewChange: (view) => mapViewerLib?.setView(view),
  }, els.mapPaneIni);
  mapViewerLib = createMapViewer({
    ...shared,
    getWaypoints: () => collect(libSourceKeys())(),
    onMapChange: (name) => { viewerMapName = name; applyCurrentMapFilter(true); },
    onViewChange: (view) => mapViewerIni?.setView(view),
  }, els.mapPaneLib);
}

/** 両方の地図ビューアを最新データで再描画する(右ペインのラベルもタブに合わせて更新) */
function refreshMapViewers() {
  if (els.libMapChip) {
    els.libMapChip.textContent = activeLibraryTab === 'storage' ? 'Storage'
      : activeLibraryTab === 'library' ? 'Library'
      : activeLibraryTab === 'log' ? 'Log' : 'Storage ・ Library';
  }
  mapViewerIni?.refresh();
  mapViewerLib?.refresh();
}

function renderDetailBar(wp) {
  if (!wp) {
    els.detailPlaceholder.style.display = 'block';
    els.detailContent.classList.add('hidden');
    return;
  }
  els.detailPlaceholder.style.display = 'none';
  els.detailContent.classList.remove('hidden');
  els.detailName.textContent = wp.parsed.name || '(無名)';
  els.detailMap.textContent = wp.parsed.map || '-';
  els.detailX.textContent = formatNum(wp.parsed.x);
  els.detailY.textContent = formatNum(wp.parsed.y);
  els.detailZ.textContent = formatNum(wp.parsed.z);
  els.detailTag.textContent = wp.parsed.customTag || '-';
  els.detailIcon.textContent = wp.parsed.markIcon || '-';
  els.detailRawText.value = wp.rawText || '(RawTextなし: 手動追加されたWaypoint)';
}

// --- マップ選択(グローバルフィルター) -------------------------------------
// v0.6.0: ヘッダーのCurrent Map行を廃止し、左の地図のドロップダウンに統一した。
// 選択中のマップは viewerMapName が唯一の正で、リストの絞り込みと2枚の地図は
// 常にこれに追随する。選択肢はデータに存在する実効マップ名のみ(All Mapsなし、
// Genesisは陸/海に分割)。

function refreshMapSelection() {
  const maps = new Set();
  for (const key of LIST_KEYS) {
    for (const wp of controllers[key].getAll()) {
      const m = (wp.parsed.map || '').trim();
      if (m) maps.add(resolveEffectiveMapName(m, wp.parsed.z));
    }
  }
  availableMapNames = Array.from(maps).sort((a, b) => a.localeCompare(b, 'ja'));
  if (!availableMapNames.includes(viewerMapName)) {
    viewerMapName = availableMapNames[0] || '';
  }
  applyCurrentMapFilter(false);
}

function applyCurrentMapFilter(persist) {
  const value = viewerMapName;
  const showMapColumn = value === ''; // 特定マップ選択中はMap列が冗長なため隠す
  for (const key of LIST_KEYS) {
    controllers[key].setExternalMapFilter(value === '' ? '__all__' : value);
    controllers[key].setMapColumnVisible(showMapColumn);
  }
  if (persist) settingsStore.set('currentMap', value);
  syncCalibrationToCurrentMap();
  refreshMapViewers();
}

// --- 前回セッションの復元 ------------------------------------------

async function tryRestoreLastSession() {
  try {
    const savedIni = await fm.loadLastIniHandle();
    if (savedIni && (await fm.verifyPermission(savedIni, 'readwrite'))) {
      iniFileHandle = savedIni;
      await loadIniLikeFile(savedIni, 'ini');
      markRead('ini');
      markClean('ini');
    }
  } catch (err) { console.info('前回のGameUserSettings.ini情報はありません:', err.message); }

  try {
    const savedStorage = await fm.loadLastJsonHandle();
    if (savedStorage && (await fm.verifyPermission(savedStorage, 'readwrite'))) {
      storageFileHandle = savedStorage;
      const text = await fm.readFile(storageFileHandle);
      controllers.storage.setAll(parseStorage(text));
      markRead('storage');
      markClean('storage');
    }
  } catch (err) { console.info('前回のMy Storage情報はありません:', err.message); }

  try {
    const savedLog = await fm.loadLastLogHandle();
    if (savedLog && (await fm.verifyPermission(savedLog, 'read'))) {
      logFileHandle = savedLog;
      await loadIniLikeFile(savedLog, 'log');
    }
  } catch (err) { console.info('前回のWaypoint Log情報はありません:', err.message); }

  try {
    const savedLibrary = await fm.loadLastLibraryHandle();
    if (savedLibrary && (await fm.verifyPermission(savedLibrary, 'readwrite'))) {
      libraryFileHandle = savedLibrary;
      const text = await fm.readFile(libraryFileHandle);
      controllers.library.setAll(parseLibrary(text));
      markRead('library');
      markClean('library');
    }
  } catch (err) { console.info('前回のLocation Library情報はありません:', err.message); }

  refreshMapSelection();
  const savedMap = settingsStore.get('currentMap', '');
  if (availableMapNames.includes(savedMap)) {
    viewerMapName = savedMap;
    applyCurrentMapFilter(false);
  }

  setStatus('前回のセッション情報を復元しました(利用可能なファイルのみ)。');
}

/**
 * GameUserSettings.ini と Waypoint Log は全く同じファイル形式であるため、
 * この読込処理を共通関数として両方から再利用する。
 */
async function loadIniLikeFile(handle, listKey) {
  const text = await fm.readFile(handle);
  if (listKey === 'ini') iniOriginalText = text;

  const entries = parseSavedMinimapMarks(text);
  const list = entries.map((e) =>
    createWaypoint({ rawText: e.rawText, parsed: convertToWaypointData(e), source: SOURCE_FIELD[listKey] })
  );
  controllers[listKey].setAll(list);
  return list;
}

// --- ツールバー: GameUserSettings.ini ------------------------------------

// Read状態(✓表示)を管理するボタン要素のマップ。v0.5.0でツールバーは廃止され、
// Readボタンは各リストの空状態の中、Addボタンはリスト末尾の行に移った。
// Edit/Deleteは行内アイコン、SaveはStorage/Libraryでは自動保存に置き換わった。
// 例外としてGameUserSettings.iniはゲーム本体のファイルのため自動保存せず、
// v0.5.1でカラム見出し右端のSaveボタン+確認ダイアログによる手動保存に戻した。
const READ_BTN_EL = {};
const SAVE_BTN_EL = {}; // ini のみ

function bindToolbarEvents() {
  READ_BTN_EL.ini = els.iniReadBtn;
  READ_BTN_EL.storage = els.storageReadBtn;
  READ_BTN_EL.library = els.libraryReadBtn;
  SAVE_BTN_EL.ini = els.iniSaveBtn;
  SAVE_BTN_EL.storage = els.storageSaveBtn;

  els.iniReadBtn.addEventListener('click', onIniRead);
  els.iniAddBtn.addEventListener('click', () => openAddEditModal('ini', null));
  els.iniSaveBtn.addEventListener('click', onIniSave);

  els.storageReadBtn.addEventListener('click', onStorageRead);
  els.storageAddBtn.addEventListener('click', () => openAddEditModal('storage', null));
  els.storageSaveBtn.addEventListener('click', onStorageSave);

  els.libraryReadBtn.addEventListener('click', onLibraryRead);
  els.libraryAddBtn.addEventListener('click', () => openAddEditModal('library', null));

  els.logOpenBtn.addEventListener('click', onLogOpen);

  els.copyRawTextBtn.addEventListener('click', onCopyRawText);
}

/** Readボタンを「Read ✓」表示へ切り替える(再読込時も呼び直して最新状態を示す)。 */
function markRead(listKey) {
  const btn = READ_BTN_EL[listKey];
  if (!btn) return;
  btn.textContent = '[ Read ✓ ]';
  btn.classList.add('is-read');
}

/** 未保存の変更がある状態にする(iniのSaveボタンを有効化。対象ボタンが無いリストでは何もしない)。 */
function markDirty(listKey) {
  const btn = SAVE_BTN_EL[listKey];
  if (btn) btn.disabled = false;
}

/** 保存済み(未編集)の状態にする(iniのSaveボタンを無効化)。 */
function markClean(listKey) {
  const btn = SAVE_BTN_EL[listKey];
  if (btn) btn.disabled = true;
}

async function onIniRead() {
  try {
    const handle = await fm.pickIniFile();
    if (!handle) return;

    iniFileHandle = handle;
    await fm.saveLastIniHandle(handle);
    const list = await loadIniLikeFile(handle, 'ini');
    markRead('ini');
    markClean('ini');
    setStatus(`GameUserSettings.iniから${list.length}件のWaypointを読み込みました。`);
    refreshMapSelection();

    const { text: updatedText, added } = ensureWaypointManagerSection(iniOriginalText);
    if (added) {
      await fm.writeFile(iniFileHandle, updatedText);
      iniOriginalText = updatedText;
      setStatus('[ARKASAWaypointManager]セクションをGameUserSettings.iniへ追加しました。');
    }

    // My Storage(ARKASAWaypointManager_MyStorage.txt)がまだ紐付いていない
    // 場合、My Storageタブを開いて[Read]での新規作成を促す
    // (File System Access APIの制約上、ファイルパス名だけから
    //  自動でファイルを作成・特定することはできないため)
    if (!storageFileHandle) {
      switchLibraryTab('storage');
      setStatus(`My Storageタブの[Read]から ${STORAGE_FILE_NAME} を新規作成・読込してください。`);
    }
  } catch (err) {
    console.error(err);
    setStatus('GameUserSettings.iniの読み込み中にエラーが発生しました: ' + err.message);
  }
}

/** GameUserSettings.iniへの手動保存(v0.5.1で復活。カラム見出し右端のSaveボタン)。
 * ゲーム本体の設定ファイルを書き換えるため、毎回確認ダイアログを挟む。
 * 自動保存はしない(変更は markDirty でSaveボタンを有効化するだけ)。 */
async function onIniSave() {
  if (!iniFileHandle) { setStatus('先に[Read]でGameUserSettings.iniを読み込んでください。'); return; }
  const choice = await showChoiceDialog(
    'GameUserSettings.iniへの保存確認',
    'ゲーム本体の設定ファイル(SavedMinimapMarks)を書き換えます。\nこの操作は元に戻せません。続行しますか?',
    [{ key: 'overwrite', label: '上書き保存' }, { key: 'cancel', label: 'キャンセル' }]
  );
  if (choice !== 'overwrite') return;

  try {
    const granted = await fm.verifyPermission(iniFileHandle, 'readwrite');
    if (!granted) { setStatus('GameUserSettings.iniへの書き込み権限が許可されませんでした。'); return; }
    const newText = rebuildIniText(iniOriginalText, controllers.ini.getAll());
    await fm.writeFile(iniFileHandle, newText);
    iniOriginalText = newText;
    markClean('ini');
    setStatus(`GameUserSettings.iniへ保存しました(${controllers.ini.getAll().length}件)。`);
  } catch (err) {
    console.error(err);
    setStatus('GameUserSettings.iniの保存中にエラーが発生しました: ' + err.message);
  }
}

// --- ツールバー: My Storage -----------------------------------------------

async function onStorageRead() {
  try {
    // 「Read」は既存ファイルを開くための操作であるため、ネイティブのOpen
    // ダイアログ(showOpenFilePicker)を使う。v0.3.6よりMy Storageは
    // JSONではなくプレーンテキスト(.txt)形式のため、テキスト用の
    // ピッカーを使用する。
    const handle = await fm.pickOpenTextFile('ARK ASA My Storage (SavedMinimapMarks text)');
    if (!handle) return;
    storageFileHandle = handle;
    await fm.saveLastJsonHandle(handle);

    const text = await fm.readFile(handle);
    const list = parseStorage(text);
    controllers.storage.setAll(list);
    markRead('storage');
    markClean('storage');
    setStatus(`My Storageから${list.length}件のWaypointを読み込みました。`);
    refreshMapSelection();
  } catch (err) {
    console.error(err);
    setStatus('My Storageの読み込み中にエラーが発生しました: ' + err.message);
  }
}

/** My Storageの手動保存(v0.6.0でINIと同じくボタン式に変更。変更時はボタンが有効化される) */
async function onStorageSave() {
  if (!storageFileHandle) {
    setStatus('My Storage: 先にファイルを読み込んでください(Read)。');
    return;
  }
  try {
    const granted = await fm.verifyPermission(storageFileHandle, 'readwrite');
    if (!granted) {
      setStatus('My Storage: ファイルへの書き込み権限が許可されませんでした。');
      return;
    }
    await fm.writeFile(storageFileHandle, serializeStorage(controllers.storage.getAll()));
    markClean('storage');
    setStatus(`My Storageを保存しました(${controllers.storage.getAll().length} Waypoints)。`);
  } catch (err) {
    console.error(err);
    setStatus('My Storageの保存に失敗しました: ' + err.message);
  }
}

// --- ツールバー: Location Library ------------------------------------------

async function onLibraryRead() {
  try {
    // My Storageと同様、[Read]はネイティブのOpenダイアログを使う。
    const handle = await fm.pickOpenJsonFile('Location Library JSON');
    if (!handle) return;
    libraryFileHandle = handle;
    await fm.saveLastLibraryHandle(handle);

    const text = await fm.readFile(handle);
    const list = parseLibrary(text);
    controllers.library.setAll(list);
    markRead('library');
    markClean('library');
    setStatus(`Location Libraryから${list.length}件のWaypointを読み込みました。`);
    refreshMapSelection();
  } catch (err) {
    console.error(err);
    setStatus('Location Libraryの読み込み中にエラーが発生しました: ' + err.message);
  }
}

/** Location Libraryへの変更があるたびに自動保存する(自動保存はLibraryのみ。INIとMy Storageはv0.6.0から手動Save)。 */
async function autoSaveLibrary() {
  if (!libraryFileHandle) return;
  try {
    const granted = await fm.verifyPermission(libraryFileHandle, 'readwrite');
    if (!granted) return;
    await fm.writeFile(libraryFileHandle, serializeLibrary(controllers.library.getAll()));
    markClean('library');
  } catch (err) {
    console.warn('Location Libraryの自動保存に失敗しました:', err);
  }
}

// --- ツールバー: Waypoint Log ---------------------------------------------

async function onLogOpen() {
  try {
    const handle = await fm.pickLogFile();
    if (!handle) return;
    logFileHandle = handle;
    await fm.saveLastLogHandle(handle);
    const list = await loadIniLikeFile(handle, 'log');
    setStatus(`Waypoint Logから${list.length}件のWaypointを読み込みました。`);
    refreshMapSelection();
  } catch (err) {
    console.error(err);
    setStatus('Waypoint Logの読み込み中にエラーが発生しました: ' + err.message);
  }
}

async function onCopyRawText() {
  const text = els.detailRawText.value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    setStatus('RawTextをクリップボードへコピーしました。');
  } catch (err) {
    console.error(err);
    setStatus('クリップボードへのコピーに失敗しました。手動で選択してコピーしてください。');
  }
}

// --- 行内Delete処理(v0.5.0: 行のゴミ箱アイコンから呼ばれる。確認ダイアログは維持) ---

function onDeleteWaypoint(listKey, wp) {
  const confirmed = window.confirm(`Waypoint「${wp.parsed.name}」を${LABELS[listKey]}から削除しますか?`);
  if (!confirmed) return;

  controllers[listKey].remove(wp.id);
  setStatus(`Waypoint「${wp.parsed.name}」を${LABELS[listKey]}から削除しました。`);
  markDirty(listKey);
  AUTO_SAVE_HANDLERS[listKey]?.();
  refreshMapSelection(); // 削除でマップが消えた場合にCurrent Mapの選択肢と絞り込みを追随させる
}

// --- Add/Editモーダル -------------------------------------------------------

function bindModalEvents() {
  els.modalSaveBtn.addEventListener('click', onModalSave);
  els.modalCancelBtn.addEventListener('click', closeModal);
  els.formName.addEventListener('input', updateWaypointPreview);
  els.markIconPickerBtn.addEventListener('click', (e) => openIconPickerPopover(e));

  colorEditorApi = createColorEditor(els.colorEditor, defaultColor(), updateWaypointPreview);
  iconColorEditorApi = createColorEditor(els.iconColorEditor, defaultColor(), updateWaypointPreview);
}

async function openAddEditModal(listKey, id) {
  editingRef = { listKey, id };
  populateMapCandidates();

  // Category はLocation Library専用の管理情報(GameUserSettings.ini /
  // My Storageのデータには存在しない)ため、Location Library編集時のみ
  // Category欄を表示する。
  const isLibrary = listKey === 'library';
  els.formCategoryField.classList.toggle('hidden', !isLibrary);
  if (isLibrary) populateCategoryCandidates();

  if (id) {
    const wp = controllers[listKey].find(id);
    els.modalTitle.textContent = `Waypoint を編集 (${LABELS[listKey]})`;
    const config = await resolveMapConfig(resolveEffectiveMapName(wp.parsed.map, wp.parsed.z));
    const { lat, lon } = new CoordinateConverter(config).ueToGame(wp.parsed.x, wp.parsed.y);
    fillForm({ ...wp.parsed, lat, lon });
  } else {
    els.modalTitle.textContent = `Waypoint を追加 (${LABELS[listKey]})`;
    // MapNameの初期値はCurrent Mapの選択中マップ(v0.5.1: All Maps廃止のため、
    // データがあれば常に特定マップが選択されている。Genesis陸/海の別名は保存時に正規化される)
    const defaultMap = viewerMapName;
    fillForm({ ...createWaypoint().parsed, lat: 0, lon: 0, map: defaultMap });
  }
  els.editModal.classList.remove('hidden');
  els.formName.focus();
}

function closeModal() {
  els.editModal.classList.add('hidden');
  editingRef = null;
}

function fillForm(parsed) {
  els.formName.value = parsed.name;
  els.formCategory.value = parsed.category || '';
  els.formMap.value = parsed.map;
  els.formLat.value = formatCoord(parsed.lat);
  els.formLon.value = formatCoord(parsed.lon);
  els.formZ.value = parsed.z;
  els.formTag.value = parsed.customTag;

  colorEditorApi.setValue(parsed.color ?? defaultColor());
  iconColorEditorApi.setValue(parsed.iconColor ?? defaultColor());

  const def = findMarkIconByRawText(parsed.markIcon) ?? findMarkIconById(DEFAULT_MARK_ICON_ID);
  selectedMarkIconId = def.id;
  updateWaypointPreview();
}

function formatCoord(n) {
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0;
}

/**
 * Map入力欄のコンボボックス候補を GameUserSettings.ini 内のMapNameのみから生成する。
 * MODマップ等、候補にない値も自由入力できる(datalistは強制ではないため)。
 */
function populateMapCandidates() {
  const maps = new Set();
  for (const wp of controllers.ini.getAll()) {
    if (wp.parsed.map && wp.parsed.map.trim() !== '') maps.add(wp.parsed.map.trim());
  }
  // Genesis_WP がある場合は、陸・海の実効MapNameも候補へ出す
  // (保存時に Genesis_WP へ戻され、意図はZ座標で表される)
  if (maps.has(GENESIS_MAP_NAME)) {
    maps.add(GENESIS_LAND_MAP_NAME);
    maps.add(GENESIS_OCEAN_MAP_NAME);
  }
  const sorted = Array.from(maps).sort((a, b) => a.localeCompare(b, 'ja'));
  els.mapCandidates.innerHTML = sorted.map((m) => `<option value="${escapeHtml(m)}"></option>`).join('');
}

/**
 * Category入力欄のコンボボックス候補を生成する。
 * v0.3.6より、CategoryはLocation Library専用の管理情報になったため、
 * 候補もLocation Library自身に存在するCategoryのみから生成する
 * (GameUserSettings.ini / My Storageのデータには元々Categoryが
 *  存在しないため、候補源から除外した)。
 */
function populateCategoryCandidates() {
  const categories = new Set();
  for (const wp of controllers.library.getAll()) {
    const c = (wp.parsed.category || '').trim();
    if (c) categories.add(c);
  }
  const sorted = Array.from(categories).sort((a, b) => a.localeCompare(b, 'ja'));
  els.categoryCandidates.innerHTML = sorted.map((c) => `<option value="${escapeHtml(c)}"></option>`).join('');
}

// --- Color / IconColor(RGBA スライダー) ------------------------------------

const COLOR_CHANNELS = [
  { key: 'r', label: 'R' },
  { key: 'g', label: 'G' },
  { key: 'b', label: 'B' },
  { key: 'a', label: 'A' },
];

/**
 * RGBA(各0〜1)を、スライダー+数値入力がリアルタイムに同期する
 * UIとして構築する。呼び出し側は getValue()/setValue() のみを使う。
 * @param {HTMLElement} container
 * @param {{r:number,g:number,b:number,a:number}} initial
 * @param {() => void} onChange - 値が変化するたびに呼ばれる(Waypoint Preview更新用)
 * @returns {{getValue: () => object, setValue: (c:object) => void}}
 */
function createColorEditor(container, initial, onChange) {
  container.innerHTML = COLOR_CHANNELS.map((ch) => `
    <div class="color-channel" data-channel="${ch.key}">
      <label>${ch.label}</label>
      <input type="range" min="0" max="1" step="0.001" class="color-slider" data-channel="${ch.key}" />
      <input type="number" min="0" max="1" step="0.001" class="color-number" data-channel="${ch.key}" />
    </div>
  `).join('');

  const sliders = {};
  const numbers = {};
  for (const ch of COLOR_CHANNELS) {
    sliders[ch.key] = container.querySelector(`.color-slider[data-channel="${ch.key}"]`);
    numbers[ch.key] = container.querySelector(`.color-number[data-channel="${ch.key}"]`);
  }

  const setValue = (color) => {
    for (const ch of COLOR_CHANNELS) {
      const v = clamp01(color?.[ch.key] ?? 1);
      sliders[ch.key].value = String(v);
      numbers[ch.key].value = String(Math.round(v * 1000) / 1000);
    }
  };

  const getValue = () => ({
    r: clamp01(Number(numbers.r.value)),
    g: clamp01(Number(numbers.g.value)),
    b: clamp01(Number(numbers.b.value)),
    a: clamp01(Number(numbers.a.value)),
  });

  for (const ch of COLOR_CHANNELS) {
    sliders[ch.key].addEventListener('input', () => {
      numbers[ch.key].value = sliders[ch.key].value;
      onChange?.();
    });
    numbers[ch.key].addEventListener('input', () => {
      const v = clamp01(Number(numbers[ch.key].value));
      sliders[ch.key].value = String(v);
      onChange?.();
    });
  }

  setValue(initial);
  return { getValue, setValue };
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0, n));
}

// --- MarkIconピッカー(SVGアイコン付きカスタムドロップダウン) -----------------

function openIconPickerPopover(e) {
  closeIconPickerPopover();

  const popover = document.createElement('div');
  popover.className = 'icon-picker-popover';
  popover.innerHTML = MARK_ICON_DEFINITIONS.map((def) => `
    <div class="icon-picker-row ${def.id === selectedMarkIconId ? 'selected' : ''}" data-id="${def.id}">
      ${renderWaypointIconHtml({ type: def.id, baseColor: defaultColor(), iconColor: { r: 0.28, g: 0.82, b: 0.77, a: 1 }, size: 22, title: def.displayName }, () => openIconPickerPopover(e))}
      <span>${escapeHtml(def.displayName)}</span>
    </div>
  `).join('');
  document.body.appendChild(popover);

  const rect = e.target.getBoundingClientRect();
  popover.style.top = `${rect.bottom + 4}px`;
  popover.style.left = `${rect.left}px`;

  popover.querySelectorAll('.icon-picker-row').forEach((row) => {
    row.addEventListener('click', () => {
      selectedMarkIconId = row.dataset.id;
      updateWaypointPreview();
      closeIconPickerPopover();
    });
  });

  els._iconPickerPopover = popover;
  setTimeout(() => {
    els._iconPickerOutsideHandler = (evt) => {
      if (!popover.contains(evt.target) && evt.target !== els.markIconPickerBtn) closeIconPickerPopover();
    };
    document.addEventListener('click', els._iconPickerOutsideHandler);
  }, 0);
}

function closeIconPickerPopover() {
  if (els._iconPickerPopover) { els._iconPickerPopover.remove(); els._iconPickerPopover = null; }
  if (els._iconPickerOutsideHandler) { document.removeEventListener('click', els._iconPickerOutsideHandler); els._iconPickerOutsideHandler = null; }
}

// --- Waypoint Preview(右側のリアルタイムプレビュー) -------------------------

function updateWaypointPreview() {
  const def = findMarkIconById(selectedMarkIconId);
  els.markIconPickerBtn.innerHTML = `${renderWaypointIconHtml({ type: def.id, baseColor: colorEditorApi?.getValue() ?? defaultColor(), iconColor: iconColorEditorApi?.getValue() ?? defaultColor(), size: 22 }, updateWaypointPreview)}<span>${escapeHtml(def.displayName)}</span>`;

  mountWaypointIcon(els.waypointPreview, {
    type: def.id,
    baseColor: colorEditorApi?.getValue() ?? defaultColor(),
    iconColor: iconColorEditorApi?.getValue() ?? defaultColor(),
    size: 64,
  });
  els.waypointPreviewName.textContent = els.formName.value.trim() || '(無名)';
}

async function onModalSave() {
  let map = els.formMap.value.trim();
  let zValue = els.formZ.value;
  const lat = Number(els.formLat.value);
  const lon = Number(els.formLon.value);

  if (isNaN(lat) || isNaN(lon)) {
    alert('Lat / Lon は数値を入力してください。');
    return;
  }

  // Genesis の実効MapName(Genesis1_WP / Genesis1Ocean_WP)が入力された場合は、
  // INI上の正式名 Genesis_WP へ戻し、意図はZ座標で表す。Zが意図と反対側の
  // 範囲にある場合は、各バイオームの代表Z(実測の基準点Z)へ寄せる。
  // これにより、アプリで作成したWaypointもZ判別で正しく振り分けられ、
  // INIへ書き戻されるMapNameは常に Genesis_WP になる。
  if (map === GENESIS_OCEAN_MAP_NAME) {
    map = GENESIS_MAP_NAME;
    if (!(Number(zValue) >= GENESIS_OCEAN_Z_THRESHOLD)) zValue = String(GENESIS_OCEAN_DEFAULT_Z);
  } else if (map === GENESIS_LAND_MAP_NAME) {
    map = GENESIS_MAP_NAME;
    if (Number(zValue) >= GENESIS_OCEAN_Z_THRESHOLD) zValue = String(GENESIS_LAND_DEFAULT_Z);
  }

  // Lat/Lon(ゲーム内マップ座標)をUE座標へ変換する。
  // 座標計算そのものはCoordinateConverter/MapConfigが担い、ここでは呼び出すのみ。
  // Genesis_WP の場合はZで振り分けた実効MapNameの config を使う。
  const config = await resolveMapConfig(resolveEffectiveMapName(map, Number(zValue)));
  const { x, y } = new CoordinateConverter(config).gameToUe(lat, lon);
  const markIconDef = findMarkIconById(selectedMarkIconId);

  const parsed = {
    name: els.formName.value.trim(),
    map,
    x, y,
    z: zValue,
    customTag: els.formTag.value.trim(),
    // Categoryは Location Library専用の管理情報。GameUserSettings.ini /
    // My Storageのデータには保持しない(要件2への対応)。
    category: editingRef.listKey === 'library' ? els.formCategory.value.trim() : '',
    markIcon: markIconDef.rawText,
    color: colorEditorApi.getValue(),
    iconColor: iconColorEditorApi.getValue(),
  };

  const errors = validateWaypoint(parsed);
  if (errors.length > 0) { alert(errors.join('\n')); return; }

  const { listKey, id } = editingRef;
  const controller = controllers[listKey];

  // 要件5: Save時、保存対象リスト内に同じCustomTagが存在するか確認する
  // (Nameではなく、CustomTagを判定対象とする。編集中の自分自身は対象外)
  let finalParsed = parsed;
  let removeConflictId = null;
  const tag = parsed.customTag.trim();

  if (tag !== '') {
    const conflict = controller.getAll().find((w) => w.id !== id && (w.parsed.customTag || '').trim() === tag);
    if (conflict) {
      const choice = await showChoiceDialog(
        'CustomTag重複の確認',
        'CustomTag が既に存在します。',
        [{ key: 'overwrite', label: '上書き' }, { key: 'rename', label: '連番追加' }, { key: 'cancel', label: 'キャンセル' }]
      );
      if (choice === 'cancel' || !choice) return; // モーダルは開いたまま(保存を中断)
      if (choice === 'overwrite') {
        removeConflictId = conflict.id;
      } else if (choice === 'rename') {
        const others = controller.getAll().filter((w) => w.id !== id);
        finalParsed = { ...parsed, customTag: generateUniqueTag(tag, others) };
      }
    }
  }

  if (id) {
    if (removeConflictId && removeConflictId !== id) controller.remove(removeConflictId);
    const original = controller.find(id);
    const newRawText = buildRawText(original?.rawText ?? '', finalParsed);
    const updated = createWaypoint({ id, rawText: newRawText, parsed: finalParsed, source: original?.source });
    controller.replace(id, updated);
    controller.setSelectedId(id);
    handleSelect(updated, listKey);
    setStatus(`Waypoint「${finalParsed.name}」を${LABELS[listKey]}で更新しました。`);
  } else {
    if (removeConflictId) controller.remove(removeConflictId);
    const rawText = buildRawText('', finalParsed);
    const created = createWaypoint({ rawText, parsed: finalParsed, source: SOURCE_FIELD[listKey] });
    controller.add(created);
    controller.setSelectedId(created.id);
    handleSelect(created, listKey);
    setStatus(`Waypoint「${finalParsed.name}」を${LABELS[listKey]}へ追加しました。`);
  }

  refreshMapSelection();
  markDirty(listKey);
  AUTO_SAVE_HANDLERS[listKey]?.();
  closeModal();
}

// --- ドラッグ&ドロップ(4リスト全方向・共通の競合処理) -----------------------

function bindDragAndDrop() {
  controllers.ini.bindDragEvents();
  controllers.storage.bindDragEvents();
  controllers.library.bindDragEvents();
  controllers.log.bindDragEvents();

  const zones = [
    { key: 'ini', el: els.iniDropZone },
    { key: 'storage', el: els.storageDropZone },
    { key: 'library', el: els.libraryDropZone },
    { key: 'log', el: els.logDropZone },
  ];

  for (const zone of zones) {
    zone.el.addEventListener('dragover', (e) => { e.preventDefault(); zone.el.classList.add('drag-over'); });
    zone.el.addEventListener('dragleave', () => zone.el.classList.remove('drag-over'));
    zone.el.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.el.classList.remove('drag-over');
      onDrop(e, zone.key);
    });
  }
}

function onDrop(e, targetKey) {
  let payload;
  try { payload = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
  if (!payload?.listKey || !payload?.id || payload.listKey === targetKey) return;

  const wp = controllers[payload.listKey].find(payload.id);
  if (!wp) return;

  moveWaypoint(payload.listKey, targetKey, wp);
}

/**
 * Waypointをsource側からtarget側へ移動/コピーする。
 * - source が ini/storage/library(編集可能リスト)の場合は移動元から削除する(真の移動)。
 * - source が log(読み取り専用の参照元)の場合は移動元を変更しない(コピー)。
 * - target が log の場合は、編集機能自体が無いため衝突確認を行わず
 *   そのまま追加する(「追加のみ・編集禁止」の要件に対応)。
 * - target が ini/storage/library の場合は、①座標衝突 → ②CustomTag衝突 の順で
 *   共通の競合処理を行う。
 */
async function moveWaypoint(sourceKey, targetKey, wp) {
  const removesFromSource = EDITABLE_LISTS.has(sourceKey);
  const wasSelected = !!(currentSelection && currentSelection.listKey === sourceKey && currentSelection.waypoint.id === wp.id);

  const finalize = (newWp) => {
    if (removesFromSource) controllers[sourceKey].remove(wp.id);
    refreshMapSelection();
    if (removesFromSource && wasSelected) {
      controllers[targetKey].setSelectedId(newWp.id);
      handleSelect(newWp, targetKey);
    } else if (currentSelection) {
      handleSelect(currentSelection.waypoint, currentSelection.listKey);
    }
    markDirty(targetKey);
    AUTO_SAVE_HANDLERS[targetKey]?.();
    if (removesFromSource) {
      markDirty(sourceKey);
      AUTO_SAVE_HANDLERS[sourceKey]?.();
    }
  };

  if (!EDITABLE_LISTS.has(targetKey)) {
    // Location Library / Waypoint Log は編集不可のため、衝突確認なしで追加のみ行う
    const copy = createWaypoint({ id: wp.id, rawText: wp.rawText, parsed: { ...wp.parsed }, source: SOURCE_FIELD[targetKey] });
    controllers[targetKey].add(copy);
    finalize(copy);
    setStatus(`Waypoint「${wp.parsed.name}」を${LABELS[targetKey]}へ追加しました。`);
    return;
  }

  const targetList = controllers[targetKey].getAll();

  // ① 座標衝突確認
  const locationConflict = targetList.find((existing) => isSameLocation(existing, wp));
  if (locationConflict) {
    const choice = await showChoiceDialog(
      '座標衝突の確認',
      `${LABELS[targetKey]}に同一座標のWaypoint「${locationConflict.parsed.name}」が既に存在します。\n上書きしますか?`,
      [{ key: 'overwrite', label: '上書き' }, { key: 'cancel', label: 'キャンセル' }]
    );
    if (choice !== 'overwrite') return;
    const merged = createWaypoint({ id: locationConflict.id, rawText: wp.rawText, parsed: { ...wp.parsed }, source: SOURCE_FIELD[targetKey] });
    controllers[targetKey].replace(locationConflict.id, merged);
    finalize(merged);
    setStatus(`Waypoint「${wp.parsed.name}」を${LABELS[targetKey]}へ移動しました(上書き)。`);
    return;
  }

  // ② CustomTag衝突確認
  const tagConflict = targetList.find((existing) => isSameCustomTag(existing, wp));
  if (tagConflict) {
    const choice = await showChoiceDialog(
      'CustomTag衝突の確認',
      `${LABELS[targetKey]}に同一のCustomTag「${wp.parsed.customTag}」を持つWaypointが既に存在します。`,
      [{ key: 'rename', label: '末尾番号追加' }, { key: 'overwrite', label: '上書き' }, { key: 'cancel', label: 'キャンセル' }]
    );
    if (choice === 'cancel' || !choice) return;

    if (choice === 'overwrite') {
      const merged = createWaypoint({ id: tagConflict.id, rawText: wp.rawText, parsed: { ...wp.parsed }, source: SOURCE_FIELD[targetKey] });
      controllers[targetKey].replace(tagConflict.id, merged);
      finalize(merged);
      setStatus(`Waypoint「${wp.parsed.name}」を${LABELS[targetKey]}へ移動しました(上書き)。`);
      return;
    }

    const newTag = generateUniqueTag(wp.parsed.customTag, targetList);
    const renamed = createWaypoint({ id: wp.id, rawText: wp.rawText, parsed: { ...wp.parsed, customTag: newTag }, source: SOURCE_FIELD[targetKey] });
    controllers[targetKey].add(renamed);
    finalize(renamed);
    setStatus(`Waypoint「${wp.parsed.name}」を${LABELS[targetKey]}へ移動しました(CustomTag: ${newTag})。`);
    return;
  }

  // 衝突なし
  const moved = createWaypoint({ id: wp.id, rawText: wp.rawText, parsed: { ...wp.parsed }, source: SOURCE_FIELD[targetKey] });
  controllers[targetKey].add(moved);
  finalize(moved);
  setStatus(`Waypoint「${wp.parsed.name}」を${LABELS[sourceKey]}から${LABELS[targetKey]}へ移動しました。`);
}

// --- 汎用選択ダイアログ(Promiseベース) ------------------------------------

function showChoiceDialog(title, message, choices) {
  return new Promise((resolve) => {
    els.choiceTitle.textContent = title;
    els.choiceMessage.textContent = message;
    els.choiceButtons.innerHTML = '';

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      els.choiceModal.classList.add('hidden');
      resolve(value);
    };

    for (const choice of choices) {
      const btn = document.createElement('button');
      btn.className = 'btn-bracket' + (choice.key === 'cancel' ? '' : ' btn-accent');
      btn.textContent = `[ ${choice.label} ]`;
      btn.addEventListener('click', () => finish(choice.key));
      els.choiceButtons.appendChild(btn);
    }
    els.choiceModal.classList.remove('hidden');
  });
}

// --- Libraryタブ切替 ---------------------------------------------------------

function bindLibraryTabs() {
  els.libraryTabs.querySelectorAll('.library-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchLibraryTab(btn.dataset.tab));
  });
}

function switchLibraryTab(tab) {
  activeLibraryTab = tab;
  els.libraryTabs.querySelectorAll('.library-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.library-tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.listKey === tab);
  });
  settingsStore.set('activeLibraryTab', tab);
  refreshMapViewers(); // 右の地図の表示元をタブに追随させる(v0.6.0)
}

// --- Splitter(左右カラム幅、ドラッグで変更・保存) ---------------------------

function bindSplitter() {
  els.mainSplitter.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = els.colIni.getBoundingClientRect().width;

    const onMove = (moveEvent) => {
      const newWidth = Math.max(240, Math.round(startWidth + (moveEvent.clientX - startX)));
      els.colIni.style.flex = `0 0 ${newWidth}px`;
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      settingsStore.set('layout.iniColumnWidth', els.colIni.getBoundingClientRect().width);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

/** 地図エリアの高さSplitter(ドラッグで変更・保存、v0.4.0) */
function bindMapsSplitter() {
  els.mapsSplitter.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = els.mapsRow.getBoundingClientRect().height;

    const onMove = (moveEvent) => {
      const newHeight = Math.min(640, Math.max(180, Math.round(startHeight + (moveEvent.clientY - startY))));
      els.mapsRow.style.height = `${newHeight}px`;
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      settingsStore.set('layout.mapsRowHeight', Math.round(els.mapsRow.getBoundingClientRect().height));
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

/** 地図エリアの表示/非表示トグル(v0.4.1)。リストを広く使いたいとき用 */
function bindMapsToggle() {
  els.mapsToggleBtn.addEventListener('click', () => {
    applyMapsCollapsed(!els.mapsRow.classList.contains('hidden'), true);
  });
}

function applyMapsCollapsed(collapsed, persist) {
  els.mapsRow.classList.toggle('hidden', collapsed);
  els.mapsSplitter.classList.toggle('hidden', collapsed);
  els.mapsToggleBtn.textContent = collapsed ? '[ 地図を表示 ]' : '[ 地図を隠す ]';
  if (persist) settingsStore.set('layout.mapsCollapsed', collapsed);
  if (!collapsed) refreshMapViewers();
}

function restoreLayoutSettings() {
  const savedWidth = settingsStore.get('layout.iniColumnWidth', null);
  if (savedWidth) els.colIni.style.flex = `0 0 ${savedWidth}px`;

  const debugMode = settingsStore.get('debugMode', false);
  let savedTab = settingsStore.get('activeLibraryTab', 'storage');
  if (savedTab === 'calibration' && !debugMode) savedTab = 'storage'; // Debug Mode OFF時は復元しない
  if (savedTab === 'mapviewer') savedTab = 'storage'; // v0.4.0でMap Viewerタブは廃止(地図は常時表示)
  switchLibraryTab(savedTab);

  const savedMapsHeight = settingsStore.get('layout.mapsRowHeight', null);
  if (savedMapsHeight) els.mapsRow.style.height = `${savedMapsHeight}px`;

  if (settingsStore.get('layout.mapsCollapsed', false)) applyMapsCollapsed(true, false);
}

// --- ヘッダー(Settings: Debug Modeトグルを含む) -----------------------------------

function bindHeaderEvents() {
  els.settingsBtn.addEventListener('click', () => els.settingsModal.classList.remove('hidden'));
  els.settingsCloseBtn.addEventListener('click', () => els.settingsModal.classList.add('hidden'));
}

// --- Debug Mode ------------------------------------------------------------

function bindDebugMode() {
  const enabled = settingsStore.get('debugMode', false);
  els.debugModeCheckbox.checked = enabled;
  applyDebugMode(enabled, false);

  els.debugModeCheckbox.addEventListener('change', () => {
    applyDebugMode(els.debugModeCheckbox.checked, true);
  });
}

/**
 * Debug Modeの有効/無効をUIへ反映する。
 * OFFの間はMap Calibrationタブ自体を非表示にし(要件6「デバッグ機能は
 * 一切表示しないでください」)、ONになった瞬間にCurrent Mapとの同期を行う。
 * @param {boolean} enabled
 * @param {boolean} persist - trueならsettingsStoreへ保存する(初期復元時はfalse)
 */
function applyDebugMode(enabled, persist) {
  els.calibrationTabBtn.classList.toggle('hidden', !enabled);
  document.getElementById('tabpanel-calibration').classList.toggle('hidden', !enabled);
  if (persist) settingsStore.set('debugMode', enabled);

  if (!enabled) {
    const activePanel = document.querySelector('.library-tab-panel.active');
    if (activePanel && activePanel.dataset.listKey === 'calibration') switchLibraryTab('storage');
  } else {
    syncCalibrationToCurrentMap();
  }
}

// --- Map Calibration / MapConfig Manager(Debug Mode専用) --------------------
//
// このセクションはUI配線のみを行う。実際の計算は map_calibration.js
// (calculateMapConfig/autoDetectCalibrationPoints)に、MapConfigの
// 読み書き・検証は map_config.js(saveMapConfigToProject/validateMapConfig)に、
// 座標変換は coordinate_converter.js にそれぞれ分離してあり、ここには
// 計算式やファイルパスの組み立てルールを一切書かない。
//
// v0.3.2でMap選択欄は廃止し、画面上部のCurrent Mapをそのまま対象として使う
// (syncCalibrationToCurrentMapがapplyCurrentMapFilter()から呼ばれる)。

function bindCalibrationEvents() {
  els.calibrationAutoDetectBtn.addEventListener('click', onAutoDetect);
  els.calibrationCalculateBtn.addEventListener('click', onCalculate);
  els.calibrationSaveBtn.addEventListener('click', onSaveMapConfig);
}

/**
 * Current Mapの変更をMap Calibrationパネルへ反映する。
 * Current Mapが「All Maps」の場合は対象マップが定まらないため、
 * 通知を表示し、Auto Detect/Calculateを無効化する。
 */
function syncCalibrationToCurrentMap() {
  const mapName = viewerMapName;
  const hasTarget = !!mapName;

  els.calibrationTargetMapLabel.textContent = hasTarget ? mapName : '-';
  els.calibrationNoMapNotice.classList.toggle('hidden', hasTarget);
  els.calibrationAutoDetectBtn.disabled = !hasTarget;
  els.calibrationSaveBtn.disabled = true;

  lastCalibrationResult = null;
  els.calibrationResult.classList.add('hidden');
  els.calibrationValidateResult.classList.add('hidden');
  els.calibrationSaveMessage.classList.add('hidden');

  renderCalibrationTable();
}

/** 5つの固定キャリブレーションポイントの入力行を描画する */
function renderCalibrationTable() {
  els.calibrationTableBody.innerHTML = CALIBRATION_POINTS.map((p) => `
    <tr data-point-id="${p.id}">
      <td>${escapeHtml(p.name)} (Lat ${p.lat}, Lon ${p.lon})</td>
      <td class="num"><input type="number" step="any" class="cal-x" data-point-id="${p.id}" /></td>
      <td class="num"><input type="number" step="any" class="cal-y" data-point-id="${p.id}" /></td>
      <td class="cal-detect" data-point-id="${p.id}"></td>
    </tr>
  `).join('');

  els.calibrationTableBody.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', () => {
      lastCalibrationResult = null;
      els.calibrationSaveBtn.disabled = true;
      els.calibrationResult.classList.add('hidden');
      els.calibrationValidateResult.classList.add('hidden');
      els.calibrationSaveMessage.classList.add('hidden');
      updateCalculateButtonState();
    });
  });
  els.calibrationDetectSummary.textContent = '';
  updateCalculateButtonState();
}

function calibrationInput(pointId, axis) {
  return els.calibrationTableBody.querySelector(`.cal-${axis}[data-point-id="${pointId}"]`);
}

/**
 * Calculateボタンは、Current Mapが特定のマップを指しており、かつ
 * 5点すべてのUE X/Yが数値として入力されている場合のみ有効化する。
 */
function updateCalculateButtonState() {
  const mapName = viewerMapName;
  const hasTarget = !!mapName;
  const allValid = hasTarget && CALIBRATION_POINTS.every((p) => {
    const xInput = calibrationInput(p.id, 'x');
    const yInput = calibrationInput(p.id, 'y');
    return xInput?.value !== '' && yInput?.value !== '' && !isNaN(Number(xInput.value)) && !isNaN(Number(yInput.value));
  });
  els.calibrationCalculateBtn.disabled = !allValid;
}

/**
 * GameUserSettings.ini(iniカラム)から、CAL_0_0等のName(CustomTagではない)に
 * 一致するWaypointを検索し、見つかった分だけUE X/Yへ自動入力する。
 */
function onAutoDetect() {
  const detected = autoDetectCalibrationPoints(controllers.ini.getAll());
  let count = 0;

  for (const p of CALIBRATION_POINTS) {
    const cell = els.calibrationTableBody.querySelector(`.cal-detect[data-point-id="${p.id}"]`);
    const xInput = calibrationInput(p.id, 'x');
    const yInput = calibrationInput(p.id, 'y');
    const found = detected[p.id];

    if (found) {
      xInput.value = found.x;
      yInput.value = found.y;
      cell.textContent = '✔';
      cell.className = 'cal-detect detect-ok';
      count += 1;
    } else {
      cell.textContent = '✖';
      cell.className = 'cal-detect detect-fail';
    }
  }

  els.calibrationDetectSummary.textContent = `${count} / ${CALIBRATION_POINTS.length} detected`;
  updateCalculateButtonState();
  setStatus(`Auto Detect: ${count} / ${CALIBRATION_POINTS.length} 件のキャリブレーションポイントを検出しました。`);
}

/** 5点のUE座標からMapConfigを算出し(map_calibration.js)、結果を表示する */
function onCalculate() {
  const mapName = viewerMapName;
  if (!mapName) {
    setStatus('Map Calibration: Current Mapで特定のMapを選択してください。');
    return;
  }

  const uePoints = {};
  for (const p of CALIBRATION_POINTS) {
    uePoints[p.id] = { x: Number(calibrationInput(p.id, 'x').value), y: Number(calibrationInput(p.id, 'y').value) };
  }

  const result = calculateMapConfig(mapName, uePoints);
  lastCalibrationResult = result;
  setCachedMapConfig(mapName, result.config);

  els.calibrationResultText.textContent = [
    `MapName: ${mapName}`,
    `LatitudeScale: ${result.config.latitudeScale}`,
    `LongitudeScale: ${result.config.longitudeScale}`,
    `LatitudeOrigin: ${result.config.latitudeOrigin}`,
    `LongitudeOrigin: ${result.config.longitudeOrigin}`,
    `Axis: ${result.axisReport}`,
    `Residual Error: ${result.residualError.toFixed(4)}`,
    ...(result.warnings.length ? ['', ...result.warnings.map((w) => `⚠ ${w}`)] : []),
  ].join('\n');
  els.calibrationResult.classList.remove('hidden');
  els.calibrationValidateResult.classList.add('hidden'); // 新しい計算をしたら前回のValidate/Save結果は隠す
  els.calibrationSaveMessage.classList.add('hidden');
  els.calibrationSaveBtn.disabled = false;

  // 算出したMapConfigを即座に一覧のLat/Lon表示へ反映する
  for (const key of LIST_KEYS) controllers[key].render();
  setStatus(`MapConfigを計算しました(Residual Error: ${result.residualError.toFixed(4)})。`);
}

/**
 * 算出済みのMapConfigを maps/<MapName>/config.json へ保存する
 * (保存先はCurrent Mapから自動決定し、ユーザーへは問い合わせない。
 *  ただしブラウザの制約上、maps/ルートフォルダの選択のみ初回に必要。
 *  詳細は map_config.js のコメントを参照)。
 * 地図画像 / waypoint.json が存在しない場合は空ファイルとして自動生成される。
 * 保存後はValidateチェックリストを表示する。
 */
async function onSaveMapConfig() {
  if (!lastCalibrationResult) { setStatus('先に[Calculate]を実行してください。'); return; }

  try {
    const saveResult = await saveMapConfigToProject(lastCalibrationResult.config);

    if (saveResult.cancelled) {
      setStatus('MapConfigの保存をキャンセルしました(maps/フォルダが選択されませんでした)。');
      return;
    }
    if (!saveResult.success) {
      setStatus('MapConfigの保存に失敗しました: ' + (saveResult.error ?? '不明なエラー'));
      return;
    }

    renderCalibrationValidateResult(lastCalibrationResult.config, saveResult);

    // 要件通りの確認メッセージ("MapConfig saved.\nmaps/Aberration/config.json")を表示する
    els.calibrationSaveMessage.textContent = `MapConfig saved.\n${saveResult.configPath}`;
    els.calibrationSaveMessage.classList.remove('hidden');

    const notes = [];
    if (saveResult.mapPngCreated) notes.push(`地図画像を空ファイルとして新規作成しました(${saveResult.mapPngPath})。実際の地図画像に差し替えてください。`);
    if (saveResult.waypointJsonCreated) notes.push(`waypoint.jsonを空ファイルとして新規作成しました(${saveResult.waypointJsonPath})。`);

    setStatus(`MapConfigを ${saveResult.configPath} へ保存しました(保存内容を再読み込みして検証済み)。${notes.join(' ')}`);
  } catch (err) {
    console.error(err);
    setStatus('MapConfigの保存中にエラーが発生しました: ' + err.message);
  }
}

function renderCalibrationValidateResult(mapConfig, saveResult) {
  const checks = validateMapConfig(mapConfig, saveResult);
  els.calibrationValidateList.innerHTML = checks.map((c) => `
    <li class="${c.ok ? 'ok' : 'fail'}">${c.ok ? '✔' : '✖'} ${escapeHtml(c.label)}${c.detail ? `<span class="calibration-validate-detail">${escapeHtml(c.detail)}</span>` : ''}</li>
  `).join('');
  els.calibrationValidateResult.classList.remove('hidden');
}

// --- ユーティリティ -------------------------------------------------------

function setStatus(message) { els.statusText.textContent = message; }
function formatNum(n) { return Number.isFinite(n) ? String(n) : '0'; }
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

// --- スマートフォンアクセス警告(起動前ゲート) --------------------------------
//
// 「このアプリはPC向けに設計されています」という要件のため、init()を
// 呼び出す前にスマートフォンでのアクセスを検知し、確認ダイアログを表示する。
// [続行]が押された場合のみ通常通りinit()を実行する。[戻る]の場合は
// 履歴を戻ることを試み、戻り先が無い環境向けにフォールバック表示も行う。

function isLikelyMobileDevice() {
  const ua = navigator.userAgent || '';
  const uaLooksMobile = /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i.test(ua);
  const narrowViewport = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 600px)').matches;
  return uaLooksMobile || narrowViewport;
}

function startApp() {
  if (!isLikelyMobileDevice()) {
    init();
    return;
  }

  const overlay = document.getElementById('mobileWarningOverlay');
  const backBtn = document.getElementById('mobileBackBtn');
  const continueBtn = document.getElementById('mobileContinueBtn');
  if (!overlay || !backBtn || !continueBtn) { init(); return; } // 万一マークアップが無い場合は通常起動する

  overlay.classList.remove('hidden');

  backBtn.addEventListener('click', () => {
    window.history.back();
    // 戻り先が無い(直接開いた等)環境向けのフォールバック
    setTimeout(() => {
      document.body.innerHTML = '<p style="padding:40px;text-align:center;color:#7c8b96;font-family:monospace;">このタブを閉じてご利用ください。</p>';
    }, 400);
  });

  continueBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
    init();
  }, { once: true });
}

startApp();
