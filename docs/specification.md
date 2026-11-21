# ARK ASA Waypoint Manager Web — 仕様書 (v0.11.10)

## 0.45 v0.11.10: DinoFinderデータ第2次反映(名前ベースの対応付けで15件の座標をUE座標へ)

- 背景: Location Library の座標は出典(Wiki)の Lat/Lon を換算したもので丸め誤差が大きく、v0.11.8 の「XY距離3,000以内」という近接条件では、実際に対応するエントリを取りこぼしていた(利用者指摘: Library=Lat/Lon入力、MOD=UE座標で後者が正確)。
- 第2次では名前(二つ名・場所名)で対応を特定し位置で裏付ける方式に変更。保留21点のうち対応が確定した10点で Library 15件の Location をファイルの UE 座標(XYZ)に差し替え(merge_dinofinder_pass2.py、冪等)。
  - TheCenter: Devious(Cave entrance 3)、Clever/Devourer(北氷洞窟、2件)
  - Ragnarok: Hunter(Cave 6 Entrance)
  - Astraeos: Pack(Volcano Cave Entrance + Volcano Cave)、Hunter(Forgotten Temple Entrance + Forgotten Temple)
  - Valguero: Gatekeeper(Aberration Trench)、Gatekeeper洞窟(Aberration Zone側入口。ファイル名はCragだが位置で判定)、Strong/Pack/Immune(Spider Cave入口、3件)、Skylord(Milton's Grotto)
  - Aberration: Stalker(Elemental Vault Entrance。距離17,249だが二つ名が一意)
- Z未設定は 256件 → 241件。総数867件は不変。
- 残り11点は対応が確定できないため引き続き保留(アリーナ端末系、迷宮の出口、Library未収録の入口、名前が汎用的なもの等)。詳細は作業フォルダ library_data/DINOFINDER_MERGE.md。

## 0.44 v0.11.9: Island の Lost Faith / Lost Hope の対応入れ替わりを修正

- 不具合修正(利用者指摘): The Island の Artifact of the Brute(Caverns of Lost Faith)と Artifact of the Cunning(Caverns of Lost Hope)は、同梱データの元(Wiki 由来)の時点で名前と位置が入れ替わっていた。v0.11.8 の近接マージで誤対応のまま実座標が入ったため、両エントリの Location を入れ替えた(Brute = CavePoint_209 狡猾矿洞の座標、Cunning = CavePoint_208 残暴矿洞の座標)。他マップは英名の二つ名で突き合わせし、同種の入れ替わりがないことを確認済み。

## 0.43 v0.11.8: DinoFinder系MODデータによる座標修正と入口/本体の区別

- 利用者が調査して持ち込んだ DinoFinder 系 MOD の Waypoint データ(73件)を使い、Location Library の座標を修正した。詳細と保留分の一覧は作業フォルダの library_data/DINOFINDER_MERGE.md に記録。
- XY 差 3,000 以内の46点で Library 63件の Location を実座標に差し替え(Explorer Note は ASA Explorer Map の実座標があるため除外)。Extinction の King Titan Terminal もファイル座標に差し替え(マップ範囲外の位置が実在)。
- 新規追加5件: Desert / Forest Titan Terminal(Boss)、アーティファクト本体 3件(Extinction の Growth / Chaos / Void、名前に (Pedestal)、日本語名は「○○のアーティファクト（本体）」、アイコンはピン)。総数 862 → 867件、Z=0 は 320 → 256件。
- Artifact カテゴリの既存63件は全て洞窟の入口の位置であるため、入口と分かるようにした: 名前に入口表記を追加(Island / Astraeos の括弧形式24件と Ragnarok の Devourer)、アイコンをピンから洞窟と同じ下矢印へ変更(62件。The Center の Brute は外洋で入口がないため対象外)。

## 0.42 v0.11.7: 確認ダイアログがSettingsモーダルの後ろに隠れる問題の修正

- 不具合修正(利用者報告): Settings の「設定をリセット」から開く確認ダイアログが、Settings モーダルの後ろに隠れて操作できなかった。原因は、全モーダル共通の .modal-overlay(z-index: 50)同士では DOM の後勝ちになり、#choiceModal より #settingsModal が後に置かれていたこと。#choiceModal に z-index: 70 を与え、どのモーダルから呼ばれても最前面に出るようにした。

## 0.41 v0.11.6: 地図ズーム範囲の拡大

- 地図のズーム範囲を拡大した(利用者要望)。全11マップの config.json と MapConfig のデフォルト値・MapViewer のフォールバック値を、minZoom 0.5 → 0.25、maxZoom 4 → 10 に変更した。ズーム倍率は「マップ全体がペインに収まる大きさ」を 1 とした相対値。

## 0.40 v0.11.5: 座標のないドシエ2件を同梱データから削除

- Location Library の Island ドシエ2件(Dossier: Carcharodontosaurus / Dossier: Rhyniognatha)を削除し、同梱データは 864件 → 862件(Explorer Note 565→563、TheIsland 242→240)になった。出典の ASA Explorer Map データではこの2件の Location 欄に座標ではなくスポーンコマンドのテキストが入っており、ワールド内の取得地点が存在しないため、座標の補完ができないプレースホルダ(0,0,0)だった。利用者の判断で削除した。残りの CustomTag は振り直さず一意性を維持している(Explorer Note 124/125 が欠番)。

## 0.39 v0.11.4: 日本語名をゲーム内公式表記へ照合・修正

- Location Library の日本語名を日本語ARK Wiki(wikiwiki.jp/arksa、ゲーム内表記準拠を明言)・公式Wiki日本語版等と照合し、158件を公式表記へ修正した(調査報告書は作業フォルダ library_data/JP_NAMES_RESEARCH.md)。内訳: 生物名39件(例: レックス→ティラノサウルス、ラプトル→ユタラプトル、ダイアベア→ショートフェイスベア)、Artifact二つ名6種19件(蛮族→野獣、狩猟者→狩人、大量→大物、貪食→暴食、深淵→堕落、虚空→虚無)、Boss名4件(キングタイタン→コロッサル・タイタン、オーバーシアー→監督者 等)、著者名3名96件(メイリン→メイ・イン、ダーキーヤ→ダケイヤ、待ち続ける者→待つ者)。
- 資料が割れる・見つからない項目(Reaper総称、Astraeos勢ボス、Genesisミッション名、Darius、City Teleporter 等)は推測で変えず現行のまま「要確認」として残した。Cave名・Loot Crate名には日本語の公式定訳が存在せず、現行は意訳。

## 0.38 v0.11.3: ドシエの日本語名を「～の調査書」へ

- Location Library の日本語名で、Dossier(生物の調査書)132件の表記を「ドシエ: 〇〇」から「〇〇の調査書」へ変更した(利用者要望)。生成スクリプト library_data/build_name_ja.py のルールを変更して再生成し、同梱JSONと作業用JSONの両方へ反映済み。

## 0.37 v0.11.2: 確認ダイアログの独自化と「次回から確認しない」

- Waypoint削除と設定リセットの確認を、ブラウザ標準の `window.confirm` からアプリ独自の選択ダイアログ(showChoiceDialog)に置き換えた。言語設定に連動し、実行ボタンは赤系(btn-danger)で表示する。Escキー=キャンセル、初期フォーカスはキャンセルボタン。背景クリックでは閉じない。
- 削除確認には「次回から確認しない」チェックを追加。チェックして削除すると、そのページを開いている間は以後削除確認を省略する。この設定は保存しない(メモリ上のフラグのみ)ため、ページの再読み込みや再訪問では再び確認する。設定リセットの確認には付けない。
- showChoiceDialog に options(checkboxLabel / escKey / focusKey)と choice.danger を追加。checkboxLabel 使用時の解決値は { key, checked }。

## 0.36 v0.11.1: v0.11.0 の表示まわりの修正

- **列見出しを両言語とも英語に戻した**: Icon / Name / Map を日本語化すると、固定幅の列(Icon 44px 等)からはみ出して表示が崩れたため。Lat / Lon / CustomTag と同じく、列見出しはフィールド名として英語で統一する。
- **起動時のマップ表示トグルの表記**: 地図が展開状態で保存されている場合、起動時に `applyMapsCollapsed` が呼ばれず、ボタンの初期表記(HTML の日本語文言)が残っていた。英語設定で再読み込みすると「全Waypoint表示」と日本語のままになる問題を修正し、展開状態でも現在の言語で表記を設定するようにした。
- **一括移動の移動先から Waypoint Log を外した**: Waypoint Log は Python 版 WaypointLogger が記録した履歴(読み取り専用)であり、移動先にする用途がないため。移動先は INI / My Storage のみになった(移動元としては従来どおり使える)。

## 0.35 v0.11.0: 表示言語(日本語/English)と一括移動

- **表示言語の切替**: `js/i18n.js` を新設し、UIテキストの辞書(ja/en)を保持する。Settings に「表示」セクションと言語セレクトを追加し、`settingsStore` の `uiLang` に保存する(既定は日本語)。静的テキストは index.html の `data-i18n` / `data-i18n-ph` / `data-i18n-title` 属性から、動的テキスト(ステータス・ダイアログ・通知・列見出し・カテゴリ選択肢)は各モジュールの `t()` 呼び出しから適用する。リスト名(My Storage 等)・フィールド名(CustomTag 等)・`[ Save ]` / `[ Load ]` のブラケット表記は固有名詞として両言語共通とする。
- **件数表示**: リストの件数は言語連動にした(日本語: 「N件」/ English: 「N Waypoints」)。地図ペインの「表示中」件数も同じ辞書を使う。
- **Location Library の日本語名**: `location_library.json` の全864エントリに `nameJa` を収録した(翻訳方針: 固有名詞はカタカナ転写、一般名詞は意訳。公式の日本語名が確認できないものも含むため、公式名の転記ではない)。`location_library.js` が `parsed.nameJa` へ読み込み、`waypoint.js` の parsed にも保持する。表示言語が日本語のとき、一覧・詳細・地図マーカーの表示名に日本語名を使い(`displayNameOf`)、Library からのコピー(ドラッグ/一括移動)では日本語名で登録される(`cloneWaypointForTarget` が rawText を再構築する)。英語表示では従来どおり英語名を使う。
- **一括移動**: 各リストのタイトル行に「一括移動」ボタン(`iniBulkBtn` 等)を追加した。対象はそのリストで現在表示されている(検索・Category・Current Map の絞り込み適用後)全件で、移動先は選択ダイアログで選ぶ(Location Library は固定データのため移動先にならない)。意味づけはドラッグと同じ(INI/My Storage からは移動、Library/Log からはコピー)。衝突は1件ずつ確認せず固定ルールで処理する: 同じ座標のものはスキップ、CustomTag が同じものは自動連番、Waypoint Log へはそのまま追加。処理結果は「移動 N 件・スキップ M 件・タグ変更 K 件」の形でステータスに報告する。

## 0.34 v0.10.1での変更概要(Claudeレビュー v0.9.1 の残り指摘への対応)

REVIEW_CLAUDE_v091.md の「2. 未使用コード」「3. コメントの問題」「4. 重複・集約できる処理」への対応。振る舞いの変更はない。

- **Location Library の保存経路を削除**: 固定データ化(v0.8.1)以降は到達不能だった自動保存(autoSaveLibrary・AUTO_SAVE_HANDLERS・serializeLibrary・createEmptyLibrary)と、モーダルのCategory編集欄(formCategoryField・populateCategoryCandidates)を削除。EDITABLE_LISTS からも 'library' を外した。
- **未使用コードの削除**: map_config.js の toJSON / setCachedMapConfig / MAP_CONFIG_FILENAME(loadMapConfig・KNOWN_MAP_FOLDERS は内部利用のみとし export を外した)、waypoint.js の source / libraryPath / v0.1形式移行分岐、waypoint_list.js の setExternalMapFilter / setMapColumnVisible / 列の order・visible 設定、map_viewer.js の CoordinateConverter 保持、settings_store.js の remove()、到達不能なフォールバック、未使用の export・HTML id / class・CSS ルール(.btn-danger 等6種と重複 @media の統合)。
- **MarkIcon定義の簡素化**: displayName / svg フィールドは全件 id と同値だったため廃止し、id が表示名とSVGファイル名を兼ねる形にした。
- **重複処理の集約**: file_manager.js のピッカー3種を共通関数へ、ハンドル保存12関数をキー別のストア生成へ集約し、IndexedDB の接続を操作ごとに閉じるよう変更。あわせて「Json」ハンドル系の名前を実態(My Storage)に合わせて改名した(IDBのキー文字列は互換のため不変)。createControllers はリストキーのループへ変更。列幅リサイズの再描画と、読込完了時の全リスト再描画は requestAnimationFrame でフレーム単位に一本化した。getLatLon の CoordinateConverter は config ごとにキャッシュする。
- **コメント・ドキュメントの是正**: app.js / waypoint_list.js の冒頭説明を現行仕様へ書き直し、削除済み機能(Map Calibration)への言及、JSDoc の位置ずれ、README のバージョン表記(v0.8.8 のままだった)を修正。parseLibrary のエラー文は waypoints.json ではなく Location Library と表示する。
- **意図的に残したもの**: ini_parser.js 内の2つの分割ロジックは、パーサの安定性を優先して統合していない。白の既定色リテラル3か所も、モジュール間の依存方向を崩さないため集約していない。MapConfig の mapName / displayName は config.json の保持フィールドとして残す。

なお §1・§3.4・§4 には、削除済み機能(Map Calibration・[ARKASAWaypointManager]目印セクション等)の記述が当時の記録として残っている。現行仕様は §0 の変更概要と各モジュールの冒頭コメントが正である。

## 0.33 v0.10.0での変更概要(Claudeレビュー v0.9.1 のバグ指摘への対応)

外部レビュー(REVIEW_CLAUDE_v091.md)の「1. バグ・不具合」10件すべてに対応した。未使用コード・コメント・重複の指摘は v0.10.1 で対応する。

- **CustomTag「末尾番号追加」が保存に反映されない問題を修正**: ドラッグ移動/コピー時の複製を `cloneWaypointForTarget()` に集約し、タグを変更する場合は rawText も再構築するようにした(従来は表示だけ差し替わり、保存で元のタグに戻っていた)。
- **名前に「\」を含むと保存で壊れる問題を修正**: ini_parser.js の quotedValue が「\」を先にエスケープするよう変更し、読み込み側のアンエスケープと対称にした。
- **読込時の警告が消える問題を修正**: INI読込直後の案内を同一メッセージへ連結し、復元・再接続時は注意書きを蓄積して完了メッセージへ付記するようにした。
- **ファイルハンドルの代入を読込成功後へ移動**(My Storage / Location Library / セッション復元の全経路)。読込失敗時に、読めなかったファイルへの誤った Save を防ぐ。
- **未知の MarkIcon が編集保存でデフォルトへ置換される問題を修正**: 定義14種に無い MarkIcon は元の rawText を保持し、アイコンを変更しない限り書き戻す。
- **読込完了コールバックの保持方法を修正**(waypoint_icon.js / map_config.js): 呼び出し元ごとに保持し、全員へ通知する。ただし行ごとに新しいクロージャを登録すると完了時に全リスト再描画が雪崩のように発生するため、app.js 側のコールバックは参照固定の関数にし、保持側は Set で同一参照を重複排除する。あわせて、アイコンピッカーを閉じた後に読込完了で再び開いてしまう問題も修正。
- **onModalSave がモーダルを閉じた後に継続してしまう問題を修正**: 非同期処理の後に編集対象の同一性を確認する。
- **ステータス文の「[Read]」表記4か所を「[Load]」へ統一**(v0.9.1の取りこぼし)。
- **地図リサイズ時の fit リセットを廃止**: 初期 fit は loadMap 側で行い、ResizeObserver は再描画のみとした(パン・ズームがリサイズでリセットされない)。
- **未校正マップの Lat/Lon を '…' 表示に統一**: config.json を読めなかったマップでは変換せず、UE生値を Lat/Lon として表示しないようにした(waypoint_list.js 側の従来仕様に合わせた)。

## 0.32 v0.9.1での変更概要(ボタンの英語表記の見直し)

- ファイル読み込みボタンの表記を **[ Read ] → [ Load ]** に変更した(UI英語として「Read」はプログラム用語寄りで不自然なため。Saveと対になる表現としてLoadが標準的)。対象はINI / My Storage / Location Library の3ボタンと、読み込み完了後の「[ Load ✓ ]」表示、ステータスメッセージ・READMEの該当表記。
- ついでに、Location Libraryの空状態テキストに残っていた旧形式名「waypoints.json を新規作成・読み込みしてください」を現行の案内に修正した。

## 0.31 v0.9.0での変更概要(Map Calibration / Debug Mode の廃止)

- MODマップには対応しない方針としたため、その追加手段だった **Map Calibrationタブと Debug Mode を廃止**した。公式マップの校正値は config.json として確定済みであり、通常利用への影響はない。
- あわせて、保存フローのみが使っていたコードを削除した: `js/map_calibration.js` 本体、`map_config.js` の `saveMapConfigToProject()` / `validateMapConfig()` とその内部処理、`file_manager.js` の maps ルートフォルダ関連(`pickMapsRootFolder`・ハンドル保存/読込/破棄)と `getOrCreateSubdirectory` / `getOrCreateFile` / `fileExists`。
- Settingsモーダルは「保存される設定」セクションのみとなった。旧バージョンで `activeLibraryTab='calibration'` が保存されている場合は Storage タブへフォールバックする。
- 本書 §1(Map Calibration保存処理の修正)は廃止された機能の記録であり、現行仕様ではない。

## 0.30 v0.8.8での変更点(Settingsパネルの整理)

- Settingsモーダルを「表示」「保存される設定」の2セクションに再構成した。自動保存の説明とリセットボタンを同じセクションにまとめ、リセットで前回ファイルの記憶も消えることを明記した。モーダル下部のアクション行は Close のみとした。
- 「今後の予定」から、取り下げが決まったルート表示・距離測定とSettingsパネル拡充を削除した(README・§5も同様)。

## 0.29 v0.8.7での変更点(Add時にマップのクリック座標を引き継ぐ)

- INI / My Storage のマップをクリックして座標を指している状態で、そのリストの「Add Waypoint」を押すと、Addフォームの Lat / Lon にクリックした座標が初期値として入るようにした。
- クリック座標はペインごとに保持され(INI=左ペイン、My Storage=右ペイン)、マップを切り替えると消える。指していない場合は従来どおり 0 / 0。

## 0.28 v0.8.6での変更点(動作の軽量化)

- 選択・同期ハイライトの付け替えを全行再描画からクラス付け替えのみに変更した(軽量化①)。従来は1クリックで全リストの再描画とマーカー再構築が連鎖していた。
- Map Viewerのマーカーは、表示集合の署名(件名・アイコン・色・座標を含む)が変わったときだけ再構築するようにした(軽量化②)。
- アイコンHTMLを「アイコン種×Color×IconColor」の組み合わせでメモ化した(軽量化③)。SVG読み込み中のプレースホルダーはメモ化しない。
- Current MapフィルターとMap列表示の設定を1回の描画にまとめ、値が変わらない設定変更では描画しないようにした(軽量化④)。
- 実測(ヘッドレス環境、同梱864件): 全Waypoint表示での行クリック 約1.1秒 → 約44ms、マップ別表示での行クリック 約155ms → 約5ms、全Waypoint表示への切替 約0.44秒 → 約0.19秒。

## 0.27 v0.8.5での変更点(範囲外マーカーの強調を廃止)

- 範囲外マーカーのオレンジのグロー(.out-of-range)と、ツールチップ・件数表示の「範囲外」表記を廃止した。マップ外のWaypointはゲーム上の仕様であり、通常のマーカーと区別しない。

## 0.26 v0.8.4での変更点(範囲外の相対位置表示・フィルターとマップの連動)

- 範囲外Waypointの表示を「地図の端に寄せる」から「地図画像の外側に相対位置のまま表示」に変更した。ゲーム内でもマップ外に実在するWaypoint(例: AstraeosのShallocis (Kraken) terminal、Lon 116.3)があるため。パン/ズームで視界に入れば見え、範囲外マーカーのオレンジのグローとツールチップ表記は維持する。
- リストの検索・Categoryフィルターで絞り込んだとき、マップ上のマーカーも同じ条件で絞り込むようにした。リストコントローラに getVisibleItems() と onVisibleChange 通知を追加し、Map Viewerは全件ではなく表示中アイテムからマーカーを描く。

## 0.25 v0.8.3での変更点(Settingsリセットでセッション情報も消去)

- Settingsの「設定をリセット」は、localStorageの設定だけでなく、前回のセッション情報(IndexedDBに記憶された各ファイルのハンドルと、INI上書き前バックアップ)も消去するようにした。リセット後は前回ファイルが自動復元されなくなる。
- 確認ダイアログの文言にもセッション情報を含めた。消去はリロード前に await で完了させる。

## 0.24 v0.8.2での変更点(Lat/Lon列の初期幅を狭く)

- リストのLat/Lon列に初期幅64pxを設定した。従来は初期幅が無く、Name/CustomTag列と均等に広がっていた。座標の表示は最大でも3桁+小数程度(例: 100.0)で、等幅フォント5文字+セル余白に収まるギリギリの幅。空いた分はName/CustomTag列が広がる。
- ユーザーがドラッグでリサイズした列幅(保存済み設定)がある場合はそちらが優先される。

## 0.23 v0.8.1での変更点(Location Libraryを完全な固定データに)

- Location Libraryは収録済みの固定データという位置づけを明確にし、行の編集ボタン・削除ボタンを廃止した(コントローラーに行アクションを渡さない)。
- Libraryタブの「＋ Add Waypoint」行も廃止した。
- 他のリストからLocation Libraryへのドラッグ&ドロップも、追加できない旨のステータス表示で拒否するようにした。
- Libraryから他リストへのドラッグ(コピー、v0.8.0)と、自分のLibraryファイルをReadして参照することは従来どおり可能。

## 0.22 v0.8.0での変更点(Libraryの件数表示・範囲外表示・色とタグ・ドラッグのコピー化)

- **①Categoryフィルターの件数を表示中マップ基準に変更**: Location LibraryのCategoryフィルター(プルダウン)の件数が全Waypoint基準だったのを、選択中のマップ(ExternalMapFilter)で絞った範囲の件数に変更した(All の件数も同範囲)。
- **②範囲外Waypointを地図の端に寄せて表示**: Lat/Lonが0〜100の範囲外のWaypointは、従来は地図上で非表示だったが、表示位置だけを端(0または100)にクランプして表示するようにした。データ自体は元の座標を保持する。該当マーカーには out-of-range クラス(半透明+オレンジのグロー)が付き、ツールチップにも「範囲外」と表示される。情報欄の文言も「範囲外 N 件は地図の端に表示」に変更。
- **③同梱データにカテゴリ色を設定**: location_library.json の全864件に、カテゴリ別の Color(Obelisk=水色、Artifact=金、Cave=紫、Explorer Note=オレンジ、Loot Crate=緑、OSD=赤、Boss=マゼンタ、Mission=青)を設定し、IconColorは白に統一した。
- **④Location Libraryからのドラッグをコピーに変更**: Libraryを参照元として扱い、ドラッグしてもLibrary側は減らない。コピーには新しいIDを振る。Waypoint Logからのドラッグも従来どおりコピー(新しいIDを振るよう統一)。
- **⑤同梱データのCustomTagを一意化**: ゲーム側がCustomTagでWaypointを管理するため、同梱データ全864件のCustomTagを「カテゴリ名+連番」(例: Explorer Note 312)に振り直し、全件一意にした。ドラッグ時のCustomTag衝突ダイアログ(末尾番号追加/上書き)は従来どおり使える。

## 0.21 v0.7.1での変更点(同梱データのZ座標を実データ化)

v0.7.0の同梱データは出典がLat/Lonのみだったため全件Z=0だったが、Explorer Noteについては実UE座標(X/Y/Z)を持つ原データ(ASA_Note_Marker_Maker、公式WikiのASA版Explorer Mapデータ由来)から取り直した。

- **The Island(228件)・Scorched Earth(148件)・Aberration(167件)のExplorer Noteを、原データのX/Y/Zそのままで再収録**。Z範囲はマップにより約-216,000〜+82,000。
- AberrationのExplorer Noteは、v0.7.0ではASAで検証できる出典が無く1件のみだったが、この原データで167件を収録できた。
- The Islandは、Wiki表で座標が壊れていた Carcharodontosaurus / Rhyniognatha のDossierと、欠落していた Nerva Note #28 も原データでは正常で、3件追加された。
- 合計は695件→**864件**。
- Explorer Note以外(Obelisk / Artifact / Cave / Loot Crate / OSD / Boss / Mission)と Lost Colony のExplorer Noteは、出典がLat/LonのみのためZ=0のまま(アプリの地図表示はLat/Lonで描くため影響なし。ゲーム内マーカーの高さは地形と合わない場合がある)。

## 0.20 v0.7.0での変更点(Location Library収録データの同梱)

Location Library本来の目的(既知の重要スポットをあらかじめ収録し、誰でも使えるようにする)を実装した。

- **同梱データ `location_library.json` をリポジトリ直下に配置**(695件)。起動時の復元で、Location Libraryの前回ファイルが無く再接続待ちでもない場合に限り、fetchして初期表示する。ユーザーが自分のファイルをReadした場合はそちらが優先され、同梱データは表示されない。
- 同梱表示中の編集は自動保存先が無いため保存されない(次回は同梱データが読み直される)。INIやMy Storageへはドラッグ&ドロップでコピーして使える。
- **収録範囲**: 全10マップ分。カテゴリは Obelisk / Artifact(洞窟入口) / Cave / Explorer Note / Loot Crate / OSD / Boss / Mission。座標はコミュニティで共有されている **ASA (Survival Ascended) の情報のみ** を採用し、ASE (Survival Evolved) の座標は混ぜていない。Lat/LonからUE座標への変換は各マップの校正値を使用し、Genesis の海側スポットは海側校正値+Z=266892で収録した。
- **出典**: ARK公式Wiki(ark.wiki.gg)のASA版マップデータ(arkstatus.com転載分を含む)、dyadica/ASA_Note_Marker_Maker(Explorer NoteのUE座標、公式WikiのASA版Explorer Mapデータ由来)、gamesomg等のASA専門ガイド。出典同士の食い違いは作業ファイル library_data/CONFLICTS.md に45件記録(リポジトリには含めない)。
- **既知の欠け**: Aberration / Extinction のExplorer NoteはASAで検証できる全件リストが無く大半が未収録(確認できた1件のみ)。The Island の深海クレートはASA検証済みリストが無く未収録。The Center / Ragnarok / Valguero のExplorer NoteはASA版に配置自体が無い(仕様)。座標がマップ端(0〜100)を超える4件は出典どおりの値で収録した。

## 0.19 v0.6.12での変更点(READMEの書き直し)

- **READMEをARKプレイヤー向けに全面書き直した**。技術的な解説(File System Access APIの詳細、データ安全性の内部仕様、My Storageのファイル形式、Map Calibration等)を削り、「使い方」「できること」「注意」に絞った平易な内容にした。
- 削除した節: GitHub Pages公開方法(運用者向け)、フォルダ構成、Genesis のZ座標による陸海判別の説明。
- ローカルでの利用方法は、cloneできる読者には自明としてREADMEでは解説しない方針とした。
- 併せて、map_config.js 先頭コメントに残っていた waypoint.json の役割分担の記述(v0.6.11で生成を廃止したもの)を現在の構成に合わせて修正した。

## 0.18 v0.6.11での変更点(使われていないものの掃除)

目印セクション(v0.6.10)と同種の「置かれる・書かれるが使われない」ものを監査し、まとめて取り除いた。

- **maps/*/waypoint.json の生成を廃止**: MapConfig保存時に空の waypoint.json を作っていたが、読み込むコードが存在しなかった。saveMapConfigToProject の生成処理・結果フィールド・検証チェックリストの項目を削除した(地図画像のプレースホルダ生成は、新規マップ用に意味があるため残した)。
- **列設定ポップオーバーを削除**: v0.6.3で⚙ボタンを廃止して以降、呼ばれることのなかった _toggleColumnPopover など一式と、専用CSSを取り除いた。列設定の保存は列幅だけを保存する形に簡素化した。
- **pickSaveJsonFile を削除**: 呼び出し元のない未使用関数だった。
- **資源4種のSVGを削除**: Metal / Obsidian / Crystal / Pearl は画像(データURI)で描画するようになって以降、SVGファイルが読み込まれることはなかった。定義側の svg フィールドも外し、描画側は svg の無い定義を安全に扱うようガードを追加した。
- **data/ のサンプルファイルを削除**: コードからもREADMEからも参照されていなかった2ファイルを、リポジトリからも削除した。
- リポジトリ内の空プレースホルダ(maps/*/map.png・map.webp、waypoint.json)も併せて削除した。

