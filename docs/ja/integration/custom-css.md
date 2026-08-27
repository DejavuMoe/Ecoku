# カスタム CSS

`data-css-url` / `css_url` 未設定時、SDK は既定のコメントスタイルをページに**インライン**します。サイトのデザインに合わせる、または見た目を完全に自前制御したいときだけ、このオプションを変えてください。

## 選択肢

| 値 | 動作 |
| --- | --- |
| 未設定 | SDK が既定スタイルをインライン |
| `/client/ecoku.css`（または絶対 URL） | 完全なスタイルシートを読み込み、既定のインラインはしない |
| `/client/ecoku.unstyled.css` | レイアウトのみ。色とフォントはサイト側 |
| `none` または `-` | Ecoku スタイルを読まない。`.ecoku-comments` はすべてサイト側 |

アドレスはルート相対または完全な `http(s)` URL で構いません。UMD で自分で `<link>` する場合、初期化で `cssURL: 'none'` が必須です。

## シェル用スタイル（任意）

次の CSS は読み込み前シェル、失敗状態、再試行ボタンだけに効き、コメント本文のスタイルの代わりにはなりません。

```css
.ecoku-shell {
  margin-top: 2.75rem;
  min-height: 8rem;
}

.ecoku-loader {
  padding: 1.25rem 0;
  color: var(--secondary);
}

.ecoku-loader-status {
  margin: 0;
}

.ecoku-loader-retry {
  margin-top: 0.75rem;
  padding: 0.55rem 0.9rem;
  border: 1px solid var(--tertiary);
  border-radius: 0.4rem;
  color: var(--primary);
  background: var(--entry);
  cursor: pointer;
  font: inherit;
}

.ecoku-loader-retry:hover {
  border-color: var(--secondary);
}

.ecoku-loader-retry:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 3px;
}

.ecoku-loader-retry[hidden],
.ecoku-loader[hidden] {
  display: none;
}

@media (max-width: 640px) {
  .ecoku-shell {
    margin-top: 2rem;
  }
}
```

`var(--primary)` などは PaperMod の変数です。他テーマでは自前の色に置き換えてください。

## 手順

1. 必要ならシェル CSS をテーマのスタイルに入れて公開する。
2. HTML で `data-css-url`、または Hugo で `css_url` を設定する。
3. `unstyled` では `.ecoku-comments` の色と枠を補い、`none` ではレイアウトも用意する。
4. ライト・ダーク・狭い画面・失敗再試行を確認する。

組み込み例は [汎用 HTML](/ja/integration/html) と [Hugo PaperMod](/ja/integration/hugo)。
