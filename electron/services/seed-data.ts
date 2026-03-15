import { getDb } from './database'
import crypto from 'crypto'

export async function seedSampleData(): Promise<void> {
  const db = getDb()

  // Guard: only seed if no projects exist
  const { cnt } = db.prepare('SELECT COUNT(*) as cnt FROM projects').get() as { cnt: number }
  if (cnt > 0) {
    console.log('[seed] Projects exist, skipping seed data')
    return
  }

  console.log('[seed] No projects found, inserting sample data...')

  // Pre-generate all UUIDs for referential integrity
  const ids = {
    project: crypto.randomUUID(),
    // Papers (5)
    paper1: crypto.randomUUID(),
    paper2: crypto.randomUUID(),
    paper3: crypto.randomUUID(),
    paper4: crypto.randomUUID(),
    paper5: crypto.randomUUID(),
    // Paper relations (4)
    paperRel1: crypto.randomUUID(),
    paperRel2: crypto.randomUUID(),
    paperRel3: crypto.randomUUID(),
    paperRel4: crypto.randomUUID(),
    // Research questions (3)
    rq1: crypto.randomUUID(),
    rq2: crypto.randomUUID(),
    rq3: crypto.randomUUID(),
    // Hypotheses (2)
    hyp1: crypto.randomUUID(),
    hyp2: crypto.randomUUID(),
    // Experiments (2)
    exp1: crypto.randomUUID(),
    exp2: crypto.randomUUID(),
    // Datasets (1)
    dataset1: crypto.randomUUID(),
    // Documents (3)
    docPaper: crypto.randomUUID(),
    docPatent: crypto.randomUUID(),
    docReport: crypto.randomUUID(),
    // Patent claims (3)
    claim1: crypto.randomUUID(),
    claim2: crypto.randomUUID(),
    claim3: crypto.randomUUID(),
    // Canvas (1)
    canvas1: crypto.randomUUID(),
    // Improvement cycle (1)
    improvement1: crypto.randomUUID(),
    // Tasks (7)
    task1: crypto.randomUUID(),
    task2: crypto.randomUUID(),
    task3: crypto.randomUUID(),
    task4: crypto.randomUUID(),
    task5: crypto.randomUUID(),
    task6: crypto.randomUUID(),
    task7: crypto.randomUUID(),
    // Sprint (1)
    sprint1: crypto.randomUUID(),
    // Sprint tasks (4)
    sprintTask1: crypto.randomUUID(),
    sprintTask2: crypto.randomUUID(),
    sprintTask3: crypto.randomUUID(),
    sprintTask4: crypto.randomUUID(),
    // KG entities (8)
    ent1: crypto.randomUUID(),
    ent2: crypto.randomUUID(),
    ent3: crypto.randomUUID(),
    ent4: crypto.randomUUID(),
    ent5: crypto.randomUUID(),
    ent6: crypto.randomUUID(),
    ent7: crypto.randomUUID(),
    ent8: crypto.randomUUID(),
    // KG relations (8)
    kgRel1: crypto.randomUUID(),
    kgRel2: crypto.randomUUID(),
    kgRel3: crypto.randomUUID(),
    kgRel4: crypto.randomUUID(),
    kgRel5: crypto.randomUUID(),
    kgRel6: crypto.randomUUID(),
    kgRel7: crypto.randomUUID(),
    kgRel8: crypto.randomUUID(),
    // Custom skill (1)
    skill1: crypto.randomUUID()
  }

  const now = new Date().toISOString()

  const seedTransaction = db.transaction(() => {
    // ========================================
    // 1. Project
    // ========================================
    db.prepare(`INSERT INTO projects (id, name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      ids.project,
      '深層学習を用いた医用画像診断の精度向上',
      '本プロジェクトでは、深層学習（Deep Learning）技術を活用して、胸部X線画像やCTスキャンなどの医用画像における疾患検出の精度向上を目指します。ResNet、U-Net、Vision Transformerなどの最新アーキテクチャを比較検証し、転移学習やデータ拡張手法の有効性を評価します。最終的に、臨床現場で実用可能なAI支援診断システムの構築を目標としています。',
      'active',
      now,
      now
    )

    // ========================================
    // 2. Papers (Literature Explorer)
    // ========================================
    const insertPaper = db.prepare(`INSERT INTO papers (id, project_id, title, authors, abstract, doi, url, year, citation_count, source, notes, tags, status, rating, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)

    insertPaper.run(
      ids.paper1, ids.project,
      '深層学習による胸部X線画像の異常検出：大規模データセットを用いた評価',
      JSON.stringify(['田中太郎', '鈴木花子', 'John Smith']),
      '本研究では、100,000枚以上の胸部X線画像を用いて深層学習モデルによる異常検出の性能を評価した。提案手法はResNet-50をベースとし、マルチラベル分類により14種類の胸部疾患を同時に検出する。実験の結果、平均AUC 0.92を達成し、放射線科医の診断精度に匹敵する性能を示した。',
      '10.1234/medimg.2023.001',
      null, 2023, 156, 'semantic_scholar',
      'ベースラインとして重要な論文。データセットの構築方法とマルチラベル分類のアプローチが参考になる。',
      JSON.stringify(['deep-learning', 'chest-x-ray', 'multi-label']),
      'reviewed', 5, now, now
    )

    insertPaper.run(
      ids.paper2, ids.project,
      'U-Net改良型アーキテクチャによるCTスキャンセグメンテーション',
      JSON.stringify(['佐藤一郎', 'Maria Garcia', '山田次郎']),
      'Attention機構を導入したU-Net改良型アーキテクチャを提案し、肺CTスキャンにおける腫瘍領域のセグメンテーション精度を向上させた。提案手法はDice係数0.89を達成し、従来のU-Netと比較して5.3%の改善を実現した。',
      '10.1234/medimg.2022.045',
      null, 2022, 89, 'pubmed',
      'セグメンテーションタスクの参考文献。Attention U-Netの実装詳細が有用。',
      JSON.stringify(['u-net', 'segmentation', 'ct-scan', 'attention']),
      'read', 4, now, now
    )

    insertPaper.run(
      ids.paper3, ids.project,
      'Vision Transformerの医用画像分類への適用：包括的レビュー',
      JSON.stringify(['Chen Wei', '木村美咲', 'Park Joon']),
      'Vision Transformer（ViT）の医用画像分類への適用に関する包括的なレビューを行った。2020年以降の120編の関連論文を体系的に分析し、ViTが特にデータ量が豊富な場合にCNNを上回る性能を示すことを確認した。一方で、小規模データセットでの課題や計算コストについても考察した。',
      '10.1234/medimg.2024.012',
      null, 2024, 34, 'arxiv',
      'ViTの医用画像への適用可能性を検討する上で必読。今後の研究方向性の参考。',
      JSON.stringify(['vision-transformer', 'review', 'classification']),
      'reading', 4, now, now
    )

    insertPaper.run(
      ids.paper4, ids.project,
      '転移学習を用いた少数サンプルでの病変検出',
      JSON.stringify(['李明', '高橋健太', 'Sarah Johnson']),
      'ImageNetで事前学習したモデルを医用画像の病変検出に転移学習する手法を提案した。わずか200枚の学習データでも、スクラッチから学習した場合と比較してF1スコアが23%向上することを示した。特にEfficientNetをバックボーンとした場合に最良の結果を得た。',
      '10.1234/medimg.2023.078',
      null, 2023, 67, 'crossref',
      '少数データでの学習に関する重要な知見。転移学習の有効性を実証。',
      JSON.stringify(['transfer-learning', 'few-shot', 'lesion-detection']),
      'reviewed', 3, now, now
    )

    insertPaper.run(
      ids.paper5, ids.project,
      '説明可能なAIによる医用画像診断の信頼性向上',
      JSON.stringify(['Anderson Brown', '中村優子', 'Kim Soo-jin']),
      'Grad-CAMおよびSHAPを用いた説明可能なAI手法を医用画像診断システムに統合し、モデルの判断根拠を可視化するフレームワークを提案した。40名の放射線科医を対象としたユーザスタディにより、説明可能性の提示が診断信頼度を15%向上させることを確認した。',
      '10.1234/medimg.2024.033',
      null, 2024, 12, 'semantic_scholar',
      '未読。説明可能AIの実装方法について今後確認予定。',
      JSON.stringify(['explainable-ai', 'grad-cam', 'trust']),
      'unread', null, now, now
    )

    // Paper relations
    const insertPaperRel = db.prepare(`INSERT INTO paper_relations (id, source_paper_id, target_paper_id, relation_type, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    insertPaperRel.run(ids.paperRel1, ids.paper2, ids.paper1, 'cites', 'U-Netの論文がResNetベースの異常検出を引用', now)
    insertPaperRel.run(ids.paperRel2, ids.paper3, ids.paper2, 'extends', 'ViTレビューがU-Netとの性能比較を実施', now)
    insertPaperRel.run(ids.paperRel3, ids.paper4, ids.paper1, 'supports', '転移学習の論文がResNetの有効性を支持', now)
    insertPaperRel.run(ids.paperRel4, ids.paper5, ids.paper3, 'related', '説明可能AIとViTの関連性', now)

    // ========================================
    // 3. Research Questions
    // ========================================
    const insertRQ = db.prepare(`INSERT INTO research_questions (id, project_id, question, type, status, answer, evidence_summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)

    insertRQ.run(
      ids.rq1, ids.project,
      '深層学習モデル（ResNet-50）は従来の画像診断手法（SVM＋手動特徴量）と比較して、胸部X線画像における肺疾患の検出精度（AUC）をどの程度向上させるか？',
      'primary', 'investigating',
      null,
      '先行研究では、深層学習モデルが従来手法を5〜15%上回るAUCを達成していることが報告されている（Paper 1, Paper 4）。ただし、データセットの規模や疾患の種類により結果にばらつきがある。',
      now, now
    )

    insertRQ.run(
      ids.rq2, ids.project,
      '転移学習（ImageNet事前学習）は、医用画像データが500枚以下の小規模データセットにおいて、モデルの汎化性能をどの程度改善するか？',
      'secondary', 'open',
      null,
      null,
      now, now
    )

    insertRQ.run(
      ids.rq3, ids.project,
      '説明可能なAI技術（Grad-CAM等）は、医師の深層学習モデルに対する信頼度および診断プロセスにどのような影響を与えるか？',
      'exploratory', 'open',
      null,
      null,
      now, now
    )

    // ========================================
    // 4. Hypotheses
    // ========================================
    const insertHyp = db.prepare(`INSERT INTO hypotheses (id, project_id, question_id, title, description, null_hypothesis, alt_hypothesis, status, evidence, confidence, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)

    insertHyp.run(
      ids.hyp1, ids.project, ids.rq1,
      'ResNet-50ベースモデルは胸部X線画像の肺炎検出においてAUC 0.95以上を達成する',
      'ImageNetで事前学習したResNet-50をファインチューニングし、胸部X線画像データセット（ChestX-ray14）で肺炎検出を行う。データ拡張（回転、反転、コントラスト調整）を適用し、5-fold交差検証で評価する。',
      'ResNet-50ベースモデルのAUCは、従来のSVM＋HOG特徴量ベースの手法のAUCと統計的に有意な差がない（p > 0.05）',
      'ResNet-50ベースモデルのAUCは、従来のSVM＋HOG特徴量ベースの手法のAUCよりも統計的に有意に高い（p < 0.05）',
      'testing',
      '中間結果: 3-fold目まで完了。暫定AUC = 0.937（従来手法: 0.856）。残り2-foldの結果を待って最終評価を行う。',
      0.78,
      now, now
    )

    insertHyp.run(
      ids.hyp2, ids.project, ids.rq2,
      'ImageNet事前学習モデルは500枚以下の医用画像でも80%以上の分類精度を達成する',
      'EfficientNet-B4をImageNetで事前学習した重みで初期化し、100/200/300/500枚の医用画像でファインチューニングを行う。各データサイズでの分類精度を比較し、転移学習の効果を定量的に評価する。',
      '転移学習モデルの分類精度は、スクラッチ学習モデルの精度と統計的に有意な差がない',
      '転移学習モデルの分類精度は、スクラッチ学習モデルよりも統計的に有意に高い',
      'proposed',
      null,
      0.65,
      now, now
    )

    // ========================================
    // 5. Experiments
    // ========================================
    const insertExp = db.prepare(`INSERT INTO experiments (id, project_id, hypothesis_id, title, description, methodology, variables, status, results, conclusion, started_at, completed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)

    insertExp.run(
      ids.exp1, ids.project, ids.hyp1,
      'ResNet-50による胸部X線画像分類実験',
      'ChestX-ray14データセット（112,120枚）を使用し、ResNet-50の肺炎検出性能を評価する。5-fold交差検証により、AUC・感度・特異度を測定する。',
      '1. データ前処理: 画像を224x224にリサイズ、正規化\n2. データ拡張: ランダム回転(±15°)、水平反転、コントラスト調整\n3. モデル: ImageNet事前学習済みResNet-50、最終全結合層を置換\n4. 学習: Adam optimizer, lr=1e-4, batch_size=32, epochs=50\n5. 評価: 5-fold交差検証、ROC-AUC, 感度, 特異度',
      JSON.stringify({
        independent: ['モデルアーキテクチャ（ResNet-50 vs SVM+HOG）', '学習率（1e-3, 1e-4, 1e-5）'],
        dependent: ['AUC', '感度（Sensitivity）', '特異度（Specificity）', '処理時間'],
        control: ['データセット（ChestX-ray14）', '画像解像度（224x224）', 'データ分割比率（80:20）']
      }),
      'in_progress',
      '中間結果（3-fold完了時点）:\n- 平均AUC: 0.937 (±0.012)\n- 感度: 0.891 (±0.023)\n- 特異度: 0.934 (±0.015)\n- 従来手法（SVM+HOG）AUC: 0.856',
      null,
      '2025-03-10',
      null,
      now, now
    )

    insertExp.run(
      ids.exp2, ids.project, ids.hyp2,
      '転移学習の少数データ有効性検証実験',
      'ImageNet事前学習済みEfficientNet-B4を使用し、異なるデータサイズ（100/200/300/500枚）での分類精度を比較する。スクラッチ学習との性能差を定量的に評価する。',
      '1. データセット: 肺炎X線画像からランダムサンプリング\n2. データサイズ: 100, 200, 300, 500枚の4条件\n3. 比較条件: 転移学習 vs スクラッチ学習\n4. 各条件で3回の独立した試行を実施\n5. 評価指標: 精度（Accuracy）、F1スコア、AUC',
      JSON.stringify({
        independent: ['データサイズ（100/200/300/500）', '学習方式（転移学習/スクラッチ）'],
        dependent: ['精度（Accuracy）', 'F1スコア', 'AUC'],
        control: ['モデル（EfficientNet-B4）', 'エポック数（30）', '最適化手法（Adam）']
      }),
      'planned',
      null,
      null,
      null,
      null,
      now, now
    )

    // ========================================
    // 6. Datasets (Data Analyzer)
    // ========================================
    db.prepare(`INSERT INTO datasets (id, project_id, experiment_id, name, description, file_path, file_type, row_count, column_names, summary_stats, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      ids.dataset1, ids.project, ids.exp1,
      '胸部X線画像分類結果データ（3-fold中間結果）',
      'ResNet-50による胸部X線画像分類実験の中間結果データ。3-fold交差検証の各サンプルに対する予測スコアと真のラベルを含む。',
      null, 'csv', 200,
      JSON.stringify(['patient_id', 'age', 'gender', 'prediction_score', 'true_label', 'predicted_label', 'confidence', 'processing_time_ms']),
      JSON.stringify({
        age: { mean: 54.3, median: 56, stdDev: 16.2, min: 18, max: 89, q1: 42, q3: 67 },
        prediction_score: { mean: 0.72, median: 0.78, stdDev: 0.24, min: 0.03, max: 0.99, q1: 0.55, q3: 0.93 },
        confidence: { mean: 0.85, median: 0.89, stdDev: 0.12, min: 0.51, max: 0.99, q1: 0.78, q3: 0.95 },
        processing_time_ms: { mean: 45.2, median: 43.0, stdDev: 8.7, min: 28, max: 78, q1: 39, q3: 50 }
      }),
      now, now
    )

    // ========================================
    // 7. Improvement Cycle (Improvement Advisor)
    // ========================================
    db.prepare(`INSERT INTO improvement_cycles (id, project_id, title, cycle_type, plan, do_actions, check_results, act_improvements, status, started_at, completed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      ids.improvement1, ids.project,
      'モデル精度向上のためのデータ拡張戦略改善',
      'pdca',
      '【計画】\n現在のデータ拡張は基本的な幾何変換（回転・反転）のみで、モデルの汎化性能に限界がある。以下の拡張手法を追加導入する:\n1. Mixup: 2つの画像とラベルを線形補間\n2. CutMix: 画像の一部を別画像で置換\n3. Random Erasing: 画像の一部をランダムに消去\n4. 色調変換: 輝度・コントラスト・ガンマの変動\n\n目標: AUCを現在の0.937から0.95以上に向上',
      '【実行内容】\n1. Mixup (alpha=0.2) を実装し、学習パイプラインに統合\n2. CutMix (beta=1.0) を実装\n3. Random Erasing (p=0.5) を追加\n4. ColorJitter (brightness=0.2, contrast=0.2) を追加\n5. 各手法の組み合わせを含む8パターンの実験を設計',
      '【中間確認結果】\n- Mixupのみ: AUC 0.941 (+0.004)\n- CutMix のみ: AUC 0.939 (+0.002)\n- Mixup + Random Erasing: AUC 0.948 (+0.011) ★最良\n- 全手法組み合わせ: AUC 0.943（過剰拡張の可能性）\n\nMixup + Random Erasingの組み合わせが最も効果的。全手法の同時適用は逆効果の可能性あり。',
      null,
      'check',
      '2025-03-01',
      null,
      now, now
    )

    // ========================================
    // 8. Canvas (Research Canvas)
    // ========================================
    const canvasNodes = [
      { id: 'node-1', type: 'default', position: { x: 50, y: 200 }, data: { label: '研究課題定義\n医用画像×深層学習' } },
      { id: 'node-2', type: 'default', position: { x: 300, y: 50 }, data: { label: '文献調査\n先行研究120件レビュー' } },
      { id: 'node-3', type: 'default', position: { x: 300, y: 350 }, data: { label: 'データ収集\nChestX-ray14' } },
      { id: 'node-4', type: 'default', position: { x: 600, y: 200 }, data: { label: 'モデル設計\nResNet-50 + 転移学習' } },
      { id: 'node-5', type: 'default', position: { x: 900, y: 200 }, data: { label: '実験・評価\n5-fold CV, AUC測定' } },
      { id: 'node-6', type: 'default', position: { x: 1200, y: 200 }, data: { label: '論文執筆・特許出願' } }
    ]
    const canvasEdges = [
      { id: 'edge-1', source: 'node-1', target: 'node-2', type: 'default' },
      { id: 'edge-2', source: 'node-1', target: 'node-3', type: 'default' },
      { id: 'edge-3', source: 'node-2', target: 'node-4', type: 'default' },
      { id: 'edge-4', source: 'node-3', target: 'node-4', type: 'default' },
      { id: 'edge-5', source: 'node-4', target: 'node-5', type: 'default' },
      { id: 'edge-6', source: 'node-5', target: 'node-6', type: 'default' }
    ]

    db.prepare(`INSERT INTO canvas_states (id, project_id, name, nodes, edges, viewport, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      ids.canvas1, ids.project,
      '研究全体ワークフロー',
      JSON.stringify(canvasNodes),
      JSON.stringify(canvasEdges),
      JSON.stringify({ x: 0, y: 0, zoom: 0.85 }),
      now, now
    )

    // ========================================
    // 9. Documents - Paper (Document Studio)
    // ========================================
    const paperContent = `<h1>深層学習を用いた胸部X線画像診断の精度向上に関する研究</h1>

<h2>1. はじめに（Introduction）</h2>
<p>胸部X線画像は、肺疾患のスクリーニングに最も広く使用される医用画像モダリティの一つである。しかし、画像の読影には高度な専門知識と経験が必要であり、読影医の不足が世界的な課題となっている。近年、深層学習技術の飛躍的な発展により、コンピュータ支援診断（CAD）システムの性能が大幅に向上している。</p>
<p>本研究では、ResNet-50をベースとした深層学習モデルを用いて、胸部X線画像における肺疾患の自動検出システムを構築し、その診断精度を従来手法と比較評価する。</p>

<h2>2. 方法（Methods）</h2>
<p>本研究では、公開データセットChestX-ray14（112,120枚の胸部X線画像）を使用した。ImageNetで事前学習したResNet-50の最終全結合層を14クラスの疾患分類層に置換し、ファインチューニングを行った。データ拡張として、ランダム回転、水平反転、コントラスト調整を適用した。</p>
<p>評価は5-fold交差検証により行い、ROC曲線下面積（AUC）、感度、特異度を主要評価指標とした。比較対象として、SVM＋HOG特徴量による従来手法を実装した。</p>

<h2>3. 結果（Results）</h2>
<p>【実験進行中 - 中間結果を記載予定】</p>
<p>3-fold目までの中間結果では、提案手法（ResNet-50）の平均AUCは0.937（±0.012）であり、従来手法（SVM+HOG）のAUC 0.856を大幅に上回った。</p>

<h2>4. 考察（Discussion）</h2>
<p>【実験完了後に記載予定】</p>

<h2>5. 結論（Conclusion）</h2>
<p>【実験完了後に記載予定】</p>`

    db.prepare(`INSERT INTO documents (id, project_id, title, type, content, template, version, status, word_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      ids.docPaper, ids.project,
      '深層学習を用いた胸部X線画像診断の精度向上に関する研究',
      'paper', paperContent, 'imrad', 1, 'draft', 520, now, now
    )

    // ========================================
    // 10. Documents - Patent (Patent Studio)
    // ========================================
    const patentContent = `<h1>医用画像診断支援システム及び方法</h1>

<h2>【技術分野】</h2>
<p>本発明は、深層学習を用いた医用画像の自動診断支援技術に関し、特に胸部X線画像から肺疾患を高精度に検出するシステム及び方法に関する。</p>

<h2>【背景技術】</h2>
<p>従来の医用画像診断支援システムは、手動で設計された特徴量（エッジ検出、テクスチャ特徴等）に基づく機械学習手法を使用していた。しかし、これらの手法は特徴量設計に専門知識を要し、複雑な画像パターンの認識に限界があった。</p>

<h2>【発明が解決しようとする課題】</h2>
<p>本発明は、深層学習モデルを活用することにより、従来手法の課題を解決し、高精度かつ効率的な医用画像診断支援を実現することを目的とする。</p>

<h2>【発明の詳細な説明】</h2>
<p>本発明のシステムは、事前学習済み深層学習モデルに転移学習を適用し、少数の医用画像データからでも高精度な疾患検出を可能にする。さらに、Grad-CAMによる判断根拠の可視化機能を備え、医師がモデルの出力を信頼して利用できる環境を提供する。</p>`

    db.prepare(`INSERT INTO documents (id, project_id, title, type, content, template, version, status, word_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      ids.docPatent, ids.project,
      '医用画像診断支援システム及び方法',
      'patent', patentContent, 'jp-patent', 1, 'draft', 350, now, now
    )

    // Patent claims
    const insertClaim = db.prepare(`INSERT INTO patent_claims (id, project_id, document_id, claim_number, claim_type, parent_claim_id, claim_text, status, prior_art_notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)

    insertClaim.run(
      ids.claim1, ids.project, ids.docPatent,
      1, 'independent', null,
      '医用画像を入力として受け付ける入力部と、前記医用画像に対して事前学習済み深層学習モデルによる特徴抽出を行う特徴抽出部と、前記抽出された特徴に基づいて疾患の有無及び種類を判定する判定部と、前記判定の根拠となる画像領域を可視化する説明生成部と、を備えることを特徴とする医用画像診断支援システム。',
      'draft',
      '先行技術: 特開2020-XXXXXX（CADシステム）- 説明生成部を含まない点で差別化可能',
      now, now
    )

    insertClaim.run(
      ids.claim2, ids.project, ids.docPatent,
      2, 'dependent', ids.claim1,
      '前記深層学習モデルは、ImageNetデータセットで事前学習されたResNetアーキテクチャをベースとし、医用画像データセットでファインチューニングされたものであることを特徴とする、請求項1に記載の医用画像診断支援システム。',
      'draft', null, now, now
    )

    insertClaim.run(
      ids.claim3, ids.project, ids.docPatent,
      3, 'dependent', ids.claim1,
      '前記特徴抽出部は、入力された医用画像に対してMixup法及びRandom Erasing法によるデータ拡張を適用した学習データを用いて訓練されたモデルを使用することを特徴とする、請求項1に記載の医用画像診断支援システム。',
      'draft', null, now, now
    )

    // ========================================
    // 11. Documents - Report (Report Studio)
    // ========================================
    const reportContent = `<h1>研究進捗報告書 - 第1四半期（2025年1月〜3月）</h1>

<h2>1. エグゼクティブサマリー</h2>
<p>深層学習を用いた医用画像診断精度向上プロジェクトの第1四半期進捗を報告する。文献調査、データセット準備、ベースラインモデル構築を予定通り完了し、主実験（ResNet-50による分類実験）を開始した。中間結果ではAUC 0.937を達成しており、目標値0.95に向けて順調に進捗している。</p>

<h2>2. 完了タスク</h2>
<ul>
<li>関連論文120件のレビュー完了（1月）</li>
<li>ChestX-ray14データセットの取得・前処理完了（2月）</li>
<li>SVM+HOGベースラインモデルの構築・評価完了（3月前半）</li>
<li>ResNet-50モデルの実装開始（3月）</li>
</ul>

<h2>3. 進行中のタスク</h2>
<ul>
<li>5-fold交差検証の実行（3/5完了）</li>
<li>データ拡張戦略の改善（PDCAサイクル実施中）</li>
</ul>

<h2>4. 課題とリスク</h2>
<ul>
<li>GPU計算資源の不足による実験遅延リスク（中）</li>
<li>一部疾患カテゴリでのデータ不均衡（低〜中）</li>
</ul>

<h2>5. 次四半期の計画</h2>
<p>4月中に全実験を完了し、5月から論文執筆と特許出願書類の作成に着手する予定。</p>`

    db.prepare(`INSERT INTO documents (id, project_id, title, type, content, template, version, status, word_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      ids.docReport, ids.project,
      '研究進捗報告書 - 第1四半期',
      'report', reportContent, 'progress', 1, 'draft', 380, now, now
    )

    // ========================================
    // 12. Sprint (Dev Process) — must be before tasks that reference sprint_id
    // ========================================
    db.prepare(`INSERT INTO sprints (id, project_id, name, goal, status, start_date, end_date, velocity, retrospective, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      ids.sprint1, ids.project,
      'スプリント1: モデル実装・実験フェーズ',
      'ResNet-50モデルの実装を完了し、5-fold交差検証の全実行を終える。データ拡張戦略の改善結果を反映し、目標AUC 0.95の達成を目指す。',
      'active',
      '2025-03-10', '2025-04-30',
      null, null,
      now, now
    )

    // ========================================
    // 13. Tasks (Timeline)
    // ========================================
    const insertTask = db.prepare(`INSERT INTO tasks (id, project_id, sprint_id, title, description, status, priority, assignee, due_date, start_date, end_date, estimated_hours, actual_hours, parent_task_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)

    insertTask.run(ids.task1, ids.project, null,
      '文献調査と先行研究分析', '医用画像×深層学習に関する先行研究を体系的にレビューし、研究ギャップを特定する',
      'done', 'high', '研究者A', '2025-01-31', '2025-01-06', '2025-01-31', 40, 45, null, 1, now, now)

    insertTask.run(ids.task2, ids.project, null,
      'データセット収集と前処理', 'ChestX-ray14データセットの取得、クリーニング、前処理パイプラインの構築',
      'done', 'high', '研究者A', '2025-02-28', '2025-02-01', '2025-02-28', 30, 28, null, 2, now, now)

    insertTask.run(ids.task3, ids.project, null,
      'ベースラインモデル構築', 'SVM＋HOG特徴量による従来手法のベースラインモデルを構築・評価',
      'done', 'medium', '研究者B', '2025-03-15', '2025-03-01', '2025-03-15', 20, 18, null, 3, now, now)

    insertTask.run(ids.task4, ids.project, ids.sprint1,
      'ResNet-50モデル実装とファインチューニング', 'ImageNet事前学習済みResNet-50の実装、ファインチューニング、ハイパーパラメータ調整',
      'in_progress', 'critical', '研究者A', '2025-04-10', '2025-03-10', '2025-04-10', 60, 30, null, 4, now, now)

    insertTask.run(ids.task5, ids.project, ids.sprint1,
      '実験実行と評価', '5-fold交差検証の完了、統計的検定、結果の分析・可視化',
      'todo', 'high', '研究者A', '2025-04-30', '2025-04-01', '2025-04-30', 40, null, null, 5, now, now)

    insertTask.run(ids.task6, ids.project, null,
      '論文執筆', 'IMRAD形式の研究論文の執筆、共著者レビュー、ジャーナル投稿',
      'todo', 'high', '研究者A', '2025-06-30', '2025-05-01', '2025-06-30', 80, null, null, 6, now, now)

    insertTask.run(ids.task7, ids.project, null,
      '特許出願書類作成', '医用画像診断支援システムの特許明細書・請求項の作成、弁理士との調整',
      'todo', 'medium', '研究者B', '2025-06-15', '2025-05-15', '2025-06-15', 40, null, null, 7, now, now)

    // Sprint tasks
    const insertSprintTask = db.prepare(`INSERT INTO sprint_tasks (id, sprint_id, task_id, story_points, created_at) VALUES (?, ?, ?, ?, ?)`)
    insertSprintTask.run(ids.sprintTask1, ids.sprint1, ids.task4, 8, now)
    insertSprintTask.run(ids.sprintTask2, ids.sprint1, ids.task5, 5, now)

    // ========================================
    // 14. Knowledge Graph
    // ========================================
    const insertEntity = db.prepare(`INSERT INTO kg_entities (id, project_id, name, entity_type, properties, source_id, source_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)

    insertEntity.run(ids.ent1, ids.project, '深層学習', 'concept',
      JSON.stringify({ description: '多層ニューラルネットワークによる機械学習手法', importance: 'high' }), null, null, now)
    insertEntity.run(ids.ent2, ids.project, 'ResNet-50', 'method',
      JSON.stringify({ description: '50層の残差結合ネットワーク', year: 2015 }), null, null, now)
    insertEntity.run(ids.ent3, ids.project, 'U-Net', 'method',
      JSON.stringify({ description: 'エンコーダ・デコーダ構造のセグメンテーションモデル', year: 2015 }), null, null, now)
    insertEntity.run(ids.ent4, ids.project, '胸部X線画像', 'dataset',
      JSON.stringify({ description: 'ChestX-ray14データセット', size: '112,120枚' }), null, null, now)
    insertEntity.run(ids.ent5, ids.project, '肺炎', 'concept',
      JSON.stringify({ description: '主要な検出対象疾患', icd10: 'J18' }), null, null, now)
    insertEntity.run(ids.ent6, ids.project, '転移学習', 'concept',
      JSON.stringify({ description: '事前学習した知識を別タスクに活用する手法' }), null, null, now)
    insertEntity.run(ids.ent7, ids.project, 'データ拡張', 'method',
      JSON.stringify({ description: '学習データを人工的に増やす手法', techniques: ['Mixup', 'CutMix', 'Random Erasing'] }), null, null, now)
    insertEntity.run(ids.ent8, ids.project, 'AUC', 'concept',
      JSON.stringify({ description: 'ROC曲線下面積。分類モデルの総合的な評価指標', range: '0-1' }), null, null, now)

    // KG Relations
    const insertKgRel = db.prepare(`INSERT INTO kg_relations (id, project_id, source_entity_id, target_entity_id, relation_type, properties, weight, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)

    insertKgRel.run(ids.kgRel1, ids.project, ids.ent1, ids.ent2, 'includes',
      JSON.stringify({ note: '深層学習の代表的なアーキテクチャ' }), 1.0, now)
    insertKgRel.run(ids.kgRel2, ids.project, ids.ent1, ids.ent3, 'includes',
      JSON.stringify({ note: 'セグメンテーション向けアーキテクチャ' }), 1.0, now)
    insertKgRel.run(ids.kgRel3, ids.project, ids.ent2, ids.ent4, 'applied_to',
      JSON.stringify({ note: '本研究の主要モデル→データセット' }), 0.9, now)
    insertKgRel.run(ids.kgRel4, ids.project, ids.ent4, ids.ent5, 'detects',
      JSON.stringify({ note: 'X線画像から肺炎を検出' }), 0.85, now)
    insertKgRel.run(ids.kgRel5, ids.project, ids.ent6, ids.ent2, 'improves',
      JSON.stringify({ note: 'ImageNet事前学習で性能向上' }), 0.8, now)
    insertKgRel.run(ids.kgRel6, ids.project, ids.ent7, ids.ent4, 'enhances',
      JSON.stringify({ note: 'データ拡張で学習データを増強' }), 0.75, now)
    insertKgRel.run(ids.kgRel7, ids.project, ids.ent8, ids.ent2, 'evaluates',
      JSON.stringify({ note: 'AUCでモデル性能を評価' }), 0.7, now)
    insertKgRel.run(ids.kgRel8, ids.project, ids.ent3, ids.ent4, 'applied_to',
      JSON.stringify({ note: 'セグメンテーションタスク' }), 0.8, now)

    // ========================================
    // 15. Custom Skill (Skill Workshop)
    // ========================================
    db.prepare(`INSERT INTO skills (id, name, description, icon, category, system_prompt, tools, enabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      ids.skill1,
      '医学論文レビューアシスタント',
      '医学研究論文の構造、方法論、統計分析をレビューし、改善提案を行うカスタムスキルです。CONSORT声明やSTROBEガイドラインに基づいた評価が可能です。',
      'Stethoscope',
      'custom',
      'あなたは医学研究論文のレビュー専門家です。以下の観点から論文を評価し、具体的な改善提案を行ってください：\n1. 研究デザインの妥当性（CONSORT/STROBEガイドライン準拠）\n2. 統計手法の適切性（サンプルサイズ、検定の選択、多重比較補正）\n3. 結果の解釈と考察の論理性\n4. 限界事項の記述の適切性\n5. 臨床的意義と一般化可能性',
      JSON.stringify([]),
      1, 0,
      now, now
    )
  })

  seedTransaction()
  console.log('[seed] Sample data seeded successfully')
}
