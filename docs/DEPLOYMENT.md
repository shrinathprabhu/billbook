# Deploy Billbook to Cloudflare Pages

Billbook is hosted at **https://billbook.lowkey.tools/**. This is the application URL and the SEO canonical. The app, JavaScript, fonts, icons, manifest, crawler files and service worker all live at the domain root. No base path or reverse proxy is required.

Use the canonical URL with a trailing slash consistently in metadata, HTTP canonical headers, structured data, the sitemap and public documentation. `trailingSlash: true` in `next.config.ts` preserves that form in Vinext's rendered canonical and Open Graph metadata. At a domain root, the empty path and `/` identify the same URL. Do not add a redirect between these equivalent forms. Root-relative asset paths and the manifest/service-worker scope still require `/`.

## Cloudflare Pages

Source repository: [shrinathprabhu/billbook](https://github.com/shrinathprabhu/billbook). Cloudflare Pages hosts the installable PWA.

Create a **Pages** project and connect this repository. Use these Git build settings:

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Root directory | Repository root (leave blank) |
| Build command | `npm run build:pages` |
| Build output directory | `dist/pages` |
| Build environment variable | `NODE_VERSION=22` |
| Production branch | The branch you want to publish |
| Custom domain | `billbook.lowkey.tools` |

Pages installs dependencies from the npm lockfile. The CLI scripts run Wrangler from `deploy/cloudflare-pages`, where `wrangler.jsonc` supplies the project name (`billbook`), output directory and compatibility date. Change its name value if your Pages project uses a different name. This separate directory avoids Vinext's automatic Workers detection while using the standard config filename required by Wrangler Pages. Git deployments use the dashboard settings above; the nested Wrangler file is loaded by the CLI scripts. See Cloudflare's [build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), [build image](https://developers.cloudflare.com/pages/configuration/build-image/) and [Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/) documentation.

In the Pages project's **Custom domains** section, add `billbook.lowkey.tools` and follow its DNS instructions. The canonical stays `https://billbook.lowkey.tools/`, including on preview deployments; `CF_PAGES_URL` does not change it. The app remains frontend-only: no Pages Functions, Worker backend, D1, R2 or runtime secrets are needed. Keep Cloudflare features that inject or rewrite JavaScript disabled (such as automatic Web Analytics injection, Zaraz or Rocket Loader); the CSP only permits the app's own scripts.

For a local preview or a manual upload:

```sh
npm ci
npm run build:pages
npm run test:discovery
npm run test:pages
npm run preview:pages
```

The preview uses Wrangler at `http://localhost:8788`. When ready to publish, authenticate with `npx wrangler login`, then run `npm run deploy:pages`. For an existing CI login, Cloudflare's `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are deploy-time credentials, not frontend environment variables. These instructions prepare deployment; building and previewing do not publish anything.

### Install the deployed PWA

Once the Pages site is live over HTTPS, open `https://billbook.lowkey.tools/`, wait for **Ready to work offline**, then use **Install app** in the top bar. Chromium browsers may offer a native prompt; Safari uses its browser menu and the app shows the relevant instructions. A `pages.dev` preview has its own browser storage, so install from the custom domain for your regular workspace. Deploying the static files and installing the PWA are separate steps; no app store or server backend is required.

### Pages output and policy

`npm run build` generates the complete Cloudflare Pages package; `npm run build:pages` is an alias for the same build. `scripts/build-pages.mjs` copies the completed static app into `dist/pages`, generates `_headers` from the asset policies in `scripts/security.mjs`, adds an early CSP meta element to both HTML documents and regenerates the offline workers for the final HTML. `_headers` is deployment configuration and is never included in the offline cache. Do not deploy the intermediate `dist/client` or `dist/server` directories. `npm start`, `npm run preview` and `npm run preview:pages` all run the Pages preview at port 8788.

Cloudflare [limits each `_headers` line to 2,000 characters](https://developers.cloudflare.com/pages/configuration/headers/). Billbook's hash-based script policy exceeds that limit, so its full document policy is placed immediately after the HTML charset declaration, before any resources or scripts. `frame-ancestors` is delivered in the HTTP header because [browsers ignore it in CSP meta elements](https://www.w3.org/TR/CSP/#meta-element). HSTS, frame protection, `nosniff`, referrer, cross-origin and permissions policies remain HTTP headers. This preserves the script hashes without introducing `unsafe-inline` or `unsafe-eval` for scripts or requiring a server function.

Pages serves the top-level `404.html` for unknown paths, preventing its default SPA fallback. Its [static serving behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/) redirects `/index.html` to `/` and can expose `/404` as a clean HTML URL; the error document is marked `noindex`. No custom redirects are needed for root hosting. Pages handles unsupported methods and caching for unknown URLs. The static package excludes source maps and private files. Per-asset cache policies and service-worker scope are supplied through `_headers`.

Local validation with Wrangler 4.129.0 accepted all 21 header rules, returned 200 for all 53 offline assets, 308 for `/index.html`, 404 for unknown pages and 405 for POST. A direct request to the reserved `/_headers` path triggers a Wrangler-only asset-loader error (502); it is not a public asset and is excluded from the offline cache. Live Pages responses still need verification after deployment.

## Search, answer engines and public files

Every build generates these root files:

- `/robots.txt` allows crawling and declares `https://billbook.lowkey.tools/sitemap.xml`.
- `/sitemap.xml` lists the subdomain homepage.
- `/llms.txt`, `/llms-full.txt` and `/index.md` describe public features, steps and FAQs.
- `/manifest.webmanifest` uses `/` for its ID, start URL and scope, with root-relative app icons.
- `/og.png` is the sharing card, with the credit `by @shrinath_prabhu`. Open Graph and Twitter metadata reference it on this subdomain.

The initial HTML includes the guide, use cases and FAQs without requiring JavaScript. The JSON-LD graph covers WebApplication, WebPage/FAQPage, Person, Organization and BreadcrumbList. Structured data and visible answers share the same facts in `lib/site.mjs`. The maker’s Person entity includes his X profile. Footer links credit Shrinath Prabhu, Owleye Analytics and Lowkey Tools, with one contextual recommendation for Credo.

Private bills, customer details, uploads and workspace data never become public HTML, sitemap entries or LLM documentation. These files support discovery; indexing and citations remain decisions made by search and answer engines.

## Security and caching

- Build-specific CSP SHA-256 hashes cover parsed inline scripts, hydration payloads and JSON-LD. Scripts have no `unsafe-inline` or `unsafe-eval` allowance.
- Inline styles support custom document design. Same-origin, `data:` and `blob:` images, fonts and export resources support local uploads and PDF/PNG generation. No analytics or external script dependency is enabled by the creator links.
- Frames, objects, form submissions and script attributes are blocked. Unused device permissions are disabled; clipboard write and native sharing remain available.
- Responses include HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, COOP and CORP.
- Hashed static assets use a one-year immutable cache. HTML revalidates. Service workers are `no-store`; fixed-name images cache for one day, and discovery files/manifest for one hour. The error document is `noindex`; its explicit `/404` and `/404.html` header rules use `no-store`. Pages controls caching for unknown URLs.
- Pages handles unsupported methods and missing files with its native static responses as described above. Source maps and the internal client-entry manifest are excluded; the packager rejects private files and server or deployment control files in its input.

## Offline updates and existing data

New visits register `/sw.js` with `/` scope. The worker caches only known public app files and the homepage. It does not turn arbitrary unknown URLs into app pages or intercept requests to other origins.

A compatibility copy at `/standalone-sw.js` lets previously installed root workers fetch an update. It serves the same current worker; new visits use `/sw.js`. Activation cleans only Billbook’s own application-cache namespaces, including those used by previous versions. Updates wait for old app clients to close before activation, so editing is not interrupted by a forced reload. Neither the build nor the worker deletes IndexedDB documents, templates, settings or fonts.

Changing paths on the same origin preserves the workspace. Browser origins have separate storage: data previously created on the parent domain must be moved with the app’s JSON backup/restore. Do not clear site data to resolve a stale app cache or a previously cached redirect.

## Verify

```sh
npm run typecheck
npm run lint
npm test
npm run build:pages
npm run test:discovery
npm run test:pages
npm run preview:pages
```

Open `http://localhost:8788/`. After deploying, check the live root response and public files:

```sh
curl -I https://billbook.lowkey.tools/
curl -I https://billbook.lowkey.tools/sw.js
curl -I https://billbook.lowkey.tools/og.png
curl -I https://billbook.lowkey.tools/not-a-page
curl https://billbook.lowkey.tools/robots.txt
curl https://billbook.lowkey.tools/sitemap.xml
curl https://billbook.lowkey.tools/llms.txt
```

Expect 200 without a `Location` header for the homepage/assets/text and 404 for the unknown page. On Pages, use `npm run preview:pages` to check native header/redirect behavior, and expect `/index.html` to redirect to `/`. Check local save/import/export, keyboard navigation and an offline reload. Submit the subdomain sitemap to search consoles after deployment. DNS, deployment and search-console submission are not performed by the local build.
