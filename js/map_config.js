// =============================================================
// map_config.js
// マップ毎の座標キャリブレーション情報(MapConfig)を保持・
// 読み込みするモジュール。
//
// 責務はMapConfigデータの保持と入出力・検証のみであり、座標変換の
// 計算式は一切持たない(計算は coordinate_converter.js が担う)。
// 「MapConfigはUIへ直接記述しないでください」という要件のため、
// UI(app.js)はこのモジュールが提供するAPIを呼ぶだけで、
// MapConfigの構造やファイルパスの組み立てルールを意識しない。
//
// なお Genesis1 / Genesis1Ocean の config.json は、longitudeOrigin が
// latitudeOrigin より 1 小さい値になっている。これは実測で得た
// キャリブレーション値そのままで、意図的なものである。
//
// ファイル配置について:
// 本リポジトリはビルドツールを持たない素のGitHub Pages配信を
// 前提としているため、要件にある "public/maps/<Map>/..." という構成は、
// "public/" プレフィックスを省略した "maps/<Map>/..." として、
// リポジトリのルート(index.htmlと同じ階層)に配置する形へ読み替えている
// (publicディレクトリを特別扱いするビルドステップが存在しないため)。
//
// v0.3.3でのフォーマット変更:
// config.jsonから image / imageWidth / imageHeight を削除した。
// Map Viewerはファイル名 "<マップフォルダ名>_map.webp" を読み込む前提とし、画像サイズは
// (実装時に)地図画像ファイル自体から取得する設計としたため、config.json側に
// 保持する必要が無くなったためである。
//
// maps/<MapFolder>/ フォルダの構成:
//   <フォルダ名>_map.webp … Map Viewerが読み込む地図画像
//   config.json  … このモジュールが読み込むMapConfig
// (waypoint.json のプレースホルダーは、読み込むコードが無いままだったため
//  v0.6.11で生成・配置を取りやめた)
// =============================================================


/** maps/<Map>/ フォルダ内で使用する固定ファイル名 */
export function getMapImageFilename(folder) {
  return `${folder}_map.webp`;
}

/**
 * ARKの内部マップ名(SavedMinimapMarksのMapName)から、
 * maps/フォルダ名への対応表。
 * 単純なテーブルへ1行追加するだけで対応マップを増やせる構造にしている。
 * 一致しないMapName(MODマップ等)は、末尾の "_WP" を除去した文字列を
 * そのままフォルダ名として扱うフォールバックを用いる。
 */
const KNOWN_MAP_FOLDERS = {
  TheIsland_WP: 'TheIsland',
  ScorchedEarth_WP: 'ScorchedEarth',
  Aberration_WP: 'Aberration',
  Extinction: 'Extinction',
  Extinction_WP: 'Extinction',
  LostColony_WP: 'LostColony',
  Genesis1_WP: 'Genesis1',
  Genesis1Ocean_WP: 'Genesis1Ocean',
  // Genesis_WP はZ座標で陸・海が分かれる(下記の resolveEffectiveMapName 参照)。
  // MapNameだけで解決しなければならない場面では
  // 陸側(Genesis1)へフォールバックする。
  Genesis_WP: 'Genesis1',
  TheCenter_WP: 'TheCenter',
  Ragnarok_WP: 'Ragnarok',
  Valguero_WP: 'Valguero',
  Astraeos_WP: 'Astraeos',
};

// =============================================================
// Genesis Part 1 の陸・海判別(v0.3.8)
//
// Genesis Part 1 の Waypoint は、バイオームに関わらず全て
// MapName="Genesis_WP" で保存される(ゲーム内ではプレイヤーが
// いるバイオーム空間で地図が切り替わるが、INIには残らない)。
// しかし陸バイオーム群と海バイオームは物理空間がZ方向に分離して
// 配置されており、Z座標の範囲が全く重ならないため、Zで判別できる。
//
// 実測(2026-11-20、基準点ウェイポイント+各バイオームの最高所・
// 最低所で計測):
//   陸: Z = -390453 (極地・最低所) 〜 25888 (基準点)
//   海: Z =  255450 (最低所) 〜 338334 (最高所)
// 両者の間には約23万の空白があり、中点は約140669。
// 境界はキリの良い 140000 とし、両側に約11万ずつの余裕がある。
// =============================================================

