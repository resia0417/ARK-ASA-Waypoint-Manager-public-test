// =============================================================
// map_config.js
// マップ毎の座標キャリブレーション情報(MapConfig)を保持・
// 読み込み・保存・検証するモジュール。
//
// 責務はMapConfigデータの保持と入出力・検証のみであり、座標変換の
// 計算式は一切持たない(計算は coordinate_converter.js が担う)。
// 「MapConfigはUIへ直接記述しないでください」という要件のため、
// UI(app.js)はこのモジュールが提供するAPIを呼ぶだけで、
// MapConfigの構造やファイルパスの組み立てルールを意識しない。
//
// ファイル配置について:
// 本リポジトリはビルドツールを持たない素のGitHub Pages配信を
// 前提としているため、要件にある "public/maps/<Map>/..." という構成は、
// "public/" プレフィックスを省略した "maps/<Map>/..." として、
// リポジトリのルート(index.htmlと同じ階層)に配置する形へ読み替えている
// (publicディレクトリを特別扱いするビルドステップが存在しないため)。
//
// 保存先(maps/)フォルダについて:
// 「保存先はユーザーへ問い合わせないでください」という要件があるが、
// ブラウザのFile System Access APIは、ユーザーの明示的な操作なしに
// 任意のフォルダへの書き込み許可を取得することができない
// (セキュリティ上の制約であり、本アプリの設計判断ではない)。
// そのため、「最初の1回だけ」maps/フォルダの選択をお願いし、以後は
// そのハンドルを再利用することで、2回目以降の保存では一切
// ダイアログを表示しない、という形で要件の意図に沿っている。
//
// v0.3.3でのフォーマット変更:
// config.jsonから image / imageWidth / imageHeight を削除した。
// Map Viewerはファイル名 "<マップフォルダ名>_map.webp" を読み込む前提とし、画像サイズは
// (実装時に)地図画像ファイル自体から取得する設計としたため、config.json側に
// 保持する必要が無くなったためである。
//
// maps/<MapFolder>/ フォルダの構成:
//   <フォルダ名>_map.webp … Map Viewerが読み込む地図画像
//   config.json  … このモジュールが読み書きするMapConfig
// (waypoint.json のプレースホルダーは、読み込むコードが無いままだったため
//  v0.6.11で生成・配置を取りやめた)
// =============================================================

import * as fm from './file_manager.js';

/** maps/<Map>/ フォルダ内で使用する固定ファイル名 */
export function getMapImageFilename(folder) {
  return `${folder}_map.webp`;
}
export const MAP_CONFIG_FILENAME = 'config.json';

/**
 * ARKの内部マップ名(SavedMinimapMarksのMapName)から、
 * maps/フォルダ名への対応表。
 * 単純なテーブルへ1行追加するだけで対応マップを増やせる構造にしている。
 * 一致しないMapName(MODマップ等)は、末尾の "_WP" を除去した文字列を
 * そのままフォルダ名として扱うフォールバックを用いる。
 */
