# ARK ASA Waypoint Manager Web (v0.6.11)

ARK: Survival Ascended の `GameUserSettings.ini` に保存されている `SavedMinimapMarks`(ゲーム内Waypoint)を、ブラウザだけで読み込み・一覧管理・追加・編集・削除できるWebツールです。

サーバー不要・インストール不要。ファイルの読み書きには Chrome / Edge の File System Access API を使い、あなたのPC上のファイルを直接編集します(ファイルが外部へ送信されることはありません)。

**▶ 使ってみる: https://resia0417.github.io/ARK-ASA-Waypoint-Manager-public-test/**

## 使い方

1. このページを開く(GitHub Pages、またはローカルの `index.html`)
2. 左カラム「GameUserSettings.ini」の Read から、ARKの `GameUserSettings.ini` を選ぶ
   - 場所の目安: `ShooterGame/Saved/Config/Windows/GameUserSettings.ini`
3. 一覧と地図にWaypointが表示される。行右端のペンで編集、ゴミ箱で削除、一覧末尾の行から追加
4. 編集したら、左カラム見出し右端の Save でINIへ書き戻す(確認ダイアログ付き)
5. My Storage / Location Library / Waypoint Log は右カラムのタブで切り替える

## 主な機能

- 公式11マップ分の地図を画面上部に2枚並べて常時表示(左=INI、右=選択中タブ)。パン・ズーム連動、マーカー表示、座標グリッド、ダブルクリックで全体表示。地図を隠すと全Waypoint表示に切り替わる
- Genesis Part 1 はZ座標で陸(Genesis1)/海(Genesis1Ocean)を自動判別(保存されるMapNameは `Genesis_WP` のまま)
- Waypointアイコンはゲーム実物準拠(資源4種はゲーム内スクリーンショット由来の画像)
- 4つのリスト: GameUserSettings.ini / My Storage(.txt)/ Location Library(.json、Category管理)/ Waypoint Log(読み取り専用)
- リスト間のドラッグ&ドロップ、検索、CustomTag重複確認
- 前回開いたファイルの自動復元(権限の再許可が必要な場合は「前回のファイルを再接続」ボタンから)
- Map Calibration(マップごとの座標校正)とMapConfig保存(保存後にファイルを再読込して内容を検証)

## データの安全性

- INI保存時は、保存直前にファイルを読み直し、読み込み後にゲーム側で変わった内容を保持します。Waypoint行自体が変わっていた場合は追加で確認します
- 上書き直前の内容はブラウザ内(IndexedDB)にバックアップします
- 編集は最上位フィールド単位で行い、触っていない項目・壊れた行・Waypoint以外の行は原文のまま保持します
- 名前だけの編集では座標を書き換えません(表示の丸め誤差で座標がずれない設計)
- Read操作でファイルを変更することはありません

## My Storageについて

- ファイル名: `ARKASAWaypointManager_MyStorage.txt`(UTF-8プレーンテキスト)
- 1行につき1Waypoint(`SavedMinimapMarks=` で始まる行)で、GameUserSettings.iniと全く同じ形式・同じParserを使うため、相互にコピー&ペーストできます
- Read: 既存の `.txt` ファイルを開きます(新規作成は空の `.txt` を用意してReadしてください)
- Save: Readしたのと同じファイルへ上書き保存します

## 対応ブラウザ

本アプリは **File System Access API** を使用しています。

- Google Chrome (最新版)
- Microsoft Edge (最新版)

Firefox / Safari は File System Access API 未対応のため動作しません。また、スマートフォンでのアクセスは動作対象外です(確認ダイアログが表示されます)。

## GitHub Pages公開方法

1. 本リポジトリをGitHubへPushする
2. リポジトリの `Settings > Pages` を開く
3. `Source` を `Deploy from a branch` に設定し、対象ブランチとルートディレクトリ(`/`)を選択する
4. 数分後、`https://<ユーザー名>.github.io/<リポジトリ名>/` でアクセス可能になります

※ File System Access APIはHTTPS環境(GitHub Pagesを含む)または `localhost` でのみ動作します。

## フォルダ構成

```
ARK-ASA-Waypoint-Manager-Web/
├─ index.html
├─ README.md
├─ LICENSE
├─ css/
│  └─ style.css
├─ js/
│  ├─ app.js                  … メインコントローラー
│  ├─ waypoint_list.js         … リスト共通のWaypoint一覧コンポーネント
│  ├─ map_viewer.js            … 地図2枚の表示・マーカー・連動ズーム
│  ├─ ini_parser.js            … SavedMinimapMarksの解析と書き戻し
│  ├─ waypoint.js
│  ├─ storage.js               … My Storage(プレーンテキスト形式)の読み書き
│  ├─ location_library.js      … Location Library(JSON、Category保持)の読み書き
│  ├─ mark_icon.js             … MarkIcon定義
│  ├─ waypoint_icon.js         … アイコン描画(共通)
│  ├─ icon_images.js           … 資源アイコン画像(データURI)
│  ├─ coordinate_converter.js  … Lat/Lon ⇔ UE座標の変換
│  ├─ map_config.js            … MapConfigクラス・保存/読込/検証
│  ├─ map_calibration.js       … 座標キャリブレーション
│  ├─ settings_store.js        … 設定の保存(localStorage)
│  ├─ file_manager.js          … File System Access API・ハンドル管理
│  └─ util.js                  … 共通の小物関数
├─ assets/
│  └─ waypoint-icons/
├─ maps/                       … マップごとの地図画像(.webp)とconfig.json
└─ docs/
   └─ specification.md
```

## 今後の予定

- ルート表示と距離測定
- Community Library
- Settingsパネルの拡充

## ライセンス

本プロジェクトは [MIT License](./LICENSE) の下で公開されています。

---

## 地図画像について

地図画像は、れしあがゲーム内で撮影・合成したものです。ARK: Survival Ascended © Studio Wildcard. 本ツールは非公式のファンワークです。
