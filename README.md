# Billbook

A frontend-only, offline bill generator. Built with React, TypeScript, and a static Vinext/Vite export. The production app is plain HTML, CSS, JavaScript, and bundled assets. It has no application backend, authentication service, cloud database, or external runtime API.

## Run

```sh
npm install
npm run dev
```

Open the development server at `/` or `/billbook`; the root is internally rewritten to the app.

For the complete offline app:

```sh
npm run build
npm start
```

Open http://localhost:4173/ or http://localhost:4173/billbook once while connected and wait for **Ready to work offline** in the sidebar. The production service worker caches every application module and bundled font, including the Excel and export modules. The development server does not register a service worker.

`npm start` is a tiny local static file server, not an application backend. The generated Vercel Build Output API files include production routing and security headers. Other static hosts must implement the rules in `dist/routing.json`; serving `dist/client/` alone is not enough to reproduce those headers, rewrites and error responses. Do not deploy the intermediate `dist/server/` build artifacts. Service workers require localhost or HTTPS; opening the HTML directly with `file://` is not supported.

## What’s included

- Invoices, shop receipts, rent receipts, society maintenance bills, cash vouchers, and cash memos.
- IndexedDB document, template, business-setting, and uploaded-font storage.
- Sequential, transactionally allocated IDs; configurable invoice prefix; editable document numbers; duplicate-number prevention.
- Business and recipient addresses, GSTIN, VAT ID, business registration number, PAN, HSN/SAC, place of supply, contact information, due dates, and payment references.
- Tax percentages and amounts printed on each line, plus a breakdown by rate in every document, including cash memos. Manual item tax percentages; CGST + SGST, IGST, VAT, custom tax, and tax-inclusive pricing. Discounts are allocated proportionally before tax using integer minor units.
- A4 previews with three layouts, 12 bundled/system font options, uploaded fonts, logo, letterhead, signature, colors, paid stamp, bank details, and reorderable text/payment/terms components.
- PDF, PNG, copyable text, native text sharing when supported, and multi-copy PDFs for seller/customer records. The print action downloads a PDF to open in your preferred viewer.
- Excel (`.xlsx`, `.xls`), CSV, and JSON imports with sample downloads and row validation. Up to 500 rows / 10 MB per file; first worksheet only. Matching `document_key` values combine items. JSON supports nested `items` arrays.
- Payment modes and references on receipts and other documents; optional bank details, payment instructions, and locally generated UPI QR codes for INR bills. Configure workspace defaults or change each document. QR amounts update with tax and discounts, or can be left for the payer to enter.
- Batch creation as draft, issued/unpaid, or paid; PDF/text ZIP exports.
- Workspace JSON backup/restore and optional browser persistent-storage requests.
- Responsive navigation, document filters, search, pagination, and keyboard shortcuts.

## Data and privacy

All business data remains in IndexedDB on the current browser origin. Clearing browser site data removes it. Download backups regularly. Browser profiles, devices, and origins have separate workspaces. Font and image uploads stay local. Fonts and document images are included in workspace backups.

Restoring merges documents and templates, overwrites matching IDs and settings, and rejects document-number collisions. Individual numbering sequences are retained locally. Restore keeps the higher counter for each prefix and checks stored numbers before allocating a new one.

Summary cards use the default workspace currency and exclude drafts and outgoing cash vouchers. Invoice and receipt records are counted separately; they are not linked accounting entries. Required-field checks depend on the selected document and tax mode; users determine applicable tax rates and local statutory requirements.

PDFs preserve the visual template as high-resolution page images. Copyable text is available separately. Web Share and clipboard support depend on the browser. The app supports a feature-detected WebMCP surface for listing documents and creating local drafts; this is optional and does not require a service.

## Checks

```sh
npm run typecheck
npm test
npm run build
npm run test:discovery
```

Tests cover tax/discount arithmetic, rental and identifier validation, XLSX and JSON parsing, grouped imports, sequential IDs under concurrent writes, atomic rejection of duplicate numbers, deletion, and backup restoration. Payment tests also decode the actual QR image, check printed tax breakdowns, and verify older workspace records receive safe defaults.

The maintained SheetJS parser comes from the [official SheetJS distribution](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/), rather than the outdated npm registry release.

## Public URL, discovery and deployment

Billbook works directly at https://billbook.lowkey.tools/ and behind https://lowkey.tools/billbook, with no browser redirect between them. Like Credo, assets use the `/billbook` prefix and the main-site URL remains the SEO canonical. The origin serves its root with an internal rewrite and accepts both path-preserving and prefix-stripping proxies. Offline reload works at both entry paths; the proxy worker stays scoped to Billbook and the standalone root uses a separate worker. Install metadata opens `/billbook` on the current host.

The public guide and FAQs are pre-rendered as HTML. Canonicals, Open Graph/Twitter cards, creator metadata and JSON-LD are generated from public product facts, alongside robots.txt, sitemap.xml, llms.txt, llms-full.txt and a Markdown guide. Private bills never become crawlable pages. The interface credits [Shrinath Prabhu](https://shrinath.me), creator of [Owleye Analytics](https://owleye.dev), and links back to [Lowkey Tools](https://lowkey.tools).

See [deployment instructions](docs/DEPLOYMENT.md) for Vercel security rules, proxy configuration and the required parent-site robots/sitemap/LLM additions. The parent site is a separate project; these additions must be merged there. The generated OG asset and its prompt are documented in [OG-IMAGE.md](docs/OG-IMAGE.md).

`npm run test:discovery` checks the built HTML without JavaScript, structured data, canonical URLs, public assets, icon dimensions, CSP hashes, proxy routing and service-worker cache boundaries.

## Cash documents and payment fields

Cash memos are itemized sales documents. Cash vouchers record cash received or paid out. Both default to Cash as the payment mode and support the same tax, business identifiers and export options as invoices. The stored type keys remain `memo` and `voucher` to preserve existing document IDs and backups. Older saved note content remains available in the editor and exports; cash memos now require priced line items before issuing or exporting.

Set bank details, payment instructions, payee UPI ID and payee name in Workspace settings. In a document, use Details → Where to pay to control bank information and QR visibility separately. Built-in layouts inherit workspace payment defaults; custom templates retain their saved visibility choices. QR codes work offline and do not contact a payment gateway or automatically mark bills paid. Payee availability and final payment completion are handled by the payer’s UPI app.

Bulk imports accept `payment_mode` (or `payment_method`), `payment_reference`, `bank_details`, `payment_instructions`, `upi_id`, `upi_name`, `show_payment_details`, `show_upi_qr`, `upi_include_amount`, and `registration_number` for the customer. Seller overrides use `seller_gst_id`, `seller_vat_id` and `seller_registration_number`. Cash vouchers can use `voucher_direction` (`received` or `paid`). Display options accept true/false, yes/no or 1/0. All document types use item rows or nested JSON items; cash memos do not require subject/message columns.

UPI fields follow the [UPI parameter conventions documented by Google Pay](https://developers.google.com/pay/india/api/android/in-app-payments). QR rendering uses the bundled [node-qrcode encoder](https://github.com/soldair/node-qrcode).
