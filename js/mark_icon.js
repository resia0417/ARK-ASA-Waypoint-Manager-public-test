// =============================================================
// mark_icon.js
// MarkIconの定義テーブル。
//
// 要件5「MarkIconはRawTextではなく定義テーブルで管理してください」への
// 対応。各定義は { id, rawText } を持ち、
// Add/Editのドロップダウン・一覧のWaypointIcon表示・RawText生成の
// 3箇所すべてでこの配列を共通データとして使用する(重複定義をしない)。
//
// 実装メモ(TypeScript/Reactからの読み替えについて):
// 元の要件はTypeScriptのinterfaceおよびReactコンポーネントとして
// 書かれているが、本プロジェクトはv0.1以来「サーバー不要・
// ビルド不要・GitHub Pagesでそのまま公開できる」ことを前提とした
// 素のHTML/CSS/JavaScript構成を採用しているため、同じ役割を果たす
// プレーンなJavaScriptオブジェクト配列として実装している
// (id は assets/waypoint-icons/ 配下のSVGファイル名(拡張子なし)および
//  表示名も兼ねる。資源系の4種はSVGを持たず、実物画像で描画する)。
// =============================================================

/**
 * @typedef {object} MarkIconDefinition
 * @property {string} id - アイコンの識別子。SVGファイル名(拡張子なし)・表示名も兼ねる。
 * @property {string} rawText - SavedMinimapMarksのMarkIconフィールドへ書き込む実際の値。
 */

/** @type {MarkIconDefinition[]} */
export const MARK_ICON_DEFINITIONS = [
  {
    id: 'Location',
    rawText: "/Script/Engine.Texture2D'/Game/PrimalEarth/UI/Textures/T_UI_HUDPointOfInterest_Location.T_UI_HUDPointOfInterest_Location'",
  },
  {
    id: 'Root',
    rawText: "/Script/Engine.Texture2D'/Game/PrimalEarth/UI/Textures/T_UI_HUDPointOfInterest_Collectible.T_UI_HUDPointOfInterest_Collectible'",
  },
  {
    id: 'Kill',
    rawText: "/Script/Engine.Texture2D'/Game/PrimalEarth/UI/Textures/T_UI_HUDPointOfInterest_Kill.T_UI_HUDPointOfInterest_Kill'",
  },
  {
    id: 'CircleSlash',
    rawText: "/Script/Engine.Texture2D'/Game/PrimalEarth/UI/Textures/T_UI_CircleSlash_No_Icon.T_UI_CircleSlash_No_Icon'",
  },
  {
    id: 'Star',
    rawText: "/Script/Engine.Texture2D'/Game/PrimalEarth/UI/Textures/T_UI_HUDPointOfInterest_Special.T_UI_HUDPointOfInterest_Special'",
  },
  {
    id: 'Dino',
    rawText: "/Script/Engine.Texture2D'/Game/PrimalEarth/UI/Textures/T_UI_HUDPointOfInterest_Tame.T_UI_HUDPointOfInterest_Tame'",
  },
  {
    id: 'MultiPlayer',
    rawText: "/Script/Engine.Texture2D'/Game/PrimalEarth/UI/Textures/T_UI_Missions_MultiplayerOptionalIcon.T_UI_Missions_MultiplayerOptionalIcon'",
  },
  {
    id: 'Wait',
    rawText: "/Script/Engine.Texture2D'/Game/PrimalEarth/UI/Textures/T_UI_HUDPointOfInterest_Wait.T_UI_HUDPointOfInterest_Wait'",
  },
  {
    id: 'Timer',
    rawText: "/Script/Engine.Texture2D'/Game/PrimalEarth/UI/Textures/T_UI_Missions_TimeRemainingIcon.T_UI_Missions_TimeRemainingIcon'",
  },
  {
    id: 'ArrowDown',
    rawText: "/Script/Engine.Texture2D'/Game/PrimalEarth/UI/Textures/T_UI_HUDPing_Icon.T_UI_HUDPing_Icon'",
  },
  {
    id: 'Metal',
    rawText: "/Script/Engine.Texture2D'/Game/PrimalEarth/CoreBlueprints/Resources/Icons/MetalOre_Icon.MetalOre_Icon'",
  },
  {
    id: 'Obsidian',
    rawText: "/Script/Engine.Texture2D'/Game/PrimalEarth/CoreBlueprints/Resources/Icons/Obsidian_Icon.Obsidian_Icon'",
  },
  {
    id: 'Crystal',
    rawText: "/Script/Engine.Texture2D'/Game/PrimalEarth/Test_Craig/Crystal_Icon.Crystal_Icon'",
  },
  {
    id: 'Pearl',
    rawText: "/Script/Engine.Texture2D'/Game/PrimalEarth/CoreBlueprints/Resources/Icons/Pearl_Icon.Pearl_Icon'",
  },
];

export const DEFAULT_MARK_ICON_ID = 'Location';

/** idからMarkIconDefinitionを取得する。見つからなければデフォルト(Location)を返す。 */
export function findMarkIconById(id) {
  return MARK_ICON_DEFINITIONS.find((d) => d.id === id)
    ?? MARK_ICON_DEFINITIONS.find((d) => d.id === DEFAULT_MARK_ICON_ID);
}

/**
 * WaypointのrawTextから抽出されたMarkIcon文字列(ARKのテクスチャパス)から、
 * 対応するMarkIconDefinitionを逆引きする。
 * 一致するものが無い場合(未知のMarkIcon、または空)はnullを返す
 * (呼び出し側でDEFAULT_MARK_ICON_IDへのフォールバックを判断できるようにする)。
 * @param {string} rawTextValue
 * @returns {MarkIconDefinition|null}
 */
export function findMarkIconByRawText(rawTextValue) {
  if (!rawTextValue) return null;
  return MARK_ICON_DEFINITIONS.find((d) => d.rawText === rawTextValue) ?? null;
}
