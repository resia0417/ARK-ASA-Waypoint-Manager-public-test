# ARK ASA Waypoint Manager Web (v0.8.6)

ARK: Survival Ascended のWaypoint(マップに打ったマーカー)を、ブラウザでまとめて編集できるツールです。

ゲーム内で1つずつ編集するのは大変なので、PCのブラウザで一覧と地図を見ながら、追加・編集・削除できるようにしました。インストールは不要で、ファイルがPCの外に送信されることもありません。

**▶ 使ってみる: https://resia0417.github.io/ARK-ASA-Waypoint-Manager-public-test/**

## 使い方

1. Chrome か Edge でこのツールを開く
2. 左側「GameUserSettings.ini」の Read ボタンから、ARKの `GameUserSettings.ini` を選ぶ
   - 場所の目安: ARKのインストールフォルダ → `ShooterGame/Saved/Config/Windows/GameUserSettings.ini`
3. Waypointの一覧と地図が表示されるので、追加・編集・削除する
4. 終わったら Save ボタンでファイルに書き戻す

※ ゲームを起動したまま編集すると、ゲーム終了時にファイルが上書きされて、編集が消えてしまうことがあります。ゲームを閉じてから編集してください。
※ 心配な場合は、編集前に `GameUserSettings.ini` のコピーを取っておくと安心です。

## できること

- Waypointの一覧表示と地図表示(公式11マップ対応、Genesis Part 1 にも対応)
- Waypointの追加・編集・削除(アイコンや色も、ゲーム内と同じものが選べます)
- 名前で検索
- リストの間でのドラッグ&ドロップによる移動
- 「My Storage」: 自分用のWaypoint集を別ファイルに保存して使い回せます(使い始めは、空の `.txt` ファイルを用意して Read で開いてください)
- 「Location Library」: オベリスク、アーティファクト洞窟、エクスプローラーノートなど、有名な場所のWaypointが最初から入っています。自分のINIやMy Storageへドラッグ&ドロップでコピーして使えます(収録データはASA版の情報がもとになっています)
- 前回開いたファイルは、次に開いたとき自動で読み込み直せます

## 注意

- 使えるブラウザは Chrome と Edge です(Firefox / Safari では動きません)。スマートフォンでは使えません
- 編集していないWaypointや、Waypoint以外のゲーム設定が書き換わることはありません
- 上書きする直前の内容は、ブラウザの中に自動で控えが残ります

## 今後の予定

- ルート表示と距離測定
- Community Library

## ライセンス

本プロジェクトは [MIT License](./LICENSE) の下で公開されています。

---

## 地図画像について

地図画像は、れしあがゲーム内で撮影・合成したものです。ARK: Survival Ascended © Studio Wildcard. 本ツールは非公式のファンワークです。
