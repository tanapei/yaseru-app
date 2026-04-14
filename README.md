# YASERU

スマホ向けの 1 画面完結ダイエット管理アプリです。

## できること

- いつまでに何kg痩せるかを最初に設定
- 食事、運動、睡眠、体重をすばやく記録
- 今日の達成率を一目で確認
- 直近 7 日の履歴を確認
- `localStorage` 保存でサインイン不要

## 画面の考え方

- ホームはスクロールなしで主要情報が見える
- 日次入力はすべてモーダルで完結
- モバイルファーストで設計

## ローカルで開く

`index.html` をそのままブラウザで開けます。

## GitHub Pages で公開する

このリポジトリには `.github/workflows/deploy-pages.yml` を含めています。

1. `main` に push する
2. GitHub の `Settings > Pages` で `Build and deployment` の `Source` を `GitHub Actions` にする
3. Actions のデプロイ完了後、公開 URL を開く

想定 URL:

`https://tanapei.github.io/yaseru-app/`

※ リポジトリが private のままだと、GitHub のプランや設定によって Pages 公開に制約が出る場合があります。必要に応じて public 化してください。
