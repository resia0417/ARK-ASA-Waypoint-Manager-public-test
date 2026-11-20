// =============================================================
// file_manager.js
// File System Access API を利用したファイル選択・読み書きと、
// 「前回使用したファイル」を再利用するためのハンドル永続化を担当する。
//
// 保存先: IndexedDB (ブラウザのFileSystemFileHandleはlocalStorageに
// 保存できないため、構造化クローン可能なIndexedDBを使用する)
// 保存する情報は「ファイルハンドルそのもの」のみであり、
// Waypointデータ本体はここには一切保存しない。
// =============================================================

const DB_NAME = 'ARKASAWaypointManagerDB';
const DB_VERSION = 1;
const STORE_NAME = 'fileHandles';

const KEY_INI_HANDLE = 'lastIniFileHandle';
const KEY_JSON_HANDLE = 'lastJsonFileHandle';
const KEY_LOG_HANDLE = 'lastLogFileHandle';
const KEY_LIBRARY_HANDLE = 'lastLocationLibraryFileHandle'; // v0.3.4よりファイル単体(waypoints.json)のハンドル
const KEY_INI_BACKUP = 'iniBackupV1'; // INI上書き直前の内容の緊急用バックアップ

/**
 * File System Access APIがブラウザでサポートされているか確認する。
 */
export function isFileSystemAccessSupported() {
  return typeof window.showOpenFilePicker === 'function';
}

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('このブラウザはIndexedDBに対応していません。'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * ユーザーにGameUserSettings.iniを選択させる。
 * @returns {Promise<FileSystemFileHandle|null>}
 */
export async function pickIniFile() {
  if (!isFileSystemAccessSupported()) {
    throw new Error('このブラウザはFile System Access APIに対応していません(Chrome/Edge推奨)。');
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'ARK GameUserSettings.ini',
          accept: { 'text/plain': ['.ini'] },
        },
      ],
      excludeAcceptAllOption: false,
      multiple: false,
    });
    return handle;
  } catch (err) {
    if (err.name === 'AbortError') return null; // ユーザーがキャンセル
    throw err;
  }
}

/**
 * Waypoint Log用のファイルを選択する。
 * Waypoint Logは GameUserSettings.ini と全く同じ形式(SavedMinimapMarksを含むINI)
 * を読み込むため、専用のPickerやParserを新設せず pickIniFile() をそのまま再利用する。
 * @returns {Promise<FileSystemFileHandle|null>}
 */
export async function pickLogFile() {
  return pickIniFile();
}

/**
 * 既存のJSONファイルを「開く」ためのピッカー(ネイティブのOpenダイアログ)。
 *
 * v0.3.4までは、My Storage / Location Libraryの[Read](旧[Open])ボタンが
 * pickSaveJsonFile()(showSaveFilePicker)を再利用していたため、ブラウザの
 * ファイル選択ダイアログが「保存」の見た目で表示されてしまう問題があった。
 * [Read]は既存データの読み込みのみを行うため、本来のOpenダイアログ
 * (showOpenFilePicker)を使うよう分離した。新規ファイルの作成は、
 * 空ファイルを用意して[Read]で開く運用とする。
 * @param {string} description
 * @returns {Promise<FileSystemFileHandle|null>}
 */
export async function pickOpenJsonFile(description = 'JSON file') {
  if (!isFileSystemAccessSupported()) {
    throw new Error('このブラウザはFile System Access APIに対応していません(Chrome/Edge推奨)。');
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description, accept: { 'application/json': ['.json'] } }],
      excludeAcceptAllOption: false,
      multiple: false,
    });
    return handle;
  } catch (err) {
    if (err.name === 'AbortError') return null;
    throw err;
  }
}

/**
 * 既存のテキスト(.txt)ファイルを「開く」ためのピッカー(showOpenFilePicker)。
 * My Storage(v0.3.6よりSavedMinimapMarks形式のプレーンテキストで保存する)の
 * 読込に使用する。
 * @param {string} description
 * @returns {Promise<FileSystemFileHandle|null>}
 */
