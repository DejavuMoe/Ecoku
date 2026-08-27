# Ecoku Smoji approved adjunct

This directory records the approved Smoji adjunct for per-site, remotely hosted
sticker packs. It adds only the picker controls and site configuration shown
here; it does not replace or otherwise revise the approved comment
(`index-v16.html`) or site-management (`index-v11.html`) baselines.

Review surfaces:

- `index.html` — root composer, lazy-loaded picker, rendered sticker, and inline reply;
- `admin.html` — per-site enable switch and `smoji.json` URL configuration;
- `architecture.md` — proposed data, loading, persistence, validation, and failure contracts;
- `smoji.json` and `fixtures/` — local, non-production fixture data used only by the prototype.

Preview from the repository root:

```text
python3 -m http.server 4311
```

Then open:

```text
http://127.0.0.1:4311/designs/smoji-candidate/index.html
http://127.0.0.1:4311/designs/smoji-candidate/admin.html
```

Run the static contract checks with:

```text
node designs/smoji-candidate/prototype.test.mjs
```
