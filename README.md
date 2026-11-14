# Keep a Roadmap

A convention for keeping a `ROADMAP.md`, in the spirit of
[Keep a Changelog](https://keepachangelog.com/). This repository holds
version 1.0.0 of the convention and the one-page site that explains it.
It isn't published yet.

## Layout

- `src/index.html` holds the page, and its prose is the convention itself.
  `src/style.css` holds the styles.
- `examples/ROADMAP.md` is the worked example. The build inlines it into the
  page, so edit it here, not in the HTML.
- `CREDITS.md` lists every source, how it was checked, and its license.
- `build.mjs` is the build. It needs Node 20 or later and has no dependencies.
- `test/` checks the build and the page's links.
- `scripts/external-links.txt` lists every external URL on the page.
- `netlify.toml` configures a future Netlify deploy. Nothing is deployed yet.

## Build

```sh
npm run build
```

The site is written to `dist/`.

## Preview locally

```sh
npm run preview
```

This builds the site and serves `dist/` at <http://localhost:8080/>. Set `PORT`
to use a different port.

## Check

```sh
npm test
```

The tests build the site and check that:

- every in-page anchor and relative link resolves;
- the example on the page matches `examples/ROADMAP.md`;
- the page has the basic accessible structure and works without JavaScript;
- every external URL on the page is in `scripts/external-links.txt`.

The tests don't touch the network. To check the external URLs themselves, run
this once when the list changes:

```sh
npm run check:external
```

Some sites refuse scripted requests. Open any URL that fails in a browser
before deciding it's broken.

## License

Copyright (c) 2026 John Campion. Each part has its own license:

- the convention and site text, including `CREDITS.md` and this README:
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/);
- `examples/ROADMAP.md`:
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), so you can
  copy it into your project without attribution;
- the build scripts and tests: MIT.

`LICENSE` lists which files each license covers.
