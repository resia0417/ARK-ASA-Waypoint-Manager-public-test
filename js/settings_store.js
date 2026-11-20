// =============================================================
// settings_store.js
// アプリ全体の設定(Splitter位置・Current Map・Libraryタブ・列幅・列順・
// 表示列・検索文字・ソート列・ソート順など)を保存する共通クラス。
//
// 要件: 「LocalStorageへ直接依存しない設計にしてください。保存クラスを
// 作成してください。」
//
// このクラスの利用側(app.js / waypoint_list.js)は SettingsStore の
// get()/set() メソッドのみを介して設定を読み書きし、localStorageという
// 具体的な保存先を直接参照することはない。バックエンド(実際に
// どこへ永続化するか)は差し替え可能な設計にしており、将来的に
// (例えばFile System Access APIで設定ファイルへ保存する等)
// 実装を差し替える場合も、SettingsStoreの利用側コードを変更する
// 必要はない。
//
// 既定のバックエンドはブラウザの localStorage だが、利用できない
// 環境(プライベートブラウジング等でlocalStorageが例外を投げる場合)
// では自動的にメモリ内ストレージへフォールバックする。
// =============================================================

const STORAGE_KEY_PREFIX = 'arkAsaWaypointManager.';

/** localStorageが使えない場合のフォールバック用インメモリ実装 */
class MemoryBackend {
  constructor() {
    this._map = new Map();
  }
  getItem(key) {
    return this._map.has(key) ? this._map.get(key) : null;
  }
  setItem(key, value) {
    this._map.set(key, value);
  }
  removeItem(key) {
    this._map.delete(key);
  }
}

function createDefaultBackend() {
  try {
    const testKey = `${STORAGE_KEY_PREFIX}__probe__`;
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch (err) {
    console.warn('localStorageが利用できないため、設定はメモリ内にのみ保持されます。', err);
    return new MemoryBackend();
  }
}

export class SettingsStore {
  /**
   * @param {{getItem:Function,setItem:Function,removeItem:Function}} [backend]
   *   省略時は localStorage (利用不可ならメモリ) を使用する。
   */
  constructor(backend) {
    this.backend = backend ?? createDefaultBackend();
  }

  /**
   * 設定値を取得する。
   * @param {string} key
   * @param {*} defaultValue - 未保存時に返すデフォルト値
   * @returns {*}
   */
  get(key, defaultValue) {
    try {
      const raw = this.backend.getItem(STORAGE_KEY_PREFIX + key);
      if (raw === null || raw === undefined) return defaultValue;
      return JSON.parse(raw);
    } catch (err) {
      console.warn(`設定「${key}」の読み込みに失敗しました。デフォルト値を使用します。`, err);
      return defaultValue;
    }
  }

  /**
   * 設定値を保存する。
   * @param {string} key
   * @param {*} value - JSONシリアライズ可能な値
   */
  set(key, value) {
    try {
      this.backend.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
    } catch (err) {
      console.warn(`設定「${key}」の保存に失敗しました。`, err);
    }
  }

  remove(key) {
    try {
      this.backend.removeItem(STORAGE_KEY_PREFIX + key);
    } catch (err) {
      console.warn(`設定「${key}」の削除に失敗しました。`, err);
    }
  }

  /** このアプリの設定をすべて削除する(Settingsのリセット用、v0.6.3)。 */
  clearAll() {
    try {
      if (typeof this.backend.key === 'function' && typeof this.backend.length === 'number') {
        const keys = [];
        for (let i = 0; i < this.backend.length; i++) {
          const k = this.backend.key(i);
          if (k && k.startsWith(STORAGE_KEY_PREFIX)) keys.push(k);
        }
        keys.forEach((k) => this.backend.removeItem(k));
      } else if (this.backend._map instanceof Map) {
        this.backend._map.clear();
      }
    } catch (err) {
      console.warn('設定のリセットに失敗しました。', err);
    }
  }
}

// アプリ全体で1つのインスタンスを共有する(シングルトン)。
// テスト等で差し替えたい場合は new SettingsStore(customBackend) を
// 個別に生成して利用することもできる。
export const settingsStore = new SettingsStore();
