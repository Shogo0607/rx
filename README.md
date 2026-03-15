# RX - Research Transformation

AI を活用した研究ライフサイクル管理デスクトップアプリケーション

---

## 概要

RX は、文献探索から論文執筆まで、研究の全フェーズをプロジェクト単位で一元管理するデスクトップアプリケーションです。OpenAI API (GPT-4o 等) と連携し、仮説生成、ピアレビューシミュレーション、学術文書の執筆支援など、研究者に特化した AI アシスタント機能を提供します。

### 主な特長

- **研究ライフサイクル全体を網羅** - 文献調査、RQ策定、仮説生成、実験設計、データ分析、論文・特許・報告書執筆
- **AI 支援** - GPT-4o によるFunction Calling対応のスキル別AIアシスタント
- **複数学術データベース対応** - Semantic Scholar, CrossRef, arXiv, PubMed からの論文検索
- **統計解析** - t検定、ANOVA、相関分析、回帰分析などの統計手法をビルトイン
- **ドキュメント出力** - Word (DOCX), PDF, LaTeX, Markdown 形式でのエクスポート
- **ビジュアル研究マップ** - React Flow による概念マッピング、D3 による知識グラフ
- **プロジェクト管理** - ガントチャート、スプリント管理、WBS、カンバン
- **クロスプラットフォーム** - macOS, Windows, Linux 対応

---

## 必要環境

