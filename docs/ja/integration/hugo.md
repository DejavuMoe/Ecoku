# Hugo PaperMod への組み込み

Hugo PaperMod テーマに Ecoku コメント欄を統合します。

---

## テンプレートの上書き

`layouts/partials/comments.html` を作成します：

```html
{{- if (.Param "comments") | default true }}
<div class="ecoku-container" style="margin-top: 2rem;">
  <section
    id="ecoku-comments"
    class="ecoku-shell"
    data-ecoku-comments
    data-server-url="https://comments.example.com"
    data-site-id="blog"
    data-page-key="{{ .RelPermalink }}"
    data-page-title="{{ .Title }}"
    data-page-size="10"
    data-theme="auto"
  >
    <div class="ecoku-loader" data-ecoku-loader hidden>
      <p class="ecoku-loader-status" data-ecoku-status></p>
      <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>再読み込み</button>
    </div>
    <div id="ecoku-mount" data-ecoku-mount></div>
  </section>
  <script src="https://comments.example.com/client/ecoku-loader.js" defer></script>
</div>
{{- end }}
```
