# ARK ASA Waypoint Manager Web (v0.3.6)

ARK: Survival Ascended の `GameUserSettings.ini` に保存されている `SavedMinimapMarks` を読み込み、
Waypoint(拠点マーカー)を一覧管理・追加・編集・削除できるローカル動作型のWebツールです。

サーバー不要・インストール不要で、ブラウザだけで動作します。GitHub Pagesでの公開も可能です。

## v0.3.6での変更点(v0.3.5からの差分)

### 1. Map Calibration保存処理の不具合修正

`Save MapConfig`実行時、`maps/<MapName>/`フォルダ・空の`config.json`は
作成されるものの、**config.jsonの内容自体が保存されていない**場合がある
不具合を修正しました。保存処理を、書き込み後に**ファイルを再読み込みして
内容を検証**するよう変更し、画面上の情報だけで成功とみなさないようにしました。
再読み込みした内容が一致しない場合は失敗として扱い、成功メッセージは
表示しません。

### 2. Categoryの扱いをLocation Library専用に変更

Categoryはゲーム内のWaypointデータには存在しない、あくまで管理用の情報で
あるため、以下の通り扱いを整理しました。

- **GameUserSettings.ini / My Storage**: Categoryを使用しません
  (Add/Editダイアログのフィールド自体を非表示にしました。一覧の
  Categoryフィルターも表示しません)
- **Location Library**: 従来通り、Categoryの保持・編集・フィルターに
  対応しています

### 3. My Storageの保存形式変更

保存ファイル名を `ARKASAWaypoints.json`(JSON)から
**`ARKASAWaypointManager_MyStorage.txt`**(UTF-8プレーンテキスト)へ
変更しました。

```text
SavedMinimapMarks=(Name="Metal",CustomTag="Waypoint",Location=(...),...)
SavedMinimapMarks=(Name="Crystal",CustomTag="Waypoint",Location=(...),...)
```

- 1行につき1Waypoint(`SavedMinimapMarks=`で始まる行)
- 空行・それ以外の行は無視されます
- GameUserSettings.iniと全く同じParserを再利用しているため、
  GameUserSettings.iniとの間でテキストをそのままコピー&ペーストできます
- メモ帳などのテキストエディタだけでも編集・バックアップ可能です

JSON形式の読み書き処理は完全に廃止しました。

既存機能(GameUserSettings.ini / My Storage / Location Library / Waypoint Logの
4リスト、検索・ソート・列設定・Splitter・Current Map・ドラッグ&ドロップ・
詳細ペイン・自動保存、Lat/Lon表示・入力、Debug Mode、Map Calibration/
MapConfig Manager、WaypointIcon共通描画、Read✓表示・Save有効/無効化、
CustomTag重複確認、スマートフォン警告など)はすべて維持しています。

## My Storageのファイルについて

- ファイル名: `ARKASAWaypointManager_MyStorage.txt`
- 保存場所: 従来通り、任意の場所を選べます(File System Access APIの
  仕様上、「GameUserSettings.iniと自動的に同じフォルダへ」保存することは
  技術的にできないため、`[Read]`/`[Save]`のファイル選択ダイアログで
  GameUserSettings.iniと同じフォルダを選んでください)
- `[Read]`: 既存の`.txt`ファイルを開きます(ネイティブのOpenダイアログ)
- `[Save]`: まだファイルに紐付いていない場合は新規保存ダイアログを表示し、
  以降は同じファイルへ上書き保存します

## Map Calibration保存の検証について

`Save MapConfig`は、`config.json`への書き込み後、同じファイルを
再読み込みして、保存しようとした内容と実際にディスクへ書き込まれた
内容が一致するかを確認します。一致しない場合(書き込み失敗・ハンドルの
不整合など)は保存失敗として扱い、`MapConfig saved.`という成功表示は
行いません。

## 対応ブラウザ

本アプリは **File System Access API** を使用しています。

- Google Chrome (最新版)
- Microsoft Edge (最新版)

Firefox / Safari は File System Access API 未対応のため、現時点では動作しません。
また、スマートフォンでのアクセスは動作対象外です(確認ダイアログが表示されます)。

## GitHub Pages公開方法

1. 本リポジトリをGitHubへPushする
2. リポジトリの `Settings > Pages` を開く
3. `Source` を `Deploy from a branch` に設定し、対象ブランチとルートディレクトリ(`/`)を選択する
4. 数分後、`https://<ユーザー名>.github.io/<リポジトリ名>/` でアクセス可能になります
5. `index.html` 内の `#githubLink` のリンク先を、実際のリポジトリURLに更新してください

※ File System Access APIはHTTPS環境(GitHub Pagesを含む)または `localhost` でのみ動作します。

## フォルダ構成

```
ARK-ASA-Waypoint-Manager-Web/
├─ index.html
├─ README.md
├─ LICENSE
├─ .gitignore
├─ css/
│  └─ style.css
├─ js/
│  ├─ app.js                  … メインコントローラー
│  ├─ waypoint_list.js         … 4リスト共通のWaypoint一覧コンポーネント
│  ├─ ini_parser.js
│  ├─ waypoint.js
│  ├─ storage.js               … My Storage(プレーンテキスト形式)の読み書き
│  ├─ location_library.js      … Location Library(JSON、Category保持)の読み書き
│  ├─ mark_icon.js
│  ├─ waypoint_icon.js
│  ├─ coordinate_converter.js
│  ├─ map_config.js            … MapConfigクラス・保存/読込/検証(再読込検証対応)
│  ├─ map_calibration.js
│  ├─ settings_store.js
│  └─ file_manager.js          … File System Access API(テキスト用ピッカーを追加)
├─ assets/
│  └─ waypoint-icons/
├─ maps/
├─ data/
│  ├─ ARKASAWaypointManager_MyStorage.txt   … My Storageのサンプル(プレーンテキスト)
│  └─ LocationLibrary/waypoints.json
└─ docs/
   └─ specification.md
```

## 今後追加予定の機能(Phase 2以降)

- Map Viewer本体(Leaflet / Marker Layer / Route / Distance Measure / Grid)
- Community Library
- Settingsパネルの拡充

## ライセンス

本プロジェクトは [MIT License](./LICENSE) の下で公開されています。

---

## 地図画像について

地図画像は、れしあがゲーム内で撮影・合成したものです。ARK: Survival Ascended © Studio Wildcard. 本ツールは非公式のファンワークです。