/** Genesis Part 1 のINI上のMapName(全バイオーム共通) */
export const GENESIS_MAP_NAME = 'Genesis_WP';
/** Genesis 陸側(月面・火山・極地・沼沢)の実効MapName */
export const GENESIS_LAND_MAP_NAME = 'Genesis1_WP';
/** Genesis 海側の実効MapName */
export const GENESIS_OCEAN_MAP_NAME = 'Genesis1Ocean_WP';
/** Z がこの値以上なら海バイオームとみなす(実測の中点≈140669に基づく) */
export const GENESIS_OCEAN_Z_THRESHOLD = 140000;
/**
 * 海バイオームで新規作成されたWaypointへ初期値として入れるZ。
 * 海の実測範囲(255450〜338334)の内側にある、キャリブレーション
 * 基準点のZを用いる。これにより、作成直後から海側へ正しく
 * 振り分けられ、INIへ書き戻してもゲーム内で海バイオーム側の
 * 点として扱われる。
 */
export const GENESIS_OCEAN_DEFAULT_Z = 266892;
/** 陸バイオームで新規作成されたWaypointへ初期値として入れるZ(陸側キャリブレーション基準点のZ) */
export const GENESIS_LAND_DEFAULT_Z = 25888;

/**
 * Waypointの実効MapNameを返す。Genesis_WP の場合のみ、Z座標で
 * 陸(Genesis1_WP)/海(Genesis1Ocean_WP)へ振り分ける。
 * これはアプリ内部の表示・座標変換のための振り分けであり、
 * Waypointに保存されるMapName(Genesis_WP)は変更しない
 * (INI書き戻し時も Genesis_WP のまま出力される)。
 * @param {string} mapName
 * @param {number} z - WaypointのZ座標
 * @returns {string}
 */
export function resolveEffectiveMapName(mapName, z) {
  const name = String(mapName ?? '').trim();
  if (name !== GENESIS_MAP_NAME) return name;
  return Number(z) >= GENESIS_OCEAN_Z_THRESHOLD
    ? GENESIS_OCEAN_MAP_NAME
    : GENESIS_LAND_MAP_NAME;
}

/**
 * ARKの内部マップ名からmaps/フォルダ名を導出する。
 * @param {string} mapName
 * @returns {string}
 */
export function mapNameToFolder(mapName) {
  const name = String(mapName ?? '').trim();
  if (KNOWN_MAP_FOLDERS[name]) return KNOWN_MAP_FOLDERS[name];
  return name.endsWith('_WP') ? name.slice(0, -3) : name;
}

/** config.jsonのうち、現バージョンで実際に使用するフィールドのデフォルト値(config未読込時の値) */
const DEFAULT_NUMERIC_FIELDS = {
  latitudeScale: 1,
  longitudeScale: 1,
  latitudeOrigin: 0,
  longitudeOrigin: 0,
};

export class MapConfig {
  /**
   * @param {object} data
   */
  constructor(data = {}) {
    this.mapName = data.mapName ?? '';
    this.displayName = data.displayName ?? this.mapName;
    this.latitudeScale = numOr(data.latitudeScale, DEFAULT_NUMERIC_FIELDS.latitudeScale);
    this.longitudeScale = numOr(data.longitudeScale, DEFAULT_NUMERIC_FIELDS.longitudeScale);
    this.latitudeOrigin = numOr(data.latitudeOrigin, DEFAULT_NUMERIC_FIELDS.latitudeOrigin);
    this.longitudeOrigin = numOr(data.longitudeOrigin, DEFAULT_NUMERIC_FIELDS.longitudeOrigin);
    // 以下はMap Viewerの初期ズーム・ズーム範囲に使う
    this.defaultZoom = numOr(data.defaultZoom, 1);
    this.minZoom = numOr(data.minZoom, 0.25);
    this.maxZoom = numOr(data.maxZoom, 10);
    // config.jsonから読み込めたかどうか(デフォルト値のままなら false)
    this.isCalibrated = Boolean(data.isCalibrated);
  }