export const KNOWN_MAP_FOLDERS = {
  TheIsland_WP: 'TheIsland',
  ScorchedEarth_WP: 'ScorchedEarth',
  Aberration_WP: 'Aberration',
  Extinction: 'Extinction',
  Extinction_WP: 'Extinction',
  LostColony_WP: 'LostColony',
  Genesis1_WP: 'Genesis1',
  Genesis1Ocean_WP: 'Genesis1Ocean',
  // Genesis_WP はZ座標で陸・海が分かれる(下記の resolveEffectiveMapName 参照)。
  // MapNameだけで解決しなければならない場面(キャリブレーション等)では
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

/** config.jsonのうち、現バージョンで実際に使用するフィールドのデフォルト値(未キャリブレーション状態) */
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
    // 以下は現バージョンでは未使用。将来のMap Viewerのために保持するのみ。
    this.defaultZoom = numOr(data.defaultZoom, 1);
    this.minZoom = numOr(data.minZoom, 0.5);
    this.maxZoom = numOr(data.maxZoom, 4);
    // このMapConfigがキャリブレーション済みかどうか(デフォルト値のままかどうか)
    this.isCalibrated = Boolean(data.isCalibrated);
  }

  /** 未キャリブレーション状態(恒等変換)のMapConfigを生成する */
  static default(mapName) {
    return new MapConfig({ mapName, displayName: mapName, isCalibrated: false });
  }

  /** config.json由来のプレーンオブジェクトからMapConfigを生成する */
  static fromJSON(json) {
    return new MapConfig({ ...json, isCalibrated: true });
  }

  /**
   * config.json形式のプレーンオブジェクトへ変換する。
   * 要件のフォーマット(mapName/displayName/4つの座標値/
   * defaultZoom/minZoom/maxZoom)を厳密に守る。
   * image/imageWidth/imageHeightはv0.3.3で廃止した
   * (Map Viewerは<フォルダ名>_map.webpを読み込み、画像サイズは
   * 地図画像ファイル自体から取得する設計としたため)。
   */
  toJSON() {
    return {
      // Genesis は陸/海どちらの config.json でも mapName を Genesis_WP に
      // 統一する(保存されるWaypointのMapNameは常に Genesis_WP のため。v0.6.9)
      mapName: (this.mapName === GENESIS_LAND_MAP_NAME || this.mapName === GENESIS_OCEAN_MAP_NAME)
        ? GENESIS_MAP_NAME
        : this.mapName,
      displayName: this.displayName,
      latitudeScale: this.latitudeScale,
      longitudeScale: this.longitudeScale,
      latitudeOrigin: this.latitudeOrigin,
      longitudeOrigin: this.longitudeOrigin,
      defaultZoom: this.defaultZoom,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
    };
  }
}

// mapName -> MapConfig のキャッシュ(同じマップを何度もfetchしないため)
const configCache = new Map();
// mapName -> Promise<MapConfig> (読み込み中の重複fetch防止)
const pendingLoads = new Map();

/**
 * MapConfigキャッシュへ直接値を設定する。
 * Map Calibrationで新しいMapConfigを算出・保存した直後に、再fetchすることなく
 * 一覧のLat/Lon表示へ即座に反映させるために使用する。
 * @param {string} mapName
 * @param {MapConfig} config
 */
