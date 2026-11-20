// =============================================================
// coordinate_converter.js
// UE座標(Location=(X,Y,Z))とゲーム内マップ座標(Lat/Lon)を
// 相互変換する純粋なロジッククラス。
//
// 責務は座標変換のみであり、UIやDOM・ファイルI/Oには一切関与しない。
// 「UIから直接座標計算を行わないでください」という要件のため、
// app.js やその他のUIコードはこのクラス(と MapConfig)を経由してのみ
// 座標変換を行い、変換式そのものをUI層に書かない。
//
// 採用している座標変換の規約(ARKコミュニティで広く使われる方式):
//   Lat(緯度) は UE の Y座標に対応する
//   Lon(経度) は UE の X座標に対応する
//   Lat = (Y - latitudeOrigin)  / latitudeScale
//   Lon = (X - longitudeOrigin) / longitudeScale
//   逆変換:
//   Y = Lat * latitudeScale + latitudeOrigin
//   X = Lon * longitudeScale + longitudeOrigin
//
// MapConfigの latitudeScale/longitudeScale の符号を反転させることで、
// 軸の向きが逆になっているマップにも対応できる(スケールが負の値を
// 取ることを許容する)。将来Map Viewerを実装する際も、Marker表示・
// 追加・ドラッグ・編集はすべてこのクラスを介して座標変換を行う想定。
// =============================================================

export class CoordinateConverter {
  /**
   * @param {import('./map_config.js').MapConfig} mapConfig
   */
  constructor(mapConfig) {
    this.mapConfig = mapConfig;
  }

  /**
   * UE座標(X,Y)をゲーム内マップ座標(Lat,Lon)へ変換する。
   * @param {number} x
   * @param {number} y
   * @returns {{lat:number, lon:number}}
   */
  ueToGame(x, y) {
    const { latitudeScale, longitudeScale, latitudeOrigin, longitudeOrigin } = this.mapConfig;
    const lat = latitudeScale ? (y - latitudeOrigin) / latitudeScale : NaN;
    const lon = longitudeScale ? (x - longitudeOrigin) / longitudeScale : NaN;
    return { lat, lon };
  }

  /**
   * ゲーム内マップ座標(Lat,Lon)をUE座標(X,Y)へ変換する。
   * @param {number} lat
   * @param {number} lon
   * @returns {{x:number, y:number}}
   */
  gameToUe(lat, lon) {
    const { latitudeScale, longitudeScale, latitudeOrigin, longitudeOrigin } = this.mapConfig;
    const y = lat * latitudeScale + latitudeOrigin;
    const x = lon * longitudeScale + longitudeOrigin;
    return { x, y };
  }
}