  /** config.json未読込時のデフォルトMapConfigを生成する */
  static default(mapName) {
    return new MapConfig({ mapName, displayName: mapName, isCalibrated: false });
  }

  /** config.json由来のプレーンオブジェクトからMapConfigを生成する */
  static fromJSON(json) {
    return new MapConfig({ ...json, isCalibrated: true });
  }

}

// mapName -> MapConfig のキャッシュ(同じマップを何度もfetchしないため)
const configCache = new Map();
// mapName -> Promise<MapConfig> (読み込み中の重複fetch防止)
const pendingLoads = new Map();


/**
 * 指定したマップ名のMapConfigを非同期で確実に取得する。
 * キャッシュにあればそれを返し、無ければ loadMapConfig() の完了を待つ。
 * Add/Editモーダルなど、描画をブロックしてでも正確な変換結果が
 * 必要な場面で使用する(一覧描画では代わりに getCachedMapConfig を使う)。
 * @param {string} mapName
 * @returns {Promise<MapConfig>}
 */
export async function resolveMapConfig(mapName) {
  if (!mapName) return MapConfig.default('');
  if (configCache.has(mapName)) return configCache.get(mapName);
  try {
    const config = await loadMapConfig(mapName);
    configCache.set(mapName, config);
    return config;
  } catch (err) {
    console.warn(`MapConfigの読み込みに失敗しました(${mapName}):`, err);
    const fallback = MapConfig.default(mapName);
    configCache.set(mapName, fallback);
    return fallback;
  }
}

/**
 * 指定したマップ名のMapConfigを、同期的にキャッシュから取得する。
 * キャッシュに無い場合は null を返し、裏で loadMapConfig() による
 * 読み込みをトリガーする(fire-and-forgetではなく、呼び出し側が
 * onLoaded コールバックで再描画をトリガーできるようにしている)。
 * @param {string} mapName
 * @param {() => void} [onLoaded] - 読み込み完了時に呼ばれる(再描画のトリガー用)
 * @returns {MapConfig|null}
 */
// 読込完了コールバックは呼び出し元ごとに保持する(waypoint_icon.js の
// getCachedSvg と同方針。最初の呼び出し元の分だけ残すと再描画が漏れる)
const pendingLoadCallbacks = new Map();

export function getCachedMapConfig(mapName, onLoaded) {
  if (!mapName) return null;
  if (configCache.has(mapName)) return configCache.get(mapName);

  if (onLoaded) {
    if (!pendingLoadCallbacks.has(mapName)) pendingLoadCallbacks.set(mapName, new Set());
    pendingLoadCallbacks.get(mapName).add(onLoaded);
  }
  if (!pendingLoads.has(mapName)) {
    const notifyLoaded = () => {
      const callbacks = pendingLoadCallbacks.get(mapName) ?? [];
      pendingLoadCallbacks.delete(mapName);
      callbacks.forEach((cb) => cb());
    };
    const promise = loadMapConfig(mapName)
      .then((config) => {
        configCache.set(mapName, config);
        pendingLoads.delete(mapName);
        notifyLoaded();
        return config;
      })
      .catch((err) => {
        console.warn(`MapConfigの読み込みに失敗しました(${mapName}):`, err);
        const fallback = MapConfig.default(mapName);
        configCache.set(mapName, fallback);
        pendingLoads.delete(mapName);
        notifyLoaded();
        return fallback;
      });
    pendingLoads.set(mapName, promise);
  }
  return null;
}

/**
 * maps/<folder>/config.json を fetch() で読み込む。
 * 見つからない場合・JSONとして不正な場合は例外を投げる
 * (呼び出し元(resolveMapConfig/getCachedMapConfig)がデフォルト値へ
 * フォールバックする)。
 * @param {string} mapName
 * @returns {Promise<MapConfig>}
 */
async function loadMapConfig(mapName) {
  const folder = mapNameToFolder(mapName);
  const url = `maps/${folder}/config.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} が見つかりません(HTTP ${res.status})`);
  const json = await res.json();
  return MapConfig.fromJSON({ ...json, mapName: json.mapName || mapName });
}

function numOr(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