## 0.17 v0.6.10での変更点([ARKASAWaypointManager]セクションの廃止)

- **[ARKASAWaypointManager]セクションを廃止した**。このセクションの DatabaseFile は、アプリが書き込むだけで値を読むコードが無く、ゲーム本体も無視する目印だった(My Storageの場所は、Readで選んだファイルのハンドルをIndexedDBに記憶して復元する方式)。ユーザー判断により廃止した。
- ensureWaypointManagerSection() は削除し、追加処理は無くなった。
- 代わりに removeWaypointManagerSection() を追加し、INI保存時に「目印だけ(DatabaseFile行のみ、旧ファイル名 ARKASAWaypoints.json の場合も含む)」のセクションが残っていれば取り除く。中身が他にもある場合はユーザーが転用している可能性を考えて触らない。
- rebuildIniTextの挿入位置フォールバック(セクションが残っているファイルでは、その手前へWaypoint行を入れる)は、既存ファイル保護のため残している。

## 0.16 v0.6.9での変更点(外部コードレビューの「中」「軽微」対応)

Claudeによるv0.6.7のコードレビュー(REVIEW_CLAUDE_v067.md)で挙がった「中」7件と「軽微」のうち、実害のあるものを直した。

- **中6(SavedMinimapMarksが無いINIへの追加位置)**: rebuildIniTextは、Waypoint行が元々無いINIでは追加行をファイル末尾ではなく [/Script/ShooterGame.ShooterGameUserSettings] セクション内へ入れる(末尾だと別セクションに属してゲームに読まれない恐れがあった)。
- **中7(ReadでINIを書き換えない)**: [ARKASAWaypointManager]セクションの追加をRead時からINI保存時へ移した。Readはファイルを変更しない。
- **中8(改行コードの保持)**: rebuildIniTextと ensureWaypointManagerSection は元ファイルの改行コード(CRLF/LF)をそのまま使う。
- **中9(座標の丸め保持)**: 編集モーダルでLat/Lon・MapNameが未編集の場合、表示の丸め(小数3桁)を経由せず元のUE座標を保持する。編集開始時点のフォーム値を記録し、保存時に一致すれば元のx/yを使う。
- **中10(パーサーのエスケープと警告)**: parseParenObjectが引用符内のエスケープ(\")を処理し、自前で書き戻した名前と往復できるようにした。LocationやX/Y/Zが欠けた行には警告フラグを付け、読込時に件数を知らせる(黙って座標0にしない)。
- **中11(未認識行の通知)**: SavedMinimapMarks= で始まらない MinimapMarks行(先頭のS欠けなど)の件数を数え、読込時に知らせる。行自体は従来通り書き戻しで保持される。
- **中12(Libraryのmap乖離)**: Location Libraryの entry.map は、rawTextにMapNameが無い場合の予備としてのみ使う(rawText側を正とする)。
- **中15(zの数値化)**: 編集保存時の z は数値として保持する。Z欄が空欄・非数値の場合は入力エラーにする。
- **中16(MapName必須)**: validateWaypointにMapName必須を追加した。
- **軽微13(古いハンドルの破棄)**: 起動時復元でNotFoundErrorになったファイルハンドルはIndexedDBから破棄する。ハンドルの記憶は、読込が成功した後に行うよう各Read処理を直した。
- **軽微14(MapConfig自己修復の限定)**: saveMapConfigToProjectの自己修復(ハンドル破棄+再選択)は、NotFoundError / NotAllowedError / SecurityError の場合に限る。
- **軽微17(Genesis config表記の統一)**: MapConfig.toJSON() は、Genesis陸/海どちらの保存でも mapName を Genesis_WP に統一する。
- **軽微18(保守性)**: 未使用の pickSaveTextFile / getAllIconPreviewStates を削除。escapeHtml・formatNum・clamp01 の重複定義を js/util.js へ集約した。READMEを現行仕様に全面更新した。app.jsの分割は動作安定を優先して見送った。

## 0.15 v0.6.8での変更概要(Claudeコードレビュー重大指摘の修正)

外部コードレビュー(Claude、v0.6.7のzip添付方式)で挙がった重大指摘5件をすべて修正した。

- 重大1・2: INI書き戻し(buildRawText)のフィールド置換を、正規表現から「最上位フィールド単位の置換」(splitTopLevelFields / setTopLevelField)へ書き換えた。従来は Name が MapName の、Color が IconColor の内側に先にマッチし、フィールドの並び順(アプリ生成行など)によっては改名とColor編集が保存されなかった。置換文字列中の $ パターン展開による名前の破損も解消。未知フィールドは元の文字列のまま保持される。検証用に uitest/ini_test.mjs(実INIで20項目)を追加。
- 重大3: INI保存時に、保存直前に現在のファイル内容を読み直す。読み込み後に外部(ゲーム)で変わっていた場合、Waypoint以外の変更は最新の内容を土台にして保持し、Waypoint行自体が変わっていたら追加の確認ダイアログを出す。上書き前の内容は緊急用バックアップとしてIndexedDBへ保持する(saveIniBackup)。
- 重大4: 起動時のセッション復元で requestPermission を呼ばないようにした(queryPermissionState で状態だけ確認)。granted のものだけ自動復元し、prompt のものはヘッダーの[ 前回のファイルを再接続 ]ボタン(クリックの中で許可を取り直す)へ回す。復元状況のステータス表示も実態に合わせた。
- 重大5: 地図ドロップダウンの option を innerHTML から DOM生成(createElement + textContent)へ変更し、MapName 由来のXSSを塞いだ。index.html に Content-Security-Policy (script-src 'self' 等)も追加。

## 0.14 v0.6.7での変更概要(アイコン名を出さない・説明文の整理・ピッカーへの色反映)

- MarkIconの選択ボタンにもアイコン名を表示しないようにした(アイコンのみ、ツールチップでも名前は出ない)。ゲーム内ではアイコン名を確認できないため、それに合わせた。
- Location欄の下にあった説明文(Lat/LonとZの座標系の説明)を削除し、代わりにZのラベルを「Z (UE座標)」と表記するようにした。
- MarkIconピッカーの一覧アイコンを、編集中のBASE COLOR / ICON COLORで描画するようにした(従来は固定色)。色を変えながらアイコンを選べる。

## 0.13 v0.6.6での変更概要(色スライダーの改善)

- 編集モーダルの色スライダー(BASE COLOR / ICON COLOR)を細くした(トラック3px、ツマミ9×18px)。
- スライダーに `.modal input` の枠線と内側余白(padding 8px 10px)が効いていて、ハンドルが両端まで届かず途中で止まって見えた問題を修正した。range入力だけ枠・余白を打ち消し、トラックが入力幅いっぱいに広がってハンドルが0/最大で端と一致するようになった。

## 0.12 v0.6.5での変更概要(モーダルに削除ボタン・ピッカーはアイコンのみ・フォントを太いゴシックに)

- 編集モーダルのボタン列で、Cancelの右に削除ボタン(ゴミ箱アイコン)を追加した。編集時のみ表示され、行のゴミ箱と同じ確認ダイアログ付きの削除フローを使う。Save/Cancelの並びは v0.6.4 のまま変更なし。
- MarkIconのドロップダウン(ピッカー)を、ゲーム内UIに合わせてアイコンのみのグリッド表示(5列)に変更し、名前の文字を出さないようにした。ツールチップでも名前は出ない。選択中のアイコン名はピッカーを開くボタン側には従来通り表示される。
- タイトル・タブ・ボタン・見出し・ヘッダーリンクのフォントを、太めのゴシック体(--font-gothic: Noto Sans JP 700、なければ游ゴシック等のシステムゴシック)に変更した。数値や座標などの等幅表示は従来通り JetBrains Mono。

## 0.11 v0.6.4での変更概要(ゲーム内UIへの寄せ第2弾・Star差し替え・デフォルト半々)

- Starアイコンを実物に合わせて差し替えた(5角星を2つ36°ずらして重ねた10角星)。Timerは実物スクショでストップウォッチ型と判明したため描き直し、CircleSlashは実物と現行SVGの一致を確認した。
- 資源アイコン4種(Crystal/Metal/Obsidian/Pearl)の画像を高解像度スクショ(2588×1455)から切り抜き直した。並び順は左からCrystal/Metal/Obsidian/Pearl(ユーザー確認済み)。
- アイコンのグリフ(SVGの白い部分)を拡大し、BaseIconの六角形の縁ギリギリまで大きくした(CSSのscale 0.56→1.02)。資源画像も84%→88%に拡大。
- INI列のデフォルト幅を420px固定から「ワークスペースの50%」に変更した。設定リセット後の初期状態が左右半々になる(ドラッグした場合は従来通りpxで保存)。
- Libraryタブ(My Storage/Location Library/Waypoint Log)は枠線を廃止し、選択中を太いアンダーバー(内側シャドウ4px+発光)で示すようにした。GameUserSettings.iniの見出しにも同じ太さのアンダーバーを追加。
- パネル枠(.column/.map-pane/.modal)を、上部が明るく光る発光グラデーション枠に変更。モーダルにも角カットを追加した。
- ヘッダー(.topbar)の背景を、ゲーム内UI風の明るい青グラデーションに変更した。
- 編集モーダル: 右上隅に閉じる(✕)ボタンを追加(Cancelと同じ動作)。Save/Cancelの並びを入れ替え(Saveが左)、ボタンをフォーム列幅いっぱいのバー型にした。色スライダーをゲーム内UI風(グラデーションのトラック+発光する四角いツマミ)に変更。

## 0.10 v0.6.3での変更概要(切替ボタンの文言・列設定の廃止・設定リセット・アイコン実物合わせ)

- 地図表示トグルの文言を、実際の作用(リストの絞り込み切替)が分かる文言へ変更した: 地図表示中は「[ 全Waypoint表示 ]」、全表示中は「[ マップ別表示に戻す ]」。
- リストの「表示列/列順」設定(⚙ボタンとポップオーバー)を廃止した。列順・表示列は常にデフォルト(全列表示)となり、保存済み設定からは列幅だけを引き継ぐ。列幅のドラッグリサイズと保存は従来どおり。
- Settingsに「設定をリセット」ボタンを追加した。保存済みの設定(レイアウト・選択中Map・タブ・列幅・検索文字・ソート・Debug Mode)をすべて削除し、再読み込みでデフォルトに戻す。セッション復元(ファイルハンドル)は対象外。
- WaypointアイコンSVG 12点をゲーム内の実物に合わせて描き直した(Kill=照準、Wait=時計、Root/Collectible=手、Dino=3本指の足跡、Crystal=結晶クラスタ、Pearl=真珠の山、ArrowDown=二重シェブロン、MultiPlayer=3人、Star=星+破片、Location=二重丸ピン、Metal/Obsidian=岩塊)。TimerとCircleSlashは実物未確認のため据え置き。
- 資源系4点(Metal/Obsidian/Crystal/Pearl)はゲーム内でアイテムのテクスチャ画像が使われているため、SVGではなく実物画像で描画するようにした。ユーザーがゲーム内で撮影したスクリーンショットから切り抜き、背景を透過したWebPを data URI として js/icon_images.js に埋め込み、waypoint_icon.js が該当IDを画像レイヤーで描画する(SVGファイルは残置するが未使用)。

## 0.9 v0.6.2での変更概要(地図を隠した間は全表示)

- 地図エリアを隠している間は、リストのマップ絞り込みを解除して全Waypointを表示する(マップ選択UI自体が隠れて切り替えられないため)。Map列も再表示される。地図を再表示すると、選択中マップ(viewerMapName)の絞り込みに戻る。`applyMapsCollapsed` が `applyCurrentMapFilter` を呼び、フィルター側は `mapsCollapsed` の間だけ実効値を空にする。
- タイトル行の検索欄プレースホルダを「Search」に短縮(狭い行で切れるため)。
- Libraryのタブ行を廃止し、タブをタイトル行へ統合した(「Library」見出しは廃止)。左右のタイトル行の高さを54pxに統一し、折り返しを禁止(狭い幅では見出しを省略表示)することで、両リストのテーブル開始位置が一致するようにした。
- (v0.6.1修正として先行反映) 行内アクションボタンがセルからはみ出し、削除アイコンが省略記号「…」に化ける問題を修正(flexラッパー追加+列幅84px)。

## 0.8 v0.6.1での変更概要(検索・件数をタイトル行へ集約)

- リスト内の検索欄(.column-search)と件数表示(.column-meta)の専用行を廃止し、GameUserSettings.ini / Library 両方のタイトル行(.column-head)右側の `.head-tools` へ移した(行の節約)。
- Library側のツール群はタブごとに `.head-tool-group` で切り替わり、`switchLibraryTab` がパネルと連動して表示を切り替える(Storage群にはSaveボタンも含む)。
- Map Calibration内の「Current Map」表記の残りも「地図のドロップダウンで選択中のMap」へ更新。
- テストは実ブラウザ(puppeteer-core + chrome-headless-shell)方式に移行し、`uitest/test.mjs`(作業フォルダ側)に27項目を実装。

## 0.7 v0.6.0での変更概要(マップ選択の統一・列幅不具合修正・My Storage手動保存)

- **リスト列幅の不具合修正**: v0.5.0で追加したtfoot(Add行)の `colspan="99"` が `table-layout: fixed` の列数を99列に膨らませ、可変幅の列(Name/Map/Lat/Lon/CustomTag)が約3pxに潰れてIcon列しか見えなくなっていた。実ブラウザで計測して特定。`waypoint_list.js` の `render()` で colspan を実際の列数(表示列+アクション列)に設定するよう修正。
- **マップ選択の統一**: ヘッダーのCurrent Map行(.global-bar)を廃止し、左の地図のドロップダウンに一本化した。選択中のマップは `viewerMapName` が唯一の正で、リストの絞り込みと2枚の地図は常にこれに追随する。選択肢は全リストのデータに存在する実効マップ名のみ(All Mapsなし、Genesisは陸/海分割)。「地図を隠す」トグルはヘッダー右側へ移動。
- **右の地図がLibraryタブに追随**: 右ペインの表示元はアクティブなタブ(Storage/Library/Log)だけになり、CalibrationタブではStorage+Library両方。右上のチップ表示もタブ名に連動する。
- **座標リードアウトはLat/Lonのみ**に簡素化(UE X/Yを削除)。地図クリック時の十字マーカーは `mix-blend-mode: difference` で背景の反転色表示に変更。
- **My Storageも手動保存化**: Storageパネルのメタ行右端に[ Save ]ボタンを追加し、変更時のみ有効化される。自動保存が残るのはLocation Libraryのみになった。
- **配色を青寄りに調整**: ゲーム内UIに寄せ、背景をネイビー系(--bg #040b18 / --panel #071426)、ライン・発光を蛍光ブルー(--accent #4dd2ff)に変更。

## 0.6 v0.5.1での変更概要(保存方式とCurrent Mapの見直し)

- GameUserSettings.ini の保存は自動保存を取りやめ、手動保存に戻した。Saveボタンは INI カラムの見出し「GameUserSettings.ini」の右端に置き、未保存の変更があるときだけ有効になる。保存時は従来の確認ダイアログを挟む。Storage/Library の自動保存は継続。
- Current Map の「All Maps」を廃止した。選択肢はデータに存在する実効マップ名のみで、Genesis は陸(Genesis1_WP)と海(Genesis1Ocean_WP)に分かれて表示される。絞り込みは waypoint_list.js の getMapKey(実効名)で比較する。特定マップ選択中は各リストの Map 列を隠す。
- 座標リードアウト(クリック地点の Lat/Lon・UE座標)は、ゲーム内マップに倣って地図の下部中央オーバーレイへ移した。

## 0.5 v0.5.0での変更概要(UI簡素化・全リスト自動保存・ARK風デザイン強化)

- リスト上部のツールバー(Read/Add/Edit/Delete/Save)を全リストで廃止した。
  - Read/Open: リストが空のときに表示される空状態メッセージの中のボタンへ移設した。
  - Add: テーブル末尾(tfoot)の「＋ Add Waypoint」行へ移設した。
  - Edit/Delete: 各行の右端にペン/ゴミ箱のアイコンボタンとして表示する(waypoint_list.js の rowActions。log は読み取り専用のため無し)。削除時の確認ダイアログは従来どおり。
  - Save: 廃止し、全リストで変更のたびに自動保存する。GameUserSettings.ini も AUTO_SAVE_HANDLERS.ini(autoSaveIni)で確認ダイアログなしに書き戻す(未読込時は無効)。これにより「保存せずに閉じて変更を破棄する」ことはできなくなった。
  - Waypoint Log の Reload ボタンは廃止した(再読込は Open から行う)。
- 地図ペインのタイトル行とツールバー行を廃止し、オーバーレイUIへ移した。
  - マップ選択ドロップダウンは左ペイン左上の1個のみ(2枚連動)。右ペインは createMapViewer の mapSelect が null でも動作する。
  - ペインの識別は右上の小ラベル(INI / Storage ・ Library)で行う。
  - 件数表示は右下、クリック地点の座標リードアウトは左下へオーバーレイ表示する。
  - Grid は常時表示とし、Fit/ズームボタンは廃止した(Fit は地図のダブルクリックで代替)。
- デザインを ARK 本編へ寄せた: 電光シアン(#5ee9ff)を基調に、パネルとボタンへ角カット(clip-path)と発光(box-shadow)を適用し、リスト行はゼブラ+選択時の左バー+発光、行内ボタンは六角チップ風にした。

## 0.4 v0.4.1での変更概要

- 地図エリアが縦幅を圧迫するため、Current Map バー右端に「地図を隠す/表示」トグルを追加した。状態は layout.mapsCollapsed に保存される。
- 地図エリアの初期高さを 320px → 260px に縮小した(ドラッグ変更・保存は従来どおり)。

## 0.3 v0.4.0での変更概要(レイアウト刷新・2枚地図+ARK風テーマ)

- Map Viewerを Library のタブから廃止し、画面上部の地図エリアに2台のビューアを常時表示する構成へ変更した。左は GameUserSettings.ini のWaypoint、右は My Storage / Location Library のWaypointを表示する。
- 2台のビューアは表示マップを共有し、パン/ズームが連動する(片方を操作するともう片方も同じ視点になる)。これによりINI側(ゲーム内の現状)と保存側のWaypointを見比べられる。
- 地図エリアの高さは専用Splitterでドラッグ変更でき、レイアウト設定として保存される(layout.mapsRowHeight)。
- map_viewer.js は複数インスタンス対応となり、要素参照は生成時に渡された root 配下のクラス指定へ変更した(id参照は廃止)。公開APIに getView/setView を追加した。
- テーマをARK本編UI寄りの配色へ変更した(濃いティールの背景、シアンのアクセント、発光を伴うヘッダー/アクティブタブ)。色はCSS変数で一元管理する。
- 旧バージョンで保存された activeLibraryTab='mapviewer' は 'storage' へ読み替える。

## 0.2 v0.3.9での変更概要

Map Viewerの表示候補に、フォルダ解決専用の別名である "Extinction"（末尾 _WP なし）が "Extinction_WP" と重複して現れる問題を修正した。候補の種は _WP で終わる MapName に限るようにし、別名はフォルダ解決（KNOWN_MAP_FOLDERS）には引き続き使える。

## 0.1 v0.3.8での変更概要(Genesis Part 1 の陸・海判別)

Genesis Part 1 の Waypoint は全バイオーム共通で MapName="Genesis_WP" となるため、MapNameだけでは陸(Genesis1)/海(Genesis1Ocean)のどちらの座標変換・地図が適用か決められなかった。v0.3.8 では、陸と海でZ座標の範囲が重ならないこと(実測: 陸 -390453〜25888 / 海 255450〜338334)を利用し、`map_config.js` の `resolveEffectiveMapName()` が Z >= 140000 を海として実効MapName(Genesis1_WP / Genesis1Ocean_WP)へ振り分けるようにした。一覧のLat/Lon表示、Map Viewerのマーカー照合・候補、Add/Editモーダルの座標変換がこの振り分けを使う。Waypointに保存されるMapNameは変更せず、INI書き戻しでも Genesis_WP のまま出力する。Add/Editモーダルで実効MapNameを入力した場合は Genesis_WP へ戻し、意図はZ座標(各バイオームの代表Z)で表す。

## 0. v0.3.6での変更概要(v0.3.5からの差分のみ)

| 項目 | v0.3.5 | v0.3.6 |
|---|---|---|
| Map Calibration保存 | 書き込み成功のみで成功表示 | 保存後に再読み込みして内容を検証し、一致した場合のみ成功表示 |
| Categoryの対象 | 4リスト共通(ini/storage/library/logのうちini/storage/libraryにフィルターUIあり) | Location Library専用(ini/storage/logのCategory UI・データを廃止) |
| My Storageの保存形式 | JSON(`ARKASAWaypoints.json`) | プレーンテキスト・1行1Waypoint(`ARKASAWaypointManager_MyStorage.txt`) |

その他の仕様・UI・動作(v0.3.5までに実装済みのすべての機能)は変更していない。

## 1. Map Calibration保存処理の修正

(注: Map Calibration機能は v0.9.0 で廃止した。本節は当時の記録であり、現行の仕様ではない。)

### 1.1 不具合

`Save MapConfig`実行時、`maps/<MapName>/`フォルダの作成・空の
`config.json`の作成までは行われるが、実際の座標値(JSON本文)が
書き込まれない場合があった。

### 1.2 修正内容

`map_config.js`の`writeMapConfigFiles()`を以下の手順へ変更した。

```
1. Current Map(mapConfig.mapName)からフォルダ名を導出する
2. maps/<フォルダ名>/ が存在しなければ作成する
3. config.json が存在しなければ作成する(getOrCreateFile)
4. 現在のMapConfigをJSONとして書き込む(上書き)
5. 同じファイルハンドルから再度 readFile() し、書き込んだ内容を読み戻す
6. 読み戻した内容(JSON.parse結果)と、書き込もうとした内容
   (mapConfig.toJSON())の主要フィールドを比較する
7. 一致しない場合は success:false を返す(例外は投げない)
8. 一致した場合のみ success:true を返し、呼び出し元(app.js)が
   「MapConfig saved.」という成功メッセージを表示する
```

比較は`mapConfigJsonEquals(a, b)`が、`mapName` / `displayName` /
`latitudeScale` / `longitudeScale` / `latitudeOrigin` / `longitudeOrigin` /
`defaultZoom` / `minZoom` / `maxZoom` の全フィールドについて厳密等価
(`===`)で行う。

この検証により、「画面上だけ更新されていても完了とはしないこと」
「実際にconfig.jsonの内容が更新されていることを成功条件とする」という
要件を、根本原因(ハンドルの不整合・書き込みタイミングの問題等)を
特定できない場合でも確実に満たせるようにしている。検証に失敗した場合は
`app.js`の`onSaveMapConfig()`が既存の失敗処理(エラーメッセージ表示、
成功表示のスキップ)をそのまま行う。

なお、v0.3.2で実装済みの「ハンドルが無効な場合の自己修復リトライ」
(`saveMapConfigToProject()`の`try/catch`によるフォルダ再選択)は
そのまま維持しており、`writeMapConfigFiles()`が**例外を投げた場合**の
リトライ対象である(検証失敗による`success:false`はリトライ対象外とし、
そのまま失敗として報告する)。

## 2. Categoryの扱い変更

### 2.1 対象範囲

Categoryは元々ARKのSavedMinimapMarksフォーマットに存在しない、
アプリ独自の管理情報である。この性質を踏まえ、Categoryを保持・編集・
フィルターできる対象を**Location Libraryのみ**に限定した。

| リスト | v0.3.5 | v0.3.6 |
|---|---|---|
| GameUserSettings.ini | Categoryフィルターあり | Categoryフィルターなし |
| My Storage | Categoryフィルターあり | Categoryフィルターなし |
| Location Library | Categoryフィルターあり | 変更なし(維持) |
| Waypoint Log | Categoryフィルターなし(元々ini同様のデータ) | 変更なし |

### 2.2 UI変更

- 一覧のCategoryフィルター(`<select class="category-filter">`)を
  GameUserSettings.ini / My Storage / Waypoint Logの検索行から削除した
  (`index.html`)。Location Libraryのみ引き続き表示する
- `WaypointListController`の生成時、`categoryFilterEl`をLocation Library
  以外へは渡さないよう変更した(`app.js`の`createControllers()`)。
  `WaypointListController`自体の実装(Categoryフィルターに対応する
  ロジック)は変更していない。単に利用箇所を制限しただけである
- Add/Editモーダルの Category入力欄(`#formCategoryField`)は、
  `openAddEditModal(listKey, id)`が`listKey === 'library'`の場合のみ
  表示するよう変更した(`classList.toggle('hidden', !isLibrary)`)。
  GameUserSettings.ini / My StorageのWaypointを追加・編集する際は
  Category欄自体が表示されない
- Category入力欄の候補(`populateCategoryCandidates()`)も、
  Location Library自身に存在するCategoryのみから生成するよう変更した
  (v0.3.5まではLocation Library・My Storage・GameUserSettings.iniの
  3つから候補を集めていたが、後者2つは元々Categoryを持たなくなった
  ため対象から外した)

### 2.3 データモデル

`waypoint.js`の`parsed.category`フィールド自体は、内部データモデルの
一貫性を保つため引き続き存在する(すべてのWaypointが同じ形のオブジェクト
であることを保つ設計を維持するため)。ただし、GameUserSettings.ini /
My Storageから生成されるWaypointの`category`は、UIから設定する手段が
無いため常に空文字列のままとなり、実質的に「Categoryが存在しない」状態と
同義になる。RawTextやMy Storageのテキスト形式にはそもそもCategoryを
表現するフィールドが無いため、保存・読込のいずれの経路でもCategoryが
これらのデータへ混入することはない。

## 3. My Storageの保存形式変更

### 3.1 フォーマット

保存ファイル名を`ARKASAWaypoints.json`から
`ARKASAWaypointManager_MyStorage.txt`(UTF-8プレーンテキスト)へ変更した。

```text
SavedMinimapMarks=(Name="Metal",CustomTag="Waypoint",Location=(...),...)
SavedMinimapMarks=(Name="Crystal",CustomTag="Waypoint",Location=(...),...)
```

1行に1つのWaypoint(1つの`SavedMinimapMarks=`行)を書き込む。JSON形式
(角括弧・波括弧によるオブジェクト配列)は一切使用しない。

### 3.2 実装

`storage.js`を全面的に書き換えた。

```js
export function serializeStorage(waypoints) {
  const lines = waypoints.map((wp) => wp.rawText).filter((line) => line?.trim() !== '');
  return lines.length > 0 ? lines.join('\n') + '\n' : '';
}

export function parseStorage(text) {
  if (!text || text.trim() === '') return [];
  const entries = parseSavedMinimapMarks(text); // GameUserSettings.iniと同じParser
  return entries.map((e) => createWaypoint({ rawText: e.rawText, parsed: convertToWaypointData(e), source: 'Storage' }));
}
```

`parseSavedMinimapMarks()`(`ini_parser.js`)は元々「`SavedMinimapMarks=`で
始まる行のみを読み込み、それ以外の行(空行を含む)は無視する」という
実装になっているため、要件の「空行は無視する」「`SavedMinimapMarks=`で
始まる行のみ読み込む」は、GameUserSettings.ini用のParserをそのまま
再利用するだけで自然に満たされる。JSON用の読み書き処理
(旧`JSON_VERSION`・`createEmptyStorage`等)はすべて削除した。

### 3.3 ファイル操作の変更

`file_manager.js`へ、プレーンテキスト(.txt)用のファイルピッカーを
新設した。

- `pickOpenTextFile(description)`: 既存の`.txt`ファイルを開く
  (`showOpenFilePicker`、`text/plain`/`.txt`フィルター)
- `pickSaveTextFile(suggestedName, description)`: 任意の場所へ`.txt`
  ファイルを保存する(`showSaveFilePicker`)

`app.js`の`onStorageRead()` / `onStorageSave()` / `autoSaveStorage()`は、
これらのテキスト用ピッカーおよび`serializeStorage()`/`parseStorage()`
(新実装)を使うよう変更した。JSON専用だった`pickOrCreateJsonFile()`
(`file_manager.js`)は、My Storageでの利用が無くなったため削除した
(Location Libraryは引き続きJSON形式のため、`pickOpenJsonFile()` /
`pickSaveJsonFile()`は維持している)。

### 3.4 [ARKASAWaypointManager]セクションの修正

`ini_parser.js`の`ensureWaypointManagerSection()`が、
`GameUserSettings.ini`へ追加する`[ARKASAWaypointManager]`セクションの
`DatabaseFile`値を、新しいファイル名に合わせて修正した。

```ini
[ARKASAWaypointManager]
DatabaseFile=ARKASAWaypointManager_MyStorage.txt
```

(v0.3.5までは`DatabaseFile=ARKASAWaypoints.json`のままになっており、
実際のファイル名と一致していなかった)

### 3.5 保存場所について(v0.3.1から継続の既知の制約)

要件の「保存場所は従来通り、GameUserSettings.iniと同じフォルダとする」
について、File System Access APIには「あるファイルハンドルから、その
親ディレクトリや兄弟ファイルを取得する」手段が存在しないため、
アプリが自動的にGameUserSettings.iniと同じフォルダを検出して保存する
ことは技術的にできない。この制約はv0.1以来一貫して同じであり、
ユーザーがファイル選択ダイアログで手動的に同じフォルダを選ぶ運用を
前提としている。

## 4. モジュール構成(変更分)

| ファイル | v0.3.6での変更 |
|---|---|
| `js/map_config.js` | `writeMapConfigFiles()`へ保存後の再読み込み検証を追加 |
| `js/storage.js` | JSON形式を廃止し、プレーンテキスト(1行1Waypoint)形式へ全面書き換え |
| `js/ini_parser.js` | `ensureWaypointManagerSection()`のDatabaseFile値を新ファイル名に修正 |
| `js/file_manager.js` | `pickOpenTextFile`/`pickSaveTextFile`を追加、`pickOrCreateJsonFile`を削除 |
| `js/app.js` | My Storageの読込/保存/自動保存をテキスト形式へ切替。Category関連のUI配線をLocation Library専用に縮小 |
| `index.html` | GameUserSettings.ini / My Storage / Waypoint LogのCategoryフィルターを削除。Add/EditモーダルのCategory欄にIDを付与(表示切替用) |

`waypoint.js` / `waypoint_list.js` / `location_library.js` /
`coordinate_converter.js` / `map_calibration.js` / `mark_icon.js` /
`waypoint_icon.js` / `settings_store.js` / `css/style.css` は、
今回の差分に関係する箇所以外は変更していない。

## 5. 今回実装しない機能

(Map Viewer本体は v0.3.7 で実装済み。`js/map_viewer.js` が担当し、外部ライブラリを使わずDOM/CSS transformで描画する。Grid表示も含む)


- Community Library(保留中)
