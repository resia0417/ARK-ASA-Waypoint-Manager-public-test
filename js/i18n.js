// =============================================================
// i18n.js
// UIテキストの日本語/英語辞書と、表示言語の保持・適用。
//
// 方針:
// - 表示言語は Settings で切り替え、settingsStore の 'uiLang' に保存する
//   (このモジュールは言語の「現在の値」だけを持ち、永続化は app.js が行う)。
// - リスト名(My Storage / Location Library / Waypoint Log /
//   GameUserSettings.ini)やフィールド名(CustomTag / MarkIcon / RawText 等)
//   は固有名詞として両言語で共通とし、翻訳対象にしない。
// - [ Save ] / [ Load ] のようなブラケット付きボタン表記も両言語で共通
//   (ステータス文中の「[Load]から読み込んでください」という参照と一致させる)。
// =============================================================

const STRINGS = {
  ja: {
    // --- ヘッダー ---
    'status.initial': 'GameUserSettings.ini を読み込んでください。',
    'header.reconnect': '[ 前回のファイルを再接続 ]',
    'header.mapsShowAll': '[ 全Waypoint表示 ]',
    'header.mapsPerMap': '[ マップ別表示に戻す ]',
    'header.settings': '設定',
    'maps.selectTitle': '表示するマップ',
    'maps.showing': '{n} Waypoints を表示中',
    'splitter.mapsTitle': 'ドラッグして地図の高さを変更',
    'splitter.mainTitle': 'ドラッグして幅を変更',

    // --- リスト共通 ---
    'search.placeholder': '検索',
    'count.waypoints': '{n}件',
    'btn.addWaypoint': '＋ Waypointを追加',
    'btn.openLog': '[ ログを開く ]',
    'empty.ini': 'GameUserSettings.iniを読み込んでください。',
    'empty.storage': 'Waypointがまだありません。下の「Waypointを追加」で追加するか、他のリストからドラッグしてください。',
    'empty.library': 'Location Libraryのファイルを読み込んでください。',
    'empty.log': 'Python版WaypointLoggerの出力ファイルを開いてください。',
    'category.all': '全カテゴリ',
    'category.none': '(未設定)',
    'col.icon': 'Icon',
    'col.name': 'Name',
    'col.map': 'Map',

    // --- 詳細バー ---
    'detail.placeholder': 'Waypointを選択すると詳細が表示されます。',
    'btn.copy': '[ コピー ]',

    // --- 追加/編集モーダル ---
    'modal.addTitle': 'Waypoint を追加',
    'modal.editTitle': 'Waypoint を編集 ({list})',
    'modal.close': '閉じる',
    'modal.deleteTitle': 'このWaypointを削除',
    'form.namePlaceholder': '例: Base Camp',
    'form.tagPlaceholder': '任意',
    'form.zNote': '(UE座標)',
    'form.mapPlaceholder': '例: TheIsland_WP(自由入力可)',
    'preview.label': 'Waypoint プレビュー',
    'color.base': 'ベースカラー',
    'color.icon': 'アイコンカラー',

    // --- 汎用ダイアログ ---
    'choice.defaultTitle': '確認',
    'btn.overwrite': '上書き',
    'btn.cancel': 'キャンセル',
    'btn.renameSuffix': '末尾番号追加',

    // --- Settings ---
    'settings.title': '設定',
    'settings.displaySection': '表示',
    'settings.langLabel': '表示言語(UIとLocation Libraryの名前)',
    'settings.savedSection': '保存される設定',
    'settings.descSaved': 'Splitter位置・選択中のMap・Libraryタブ・列幅・検索文字・ソート状態は、自動的に保存されます。',
    'settings.descReset': 'リセットすると、これらの設定と前回開いたファイルの記憶が、初期状態に戻ります。',
    'settings.reset': '[ 設定をリセット ]',
    'settings.resetConfirm': '保存されている設定(レイアウト・選択中のMap・タブ・列幅・検索文字・ソート)と、前回のセッション情報(前回開いたファイルの記憶)をすべて初期状態に戻しますか？',

    // --- スマートフォン警告 ---
    'mobile.text': 'このアプリはPC向けに設計されています。スマートフォンでは正常に利用できません。続行しますか?',
    'mobile.back': '[ 戻る ]',
    'mobile.continue': '[ 続行 ]',

    // --- 地図 ---
    'notice.loading': '読み込み中…',
    'notice.noMaps': '表示できるマップがありません。',
    'notice.noConfig': 'このマップの座標設定(config.json)が見つからないため、Lat/Lonを表示できません。',
    'notice.imageError': '地図画像が読み込めませんでした({url})。実画像が配置されているか確認してください。',
    'map.unnamed': '(無名)',

    // --- ステータス: 共通 ---
    'status.unsupportedBrowser': 'このブラウザはFile System Access APIに未対応です。Chrome/Edgeでの利用を推奨します。',
    'status.restored': '前回のセッション情報を復元しました({lists})。{notices}',
    'status.restoredNeedReconnect': '前回のセッション情報を復元しました({lists})。一部のファイルは再接続が必要です。{notices}',
    'status.needReconnect': '前回のファイルへのアクセス許可が必要です。[ 前回のファイルを再接続 ]を押してください。',
    'status.bundledLibrary': 'Location Library(同梱データ)から{n}件のWaypointを表示しています。',
    'status.reconnected': '再接続しました({lists})。{notices}',
    'status.reconnectDenied': '再接続が許可されませんでした。利用するファイルは[Load]から読み込み直してください。',
    'notice.incompleteLines': '座標が不完全な行が{n}件あります。',
    'notice.unrecognizedLines': '未認識の行が{n}件あります(壊れている可能性があります)。',
    'status.deleted': 'Waypoint「{name}」を{list}から削除しました。',
    'status.updated': 'Waypoint「{name}」を{list}で更新しました。',
    'status.added': 'Waypoint「{name}」を{list}へ追加しました。',
    'status.movedOverwrite': 'Waypoint「{name}」を{list}へ{verbPast}しました(上書き)。',
    'status.movedRenamed': 'Waypoint「{name}」を{list}へ{verbPast}しました(CustomTag: {tag})。',
    'verb.move': '移動',
    'verb.copy': 'コピー',
    'verb.movePast': '移動',
    'verb.copyPast': 'コピー',
    'status.copiedRaw': 'RawTextをクリップボードへコピーしました。',
    'status.copyFailed': 'クリップボードへのコピーに失敗しました。手動で選択してコピーしてください。',
    'status.libraryFixed': 'Location Libraryは固定データのため、Waypointを追加できません。',
    'status.libraryFixedDrop': 'Location Libraryは固定データのため、Waypointを追加できません。',

    // --- ステータス: INI ---
    'status.iniLoaded': 'GameUserSettings.iniから{n}件のWaypointを読み込みました。{notices}',
    'status.iniLoadError': 'GameUserSettings.iniの読み込み中にエラーが発生しました: {error}',
    'status.iniLoadFirst': '先に[Load]でGameUserSettings.iniを読み込んでください。',
    'status.iniWriteDenied': 'GameUserSettings.iniへの書き込み権限が許可されませんでした。',
    'status.iniSaveAborted': '保存を中止しました。最新の状態で作業するには[Load]で読み込み直してください。',
    'status.iniSaved': 'GameUserSettings.iniへ保存しました({n}件)',
    'status.iniSavedFreshBase': '。読み込み後の外部変更も保持しました',
    'status.iniSavedCleaned': '。目印の[ARKASAWaypointManager]セクションを削除しました',
    'punct.period': '。',
    'status.iniSaveError': 'GameUserSettings.iniの保存中にエラーが発生しました: {error}',

    // --- ステータス: My Storage ---
    'status.storageLoaded': 'My Storageから{n}件のWaypointを読み込みました。',
    'status.storageLoadError': 'My Storageの読み込み中にエラーが発生しました: {error}',
    'status.storageLoadFirst': 'My Storage: 先にファイルを読み込んでください(Load)。',
    'status.storageCreateHint': 'My Storageタブの[Load]から {file} を新規作成・読込してください。',
    'status.storageWriteDenied': 'My Storage: ファイルへの書き込み権限が許可されませんでした。',
    'status.storageSaved': 'My Storageを保存しました({n}件)。',
    'status.storageSaveError': 'My Storageの保存に失敗しました: {error}',

    // --- ステータス: Library / Log ---
    'status.libraryLoaded': 'Location Libraryから{n}件のWaypointを読み込みました。',
    'status.libraryLoadError': 'Location Libraryの読み込み中にエラーが発生しました: {error}',
    'status.logLoaded': 'Waypoint Logから{n}件のWaypointを読み込みました。{notices}',
    'status.logLoadError': 'Waypoint Logの読み込み中にエラーが発生しました: {error}',

    // --- ダイアログ ---
    'dialog.locationConflictTitle': '座標衝突の確認',
    'dialog.locationConflict': '{list}に同一座標のWaypoint「{name}」が既に存在します。\n上書きしますか?',
    'dialog.tagConflictTitle': 'CustomTag衝突の確認',
    'dialog.tagConflict': '{list}に同一のCustomTag「{tag}」を持つWaypointが既に存在します。',
    'dialog.iniSaveConfirmTitle': 'GameUserSettings.iniへの保存確認',
    'dialog.iniSaveConfirm': 'ゲーム本体の設定ファイル(SavedMinimapMarks)を書き換えます。\nこの操作は元に戻せません。続行しますか?',
    'btn.saveOverwrite': '上書き保存',
    'dialog.fileChangedTitle': 'ファイルが変更されています',
    'dialog.fileChanged': '読み込み後にGameUserSettings.iniのWaypoint行が変更されています(ゲーム側で追加・削除された可能性があります)。\nアプリ側の一覧で上書きしますか?',
    'btn.saveWithAppList': 'アプリの一覧で保存',
    'confirm.delete': 'Waypoint「{name}」を{list}から削除しますか?',
    'alert.latLonNumeric': 'Lat / Lon は数値を入力してください。',
    'alert.zNumeric': 'Z は数値を入力してください。',
    'dialog.tagDuplicateTitle': 'CustomTag重複の確認',
    'dialog.tagDuplicate': 'CustomTag が既に存在します。',
    'btn.renameNumber': '連番追加',
    'detail.noRawText': '(RawTextなし: 手動追加されたWaypoint)',
    'status.movedFromTo': 'Waypoint「{name}」を{from}から{to}へ移動しました。',
    'status.copiedTo': 'Waypoint「{name}」を{to}へコピーしました。',
    'mobile.closeTab': 'このタブを閉じてご利用ください。',
    'category.allCount': '全カテゴリ ({n})',

    // --- 一括移動 ---
    'btn.bulkMove': '一括移動',
    'dialog.bulkTitle': '一括移動',
    'dialog.bulkMessage': '{list}で表示中の{n}件を、どこへ{verb}しますか?\n・同じ座標のものはスキップします\n・CustomTagが同じものは、自動で末尾に番号を追加します',
    'dialog.bulkTo': '{list} へ',
    'status.bulkNone': '表示中のWaypointがありません。',
    'status.bulkDone': '{n}件を{list}へ{verbPast}しました。',
    'status.bulkSkipped': 'スキップ{skipped}件(同じ座標)。',
    'status.bulkRenamed': 'タグ変更{renamed}件。',

    // --- エラー(ファイル/ライブラリ) ---
    'error.noFileSystemAccess': 'このブラウザはFile System Access APIに対応していません(Chrome/Edge推奨)。',
    'error.noIndexedDb': 'このブラウザはIndexedDBに対応していません。',
    'error.libraryJsonSyntax': 'Location LibraryのJSON構文が不正です: {error}',
    'error.libraryJsonStructure': 'Location Libraryの構造が不正です(waypoints配列がありません)。',
  },

  en: {
    // --- Header ---
    'status.initial': 'Please load GameUserSettings.ini.',
    'header.reconnect': '[ Reconnect previous files ]',
    'header.mapsShowAll': '[ Show all Waypoints ]',
    'header.mapsPerMap': '[ Back to per-map view ]',
    'header.settings': 'Settings',
    'maps.selectTitle': 'Select map',
    'maps.showing': 'Showing {n} Waypoints',
    'splitter.mapsTitle': 'Drag to resize the map area',
    'splitter.mainTitle': 'Drag to resize',

    // --- Lists ---
    'search.placeholder': 'Search',
    'count.waypoints': '{n} Waypoints',
    'btn.addWaypoint': '＋ Add Waypoint',
    'btn.openLog': '[ Open Log ]',
    'empty.ini': 'Please load GameUserSettings.ini.',
    'empty.storage': 'No Waypoints yet. Add one with "Add Waypoint" below, or drag from another list.',
    'empty.library': 'Please load a Location Library file.',
    'empty.log': 'Please open an output file from the Python WaypointLogger.',
    'category.all': 'All Categories',
    'category.none': '(Not set)',
    'col.icon': 'Icon',
    'col.name': 'Name',
    'col.map': 'Map',

    // --- Detail bar ---
    'detail.placeholder': 'Select a Waypoint to see its details.',
    'btn.copy': '[ Copy ]',

    // --- Add/Edit modal ---
    'modal.addTitle': 'Add Waypoint',
    'modal.editTitle': 'Edit Waypoint ({list})',
    'modal.close': 'Close',
    'modal.deleteTitle': 'Delete this Waypoint',
    'form.namePlaceholder': 'e.g. Base Camp',
    'form.tagPlaceholder': 'Optional',
    'form.zNote': '(UE coordinates)',
    'form.mapPlaceholder': 'e.g. TheIsland_WP (free text)',
    'preview.label': 'Waypoint Preview',
    'color.base': 'Base Color',
    'color.icon': 'Icon Color',

    // --- Choice dialog ---
    'choice.defaultTitle': 'Confirmation',
    'btn.overwrite': 'Overwrite',
    'btn.cancel': 'Cancel',
    'btn.renameSuffix': 'Add number suffix',

    // --- Settings ---
    'settings.title': 'Settings',
    'settings.displaySection': 'Display',
    'settings.langLabel': 'Language (UI and Location Library names)',
    'settings.savedSection': 'Saved settings',
    'settings.descSaved': 'Splitter positions, the selected map, the Library tab, column widths, search text and sort order are saved automatically.',
    'settings.descReset': 'Resetting returns these settings and the remembered last-opened files to their initial state.',
    'settings.reset': '[ Reset settings ]',
    'settings.resetConfirm': 'Reset all saved settings (layout, selected map, tab, column widths, search text, sort order) and the previous session info (remembered files) to their initial state?',

    // --- Mobile warning ---
    'mobile.text': 'This app is designed for PC. It may not work correctly on a smartphone. Continue?',
    'mobile.back': '[ Back ]',
    'mobile.continue': '[ Continue ]',

    // --- Maps ---
    'notice.loading': 'Loading…',
    'notice.noMaps': 'No maps available to display.',
    'notice.noConfig': 'Calibration for this map (config.json) was not found, so Lat/Lon cannot be shown.',
    'notice.imageError': 'Could not load the map image ({url}). Please check that the image file is in place.',
    'map.unnamed': '(unnamed)',

    // --- Status: common ---
    'status.unsupportedBrowser': 'This browser does not support the File System Access API. Chrome/Edge is recommended.',
    'status.restored': 'Restored the previous session ({lists}). {notices}',
    'status.restoredNeedReconnect': 'Restored the previous session ({lists}). Some files need to be reconnected. {notices}',
    'status.needReconnect': 'Permission to access the previous files is needed. Press [ Reconnect previous files ].',
    'status.bundledLibrary': 'Showing {n} Waypoints from the bundled Location Library data.',
    'status.reconnected': 'Reconnected ({lists}). {notices}',
    'status.reconnectDenied': 'Reconnection was not granted. Please reload the files with [Load].',
    'notice.incompleteLines': ' {n} line(s) have incomplete coordinates.',
    'notice.unrecognizedLines': ' {n} line(s) were not recognized (possibly corrupted).',
    'status.deleted': 'Deleted Waypoint "{name}" from {list}.',
    'status.updated': 'Updated Waypoint "{name}" in {list}.',
    'status.added': 'Added Waypoint "{name}" to {list}.',
    'status.movedOverwrite': '{verbPast} Waypoint "{name}" to {list} (overwrote).',
    'status.movedRenamed': '{verbPast} Waypoint "{name}" to {list} (CustomTag: {tag}).',
    'verb.move': 'Move',
    'verb.copy': 'Copy',
    'verb.movePast': 'Moved',
    'verb.copyPast': 'Copied',
    'status.copiedRaw': 'Copied the RawText to the clipboard.',
    'status.copyFailed': 'Failed to copy to the clipboard. Please select and copy it manually.',
    'status.libraryFixed': 'The Location Library is fixed data; Waypoints cannot be added.',
    'status.libraryFixedDrop': 'The Location Library is fixed data; Waypoints cannot be added.',

    // --- Status: INI ---
    'status.iniLoaded': 'Loaded {n} Waypoints from GameUserSettings.ini. {notices}',
    'status.iniLoadError': 'Error while loading GameUserSettings.ini: {error}',
    'status.iniLoadFirst': 'Please load GameUserSettings.ini with [Load] first.',
    'status.iniWriteDenied': 'Write permission for GameUserSettings.ini was not granted.',
    'status.iniSaveAborted': 'Save aborted. Reload with [Load] to work with the latest state.',
    'status.iniSaved': 'Saved to GameUserSettings.ini ({n} Waypoints)',
    'status.iniSavedFreshBase': ' (external changes made after loading were kept)',
    'status.iniSavedCleaned': ' (removed the marker [ARKASAWaypointManager] section)',
    'punct.period': '.',
    'status.iniSaveError': 'Error while saving GameUserSettings.ini: {error}',

    // --- Status: My Storage ---
    'status.storageLoaded': 'Loaded {n} Waypoints from My Storage.',
    'status.storageLoadError': 'Error while loading My Storage: {error}',
    'status.storageLoadFirst': 'My Storage: please load a file first (Load).',
    'status.storageCreateHint': 'Create or load {file} from [Load] in the My Storage tab.',
    'status.storageWriteDenied': 'My Storage: write permission for the file was not granted.',
    'status.storageSaved': 'Saved My Storage ({n} Waypoints).',
    'status.storageSaveError': 'Failed to save My Storage: {error}',

    // --- Status: Library / Log ---
    'status.libraryLoaded': 'Loaded {n} Waypoints from the Location Library.',
    'status.libraryLoadError': 'Error while loading the Location Library: {error}',
    'status.logLoaded': 'Loaded {n} Waypoints from the Waypoint Log. {notices}',
    'status.logLoadError': 'Error while loading the Waypoint Log: {error}',

    // --- Dialogs ---
    'dialog.locationConflictTitle': 'Location conflict',
    'dialog.locationConflict': '{list} already has a Waypoint "{name}" at the same location.\nOverwrite it?',
    'dialog.tagConflictTitle': 'CustomTag conflict',
    'dialog.tagConflict': '{list} already has a Waypoint with the same CustomTag "{tag}".',
    'dialog.iniSaveConfirmTitle': 'Save to GameUserSettings.ini',
    'dialog.iniSaveConfirm': 'This will rewrite the game settings file (SavedMinimapMarks).\nThis cannot be undone. Continue?',
    'btn.saveOverwrite': 'Save (overwrite)',
    'dialog.fileChangedTitle': 'The file has changed',
    'dialog.fileChanged': 'Waypoint lines in GameUserSettings.ini have changed since loading (the game may have added or removed some).\nOverwrite with the app list?',
    'btn.saveWithAppList': 'Save with the app list',
    'confirm.delete': 'Delete Waypoint "{name}" from {list}?',
    'alert.latLonNumeric': 'Please enter numeric values for Lat / Lon.',
    'alert.zNumeric': 'Please enter a numeric value for Z.',
    'dialog.tagDuplicateTitle': 'Duplicate CustomTag',
    'dialog.tagDuplicate': 'This CustomTag already exists.',
    'btn.renameNumber': 'Append number',
    'detail.noRawText': '(No RawText: manually added Waypoint)',
    'status.movedFromTo': 'Moved Waypoint "{name}" from {from} to {to}.',
    'status.copiedTo': 'Copied Waypoint "{name}" to {to}.',
    'mobile.closeTab': 'Please close this tab.',
    'category.allCount': 'All ({n})',

    // --- Bulk move ---
    'btn.bulkMove': 'Bulk Move',
    'dialog.bulkTitle': 'Bulk move',
    'dialog.bulkMessage': '{verb} the {n} Waypoints currently shown in {list} to where?\n- Items at the same location are skipped\n- Items with the same CustomTag get a number suffix automatically',
    'dialog.bulkTo': 'To {list}',
    'status.bulkNone': 'No Waypoints are currently shown.',
    'status.bulkDone': '{verbPast} {n} Waypoints to {list}.',
    'status.bulkSkipped': ' Skipped {skipped} (same location).',
    'status.bulkRenamed': ' Renamed {renamed} tag(s).',

    // --- Errors (file / library) ---
    'error.noFileSystemAccess': 'This browser does not support the File System Access API (Chrome/Edge recommended).',
    'error.noIndexedDb': 'This browser does not support IndexedDB.',
    'error.libraryJsonSyntax': 'Invalid Location Library JSON syntax: {error}',
    'error.libraryJsonStructure': 'Invalid Location Library structure (no waypoints array).',
  },
};

let currentLang = 'ja';

/** 表示言語を設定する('ja' | 'en'。未知の値は 'ja')。 */
export function setUiLang(lang) {
  currentLang = STRINGS[lang] ? lang : 'ja';
}

/** 現在の表示言語を返す。 */
export function getUiLang() {
  return currentLang;
}

/**
 * 辞書文字列を取得し、{name} 形式のプレースホルダを vars で置換する。
 * @param {string} key
 * @param {object} [vars]
 * @returns {string}
 */
export function t(key, vars = {}) {
  let s = STRINGS[currentLang][key] ?? STRINGS.ja[key] ?? key;
  for (const [name, value] of Object.entries(vars)) {
    s = s.replaceAll(`{${name}}`, String(value));
  }
  return s;
}
