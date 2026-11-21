import { t } from './i18n.js';

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
// My Storage用。値は旧称JsonHandle時代のままで変えない(既存ユーザーの保存済みハンドルを引き継ぐため)
const KEY_STORAGE_HANDLE = 'lastJsonFileHandle';
const KEY_LOG_HANDLE = 'lastLogFileHandle';
const KEY_LIBRARY_HANDLE = 'lastLocationLibraryFileHandle'; // Location Library用ファイルのハンドル
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
      reject(new Error(t('error.noIndexedDb')));
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
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function idbGet(key) {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function idbDelete(key) {
  const db = await openDB();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// --- ファイルピッカー ------------------------------------------------

/** 既存ファイルを「開く」ための共通ピッカー(showOpenFilePicker)。 */
async function pickOpenFile(description, mime, extensions) {
  if (!isFileSystemAccessSupported()) {
    throw new Error(t('error.noFileSystemAccess'));
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description, accept: { [mime]: extensions } }],
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
 * ユーザーにGameUserSettings.iniを選択させる。
 * @returns {Promise<FileSystemFileHandle|null>}
 */
export async function pickIniFile() {
  return pickOpenFile('ARK GameUserSettings.ini', 'text/plain', ['.ini']);
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
 * 既存のJSONファイルを「開く」ためのピッカー(Location Library用)。
 * 読み込み専用の操作のため、保存ダイアログではなくOpenダイアログを使う。
 * @param {string} description
 * @returns {Promise<FileSystemFileHandle|null>}
 */
export async function pickOpenJsonFile(description = 'JSON file') {
  return pickOpenFile(description, 'application/json', ['.json']);
}

/**
 * 既存のテキスト(.txt)ファイルを「開く」ためのピッカー。
 * My Storage(SavedMinimapMarks形式のプレーンテキスト)の読込に使用する。
 * @param {string} description
 * @returns {Promise<FileSystemFileHandle|null>}
 */
export async function pickOpenTextFile(description = 'Text file') {
  return pickOpenFile(description, 'text/plain', ['.txt']);
}

// --- 権限 ------------------------------------------------------------

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

/**
 * ファイルハンドルの読み取り/書き込み権限を確認し、必要であれば
 * ユーザーへ許可ダイアログを表示する。
 * @param {FileSystemFileHandle} handle
 * @param {'read'|'readwrite'} mode
 * @returns {Promise<boolean>} 権限が得られたか
 */
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

function makeHandleStore(key) {
  return {
    save: async (handle) => { await idbSet(key, handle); },
    load: async () => idbGet(key),
    clear: async () => { await idbDelete(key); },
  };
}

const iniHandles = makeHandleStore(KEY_INI_HANDLE);
export const saveLastIniHandle = iniHandles.save;
export const loadLastIniHandle = iniHandles.load;
export const clearLastIniHandle = iniHandles.clear;

const storageHandles = makeHandleStore(KEY_STORAGE_HANDLE);
export const saveLastStorageHandle = storageHandles.save;
export const loadLastStorageHandle = storageHandles.load;
export const clearLastStorageHandle = storageHandles.clear;

const logHandles = makeHandleStore(KEY_LOG_HANDLE);
export const saveLastLogHandle = logHandles.save;
export const loadLastLogHandle = logHandles.load;
export const clearLastLogHandle = logHandles.clear;

const libraryHandles = makeHandleStore(KEY_LIBRARY_HANDLE);
export const saveLastLibraryHandle = libraryHandles.save;
export const loadLastLibraryHandle = libraryHandles.load;
export const clearLastLibraryHandle = libraryHandles.clear;

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