export function setCachedMapConfig(mapName, config) {
  configCache.set(mapName, config);
}

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
export function getCachedMapConfig(mapName, onLoaded) {
  if (!mapName) return null;
  if (configCache.has(mapName)) return configCache.get(mapName);

  if (!pendingLoads.has(mapName)) {
    const promise = loadMapConfig(mapName)
      .then((config) => {
        configCache.set(mapName, config);
        pendingLoads.delete(mapName);
        onLoaded?.();
        return config;
      })
      .catch((err) => {
        console.warn(`MapConfigの読み込みに失敗しました(${mapName}):`, err);
        const fallback = MapConfig.default(mapName);
        configCache.set(mapName, fallback);
        pendingLoads.delete(mapName);
        onLoaded?.();
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
export async function loadMapConfig(mapName) {
  const folder = mapNameToFolder(mapName);
  const url = `maps/${folder}/config.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} が見つかりません(HTTP ${res.status})`);
  const json = await res.json();
  return MapConfig.fromJSON({ ...json, mapName: json.mapName || mapName });
}

/**
 * MapConfigを、プロジェクトの maps/<MapName>/config.json へ保存する。
 *
 * - 保存先はCurrent Map(mapConfig.mapName)から自動的に決定し、
 *   ユーザーへ都度問い合わせない(初回のみ、maps/ルートフォルダの
 *   選択をお願いする。詳細はファイル先頭のコメント参照)。
 * - maps/<MapName>/ フォルダが存在しなければ自動作成する。
 * - config.json が存在しなければ新規作成し、存在すれば上書きする
 *   (今回保存する内容を書き込む)。
 * - 地図画像が存在しなければ、空ファイルとして新規作成する
 *   (既に存在する場合は一切上書きしない。ユーザーが既に配置した
 *   実際の地図画像を保護するため)。
 *
 * @param {MapConfig} mapConfig
 * @returns {Promise<{
 *   success: boolean, cancelled?: boolean, error?: string,
 *   folder?: string, configPath?: string, mapPngPath?: string,
 *   mapPngExists?: boolean, configJsonExists?: boolean,
 *   mapPngCreated?: boolean,
 * }>}
 */
export async function saveMapConfigToProject(mapConfig) {
  let rootHandle = await fm.loadLastMapsRootHandle();
  let granted = rootHandle ? await fm.verifyPermission(rootHandle, 'readwrite') : false;

  if (!granted) {
    rootHandle = await fm.pickMapsRootFolder();
    if (!rootHandle) return { success: false, cancelled: true };
    await fm.saveLastMapsRootHandle(rootHandle);
    granted = await fm.verifyPermission(rootHandle, 'readwrite');
    if (!granted) return { success: false, error: 'maps/フォルダへの書き込み権限が許可されませんでした。' };
  }

  try {
    return await writeMapConfigFiles(rootHandle, mapConfig);
  } catch (err) {
    // 自己修復(ハンドル破棄＋フォルダ再選択)は、ハンドル失効・権限系の
    // エラーに限る。それ以外のエラーで再選択を促すと、ユーザー操作の
    // 有効期限が切れて再選択自体が失敗するため(v0.6.9)
    const handleLikeError = ['NotFoundError', 'NotAllowedError', 'SecurityError'].includes(err?.name);
    if (!handleLikeError) {
      return { success: false, error: `保存に失敗しました(${err.message})。` };
    }
    // 記憶されていたmaps/フォルダのハンドルが無効になっている可能性がある
    // (フォルダの移動・削除、ブラウザ側でのハンドル失効など)。
    // 「例外で終了しないようにしてください」という要件のため、ここで
    // 例外を握りつぶして終わらせるのではなく、ハンドルを破棄したうえで
    // 1回だけフォルダの再選択を促し、自己修復を試みる。
    console.warn('MapConfigの保存に失敗しました。maps/フォルダの再選択を試みます:', err);
    await fm.clearLastMapsRootHandle();

    try {
      const newRoot = await fm.pickMapsRootFolder();
      if (!newRoot) return { success: false, cancelled: true };
      await fm.saveLastMapsRootHandle(newRoot);
      const rewGranted = await fm.verifyPermission(newRoot, 'readwrite');
      if (!rewGranted) return { success: false, error: 'maps/フォルダへの書き込み権限が許可されませんでした。' };
      return await writeMapConfigFiles(newRoot, mapConfig);
    } catch (err2) {
      return { success: false, error: `保存に失敗しました(${err2.message})。maps/フォルダを選び直して再度お試しください。` };
    }
  }
}

/**
 * 実際のフォルダ・ファイルの作成/書き込みを行う内部処理。
 * saveMapConfigToProject() から、通常時・自己修復リトライ時の両方で呼ばれる。
 *
 * v0.3.6での修正: 書き込み後、画面上の情報だけで成功とみなさず、
 * 実際に config.json をディスクから再読み込みして内容を検証する
 * (「画面上だけ更新されていても完了とはしないこと」「実際にconfig.jsonの
 * 内容が更新されていることを成功条件としてください」という要件への対応)。
 * 再読み込みした内容が保存しようとした内容と一致しない場合は、成功として
 * 扱わずエラーを返す。
 *
 * @param {FileSystemDirectoryHandle} rootHandle
 * @param {MapConfig} mapConfig
 */
async function writeMapConfigFiles(rootHandle, mapConfig) {
  const folder = mapNameToFolder(mapConfig.mapName);
  const mapDir = await fm.getOrCreateSubdirectory(rootHandle, folder);

  // config.json: 常に今回の内容で新規作成/上書きする
  const configHandle = await fm.getOrCreateFile(mapDir, MAP_CONFIG_FILENAME);
  const expectedJson = mapConfig.toJSON();
  await fm.writeFile(configHandle, JSON.stringify(expectedJson, null, 2));

  // 保存後、ディスクから再読み込みして内容を検証する(画面上の情報だけで
  // 成功とみなさない)。ファイルハンドルから再度 getFile() することで、
  // メモリ上のキャッシュではなく実際の書き込み結果を確認する。
  const configJsonExists = await fm.fileExists(mapDir, MAP_CONFIG_FILENAME);
  if (!configJsonExists) {
    return { success: false, error: 'config.jsonの保存後の存在確認に失敗しました。' };
  }

  let verifiedJson;
  try {
    const verifyText = await fm.readFile(configHandle);
    verifiedJson = JSON.parse(verifyText);
  } catch (err) {
    return { success: false, error: `config.jsonの保存後の検証読み込みに失敗しました(${err.message})。` };
  }

  if (!mapConfigJsonEquals(verifiedJson, expectedJson)) {
    return { success: false, error: 'config.jsonの保存後の内容が一致しませんでした。再度保存してください。' };
  }

  // 地図画像: 既存ファイルは絶対に上書きせず、無い場合のみ空ファイルを作成する
  const mapPngResult = await ensurePlaceholderFile(mapDir, getMapImageFilename(folder));

  setCachedMapConfig(mapConfig.mapName, mapConfig);

  return {
    success: true,
    verified: true,
    folder,
    configPath: `maps/${folder}/${MAP_CONFIG_FILENAME}`,
    mapPngPath: `maps/${folder}/${getMapImageFilename(folder)}`,
    configJsonExists,
    mapPngExists: true, // ensurePlaceholderFileにより、この時点で必ず存在する
    mapPngCreated: mapPngResult.created,
  };
}

/** config.json保存後の検証用: 期待値と実際に読み込んだ内容が一致するかを比較する。 */
function mapConfigJsonEquals(a, b) {
  const keys = ['mapName', 'displayName', 'latitudeScale', 'longitudeScale', 'latitudeOrigin', 'longitudeOrigin', 'defaultZoom', 'minZoom', 'maxZoom'];
  return keys.every((key) => a?.[key] === b?.[key]);
}

/**
 * 指定したファイルが存在しなければ、空ファイルとして新規作成する。
 * 既に存在する場合は一切手を加えない(内容を保護する)。
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {string} fileName
 * @returns {Promise<{existedBefore: boolean, created: boolean}>}
 */
async function ensurePlaceholderFile(dirHandle, fileName) {
  const existedBefore = await fm.fileExists(dirHandle, fileName);
  if (existedBefore) return { existedBefore: true, created: false };

  const handle = await fm.getOrCreateFile(dirHandle, fileName);
  await fm.writeFile(handle, '');
  return { existedBefore: false, created: true };
}

/**
 * MapConfigの内容とSave結果を検証し、チェックリストを返す。
 * UIはこの配列をそのまま表示するだけでよい(判定ロジックはここに集約する)。
 * @param {MapConfig} mapConfig
 * @param {Awaited<ReturnType<typeof saveMapConfigToProject>>} saveResult
 * @returns {Array<{label:string, ok:boolean, detail?:string}>}
 */
export function validateMapConfig(mapConfig, saveResult) {
  return [
    { label: 'MapConfig保存成功', ok: !!saveResult?.success },
    {
      label: '地図画像ファイル存在',
      ok: !!saveResult?.mapPngExists,
      detail: saveResult?.mapPngCreated
        ? `空ファイルとして新規作成しました: ${saveResult?.mapPngPath ?? ''}(実際の地図画像に差し替えてください。Map Viewerはそれまで動作しません)`
        : undefined,
    },
    { label: 'config.json存在', ok: !!saveResult?.configJsonExists },
    { label: 'latitudeScale', ok: Number.isFinite(mapConfig.latitudeScale) && mapConfig.latitudeScale !== 0 },
    { label: 'longitudeScale', ok: Number.isFinite(mapConfig.longitudeScale) && mapConfig.longitudeScale !== 0 },
    { label: 'latitudeOrigin', ok: Number.isFinite(mapConfig.latitudeOrigin) },
    { label: 'longitudeOrigin', ok: Number.isFinite(mapConfig.longitudeOrigin) },
  ];
}

function numOr(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