- **Node.js** 18 以上
- **npm** 9 以上
- **OpenAI API キー** ([platform.openai.com](https://platform.openai.com) で取得)

---

## インストール

```bash
# リポジトリのクローン
git clone <repository-url>
cd rx

# 依存関係のインストール
npm install
```

---

## 開発

```bash
# 開発サーバーの起動 (ホットリロード対応)
npm run dev
```

開発モードでは Vite のホットモジュールリプレースメント (HMR) が有効になり、ソースコードの変更が即座に反映されます。

### その他の開発コマンド

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | プロダクションビルド |
| `npm run preview` | ビルド結果のプレビュー |
| `npm run lint` | ESLint によるコード検査 |
| `npm run typecheck` | TypeScript 型チェック |
| `npm run test` | テスト実行 |
| `npm run test:watch` | テスト (ウォッチモード) |

---

## 初期設定

### OpenAI API キーの設定

1. アプリケーションを起動します
2. ヘッダー右側の**設定** (歯車アイコン) をクリックします
3. 「OpenAI API Key」欄に API キーを入力します
4. 必要に応じて「Default Model」を変更できます (デフォルト: `gpt-4o`)

> **カスタムエンドポイント**: OpenAI 互換の API (Azure OpenAI, ローカル LLM サーバー等) を使用する場合は、「Base URL」に独自のエンドポイントを設定してください。

---

## スキル一覧

RX は「スキル」と呼ばれる15個の専門モジュールで構成されています。左サイドバーのアイコンから各スキルに切り替えられます。

### 研究フェーズ (Research)

#### Dashboard
プロジェクト全体の概要を表示します。研究の進捗状況、最近のアクティビティ、各フェーズのステータスを一覧で確認できます。

#### Literature Explorer
複数の学術データベース (Semantic Scholar, CrossRef, arXiv, PubMed) から論文を横断検索できます。引用グラフの可視化、BibTeX のインポート/エクスポート、論文のタグ付け・注釈、引用フォーマット自動生成 (APA, IEEE, Chicago, MLA, Harvard, Vancouver) に対応しています。

#### Research Question
PICO、FINER、SPIDER、PEO の各フレームワークを使って、構造化されたリサーチクエスチョンを策定できます。AI が研究課題の具体性、新規性、実現可能性を評価します。

#### Hypothesis Lab
文献やデータに基づいて AI が仮説を生成・評価します。帰無仮説 (H0) と対立仮説 (H1) の策定、変数の特定、検証可能性のスコアリングを支援します。

#### Experiment Designer
RCT、準実験、観察研究、計算実験の設計を支援します。プロトコル生成、倫理チェックリスト、サンプルサイズ計算 (検出力分析)、統計手法の推奨を行います。

#### Research Canvas
React Flow ベースのビジュアルキャンバスで、研究概念間の関係をノードとエッジで表現します。概念マッピングやワークフローの可視化に利用できます。

### 分析 (Analysis)

#### Data Analyzer
CSV / Excel ファイルをインポートし、記述統計、推測統計 (t検定, ANOVA, 相関分析)、各種チャート (散布図, 棒グラフ, 箱ひげ図, 折れ線, 円グラフ, ヒストグラム) による可視化を行います。

#### Improvement Advisor
PDCA サイクルの追跡、品質チェックリスト (パス/注意/不合格)、バイアスリスク評価、改善ロードマップの優先順位付けを行います。AI による多角的ピアレビューシミュレーション (方法論、ドメイン、統計の3視点) も提供します。

#### Knowledge Graph
テキストからエンティティを抽出し、関係を推論してドメイン知識グラフを構築します。隠れた関連性の発見や知識の空白地帯の特定に活用できます。階層型、力指向、放射型の各レイアウトに対応。

### 執筆 (Writing)

#### Document Studio
TipTap ベースのリッチテキストエディタで、学術論文を執筆できます。数式 (KaTeX)、表、画像、コードブロックに対応。IMRAD 構造に沿ったセクション管理、学術的トーンの校正、引用管理を AI が支援します。IEEE、ACM、APA 各フォーマットに対応しています。

#### Patent Studio
AI が発明の説明から独立クレームと従属クレームを生成します。先行技術分析、明細書の構造化ドラフト作成、クレームチャートの生成に対応。日本特許形式と米国特許形式の両方をサポートしています。

#### Report Studio
進捗報告書、最終報告書、技術報告書、研究提案書、助成金申請書を生成します。プロジェクトのコンテキストから自動的にコンテンツを構成します。

### プロジェクト管理 (Management)

#### Timeline
ガントチャート (Frappe Gantt) でタスクの依存関係、マイルストーン、クリティカルパスを可視化します。AI がタスク期間の見積もり、ボトルネック検出、スケジュール最適化を支援します。

#### Dev Process
Design Science Research (DSR)、Agile Research、Stage-Gate、PDCA の各フレームワークを活用した研究プロジェクト管理を支援します。WBS の自動生成、スプリント計画、リスク評価を行います。

### カスタム

#### Skill Workshop
独自の AI スキルを作成できます。システムプロンプトとツール定義を設定し、研究に特化したカスタム AI アシスタントを構築できます。

---

## ドキュメントのエクスポート

Document Studio、Patent Studio、Report Studio で作成した文書は、以下の形式でエクスポートできます:

| 形式 | 説明 |
|------|------|
| **DOCX** | Microsoft Word 互換 (ヘッダー、フッター、ページ番号付き) |
| **PDF** | 印刷用ドキュメント (Helvetica フォント) |
| **LaTeX** | TeX 組版システム用ソース |
| **Markdown** | プレーンテキストベースのフォーマット |

---

## 配布用パッケージの作成

```bash
# 全プラットフォーム向け
npm run package

# macOS 向け (DMG, ZIP)
npm run package:mac

# Windows 向け (NSIS インストーラ)
npm run package:win

# Linux 向け (AppImage, deb)
npm run package:linux
```

成果物は `release/` ディレクトリに出力されます。

---

## データ保存場所

全てのプロジェクトデータは SQLite データベースにローカル保存されます:

| OS | パス |
|----|------|
| macOS | `~/Library/Application Support/rx/rx.db` |
| Windows | `%APPDATA%/rx/rx.db` |
| Linux | `~/.config/rx/rx.db` |

---

## 技術スタック

| 層 | 技術 |
|----|------|
| デスクトップフレームワーク | Electron 33 |
| フロントエンド | React 19, TypeScript, Tailwind CSS |
| 状態管理 | Zustand |
| UIコンポーネント | Radix UI, Lucide Icons |
| リッチエディタ | TipTap |
| グラフ可視化 | React Flow (@xyflow/react), D3 |
| チャート | Recharts |
| ガントチャート | Frappe Gantt |
| 数式表示 | KaTeX |
| データベース | SQLite (better-sqlite3) |
| AI連携 | OpenAI API (GPT-4o) |
| 文書生成 | docx (Word), pdfmake (PDF) |
| 統計計算 | simple-statistics, jstat |
| ビルドツール | Vite (electron-vite) |
| パッケージング | electron-builder |
| テスト | Vitest |

---

## プロジェクト構成

```
rx/
├── electron/          # Electron メインプロセス
│   ├── main.ts        # エントリポイント
│   ├── preload.ts     # IPC ブリッジ
│   ├── ipc/           # IPC ハンドラ
│   └── services/      # サービス層 (DB, LLM, 文献API, 統計, 文書生成)
├── src/               # React レンダラープロセス
│   ├── components/    # UIコンポーネント
│   ├── skills/        # 15個のスキルモジュール
│   ├── stores/        # Zustand 状態管理
│   ├── types/         # TypeScript 型定義
│   └── lib/           # ユーティリティ
├── index.html         # HTMLエントリ
└── package.json       # 依存関係・スクリプト
```

詳細な技術仕様は [specification.md](./specification.md) を参照してください。

---

## ライセンス

TBD
