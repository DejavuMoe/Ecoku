# Plain HTML

Each page needs its own container and a stable page key. `pageKey` must be an in-site relative path — not an absolute URL, not a query string.

```html
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://comments.example.com"
  data-site-id="blog"
  data-page-key="/posts/example/"
  data-page-title="Example post"
  data-page-size="10"
  data-theme="auto"
>
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>重新加载评论</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://comments.example.com/client/ecoku-loader.js" defer></script>
```

The loader requires `data-ecoku-*` on the shell, mount, loader, status, and retry control. Canonical ids are `ecoku-comments` and `ecoku-mount`. Legacy `#tcomment` still works; do not use it on new sites.

No loading spinner copy is shown; failures surface status plus retry. An unconfigured site renders “评论服务尚未配置.”

Do not embed admin tokens or management keys. Challenge config arrives in public `formConfig`.

## CSS

The SDK injects styles by default. `data-css-url` disables injection:

- `/client/ecoku.css` — same as the default inject
- `/client/ecoku.unstyled.css` — structure only
- `none` — bring your own

Optional `data-js-url` replaces the loader. Custom CSS applies only to the comment UI.

The snippet above is the complete example; copy it and replace the site parameters. Host CSP: [FAQ](/en/self-hosting/faq#host-csp).