export async function pickOpenTextFile(description = 'Text file') {
  if (!isFileSystemAccessSupported()) {
    throw new Error('このブラウザはFile System Access APIに対応していません(Chrome/Edge推奨)。');
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description, accept: { 'text/plain': ['.txt'] } }],
      excludeAcceptAllOption: false,
      multiple: false,
    });
    return handle;
  } catch (err) {
    if (err.name === 'AbortError') return null;
    throw err;
  }
}

/**
 * ファイルハンドルの読み取り/書き込み権限を確認し、必要であれば
 * ユーザーへ許可ダイアログを表示する。
 * @param {FileSystemFileHandle} handle
 * @param {'read'|'readwrite'} mode
 * @returns {Promise<boolean>} 権限が得られたか
 */
/**
 * 権限の状態だけを確認する(許可ダイアログは出さない)。
 * 起動時のセッション復元など、ユーザー操作の無い場面で使う。
 * @param {FileSystemFileHandle} handle
 * @param {'read'|'readwrite'} mode
 * @returns {Promise<'granted'|'prompt'|'denied'>}
 */
export async function queryPermissionState(handle, mode = 'read') {
  if (!handle) return 'denied';
  try {
    return await handle.queryPermission({ mode });
  } catch {
    return 'denied';
  }
}

export async function verifyPermission(handle, mode = 'read') {
  if (!handle) return false;
  const options = { mode };

  const existing = await handle.queryPermission(options);
  if (existing === 'granted') return true;

  const requested = await handle.requestPermission(options);
  return requested === 'granted';
}

/**
 * ファイルハンドルからテキストを読み込む。
 */
export async function readFile(handle) {
  const file = await handle.getFile();
  return await file.text();
}

/**
 * ファイルハンドルへテキストを書き込む。
 */
export async function writeFile(handle, text) {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

// --- 前回使用したファイルハンドルの永続化 -------------------------

export async function saveLastIniHandle(handle) {
  await idbSet(KEY_INI_HANDLE, handle);
}
export async function loadLastIniHandle() {
  return await idbGet(KEY_INI_HANDLE);
}
/** INI上書き直前の内容を、緊急用バックアップとしてIndexedDBへ保持する。 */
export async function saveIniBackup(text) {
  try {
    await idbSet(KEY_INI_BACKUP, { text, savedAt: Date.now() });
  } catch (err) {
    console.info('INIバックアップの保存に失敗しました:', err.message);
  }
}

/** 緊急用INIバックアップを破棄する(Settingsリセット用)。 */
export async function clearIniBackup() {
  await idbDelete(KEY_INI_BACKUP);
}

export async function saveLastJsonHandle(handle) {
  await idbSet(KEY_JSON_HANDLE, handle);
}
export async function loadLastJsonHandle() {
  return await idbGet(KEY_JSON_HANDLE);
}
export async function saveLastLogHandle(handle) {
  await idbSet(KEY_LOG_HANDLE, handle);
}
export async function loadLastLogHandle() {
  return await idbGet(KEY_LOG_HANDLE);
}
export async function saveLastLibraryHandle(handle) {
  await idbSet(KEY_LIBRARY_HANDLE, handle);
}
export async function loadLastLibraryHandle() {
  return await idbGet(KEY_LIBRARY_HANDLE);
}
/** 記憶されたmaps/ルートフォルダのハンドルを破棄する(自己修復リトライ用)。 */
export async function clearLastIniHandle() {
  await idbDelete(KEY_INI_HANDLE);
}
export async function clearLastJsonHandle() {
  await idbDelete(KEY_JSON_HANDLE);
}
export async function clearLastLogHandle() {
  await idbDelete(KEY_LOG_HANDLE);
}
export async function clearLastLibraryHandle() {
  await idbDelete(KEY_LIBRARY_HANDLE);
}
