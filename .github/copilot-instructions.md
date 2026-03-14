Wikidot Preview
====

VSCode拡張。Wikidot(.wd/.wikidot)ファイルに対して以下の機能を提供します。
- シンタックスハイライト
- プレビュー

## フォルダ構成
- src 拡張機能のソースコード
- syntaxes TextMate形式のシンタックス定義
- worker/ web worker関連（空ディレクトリ、実体は src/webview/wikidot.web.worker.ts）
- scripts/ viteビルド設定
- dist/ コンパイル後の拡張機能本体
- dist_prebuild/ コンパイル後のworker（client.tsからrawインポートされる）
- webview_dist/ コンパイル後のwebviewクライアント

## ビルド
```
pnpm run compile
```
compile:yaml → compile:worker → compile:client → compile:vite の順で実行される。
型チェックのみ: `pnpm run tsc`

## アーキテクチャ

### プレビューのデータフロー
```
VSCode拡張(src/) → WebviewPanel → client.ts(webview) → Web Worker(wikidot.web.worker.ts)
```

- **src/components/source.ts** `serveBackend()`: ソースをパースしてwebviewにpostMessage
- **src/webview/client.ts**: webviewのエントリポイント。拡張↔workerのメッセージ中継も担う
- **src/webview/wikidot.web.worker.ts**: @wdprlib/parserでパース・レンダリングを実行
- **src/components/listeners.ts**: ドキュメント変更・タブ切替のイベントリスナー。`setListeners()`は新規パネルと復元パネル両方から呼ばれる
- **src/components/preview.ts**: パネル生成。`onDidReceiveMessage`はpreview.tsではなくlisteners.tsの`setListeners()`内で設定すること（復元パネルにも適用されるため）

### include解決の仕組み（遅延ロード）
workerがincludeに遭遇すると、必要なファイルだけをworker→client→拡張の経路で都度取得する。

メッセージプロトコル:
1. worker → client: `{ type: 'fetch-include', page: string, requestId: string }`
2. client → 拡張: `vscode.postMessage({ type: 'fetch-include', page, requestId })`
3. 拡張 → client: `panel.webview.postMessage({ type: 'include-result', requestId, content: string | null })`
4. client → worker: `worker.postMessage({ type: 'include-result', requestId, content })`

`readSingleInclude(fileUri, pageName)` in source.ts が実際のファイル読み取りを担当（.wd/.wikidot を順に試みる）。ネストしたincludeは iterative に収集・解決する。

### panelInfo（idToInfo）
各プレビューパネルのメタ情報（id, fileName, viewColumn, content）を管理するMap。`fileName`はフルパス文字列。現在編集中ファイルのURIが必要な場合は `vscode.Uri.file(panelInfo.fileName)` で復元できる。

## 主要ライブラリ
- `@wdprlib/parser`: Wikidotソースのパース・include解決（`resolveIncludes`コールバックは同期のみ）
- `@wdprlib/render`: HTML生成
- `@wdprlib/runtime`: webview側のランタイム（折りたたみブロック等のインタラクション）