# Billbook — Free offline invoice & receipt generator

> Create invoices, GST/VAT bills, rent receipts and society maintenance bills. Customize templates, import Excel or JSON, and export PDF or PNG. No sign-up.

Canonical page: https://lowkey.tools/billbook

Billbook is a free browser app by [Lowkey Tools](https://lowkey.tools). Made by [Shrinath Prabhu](https://shrinath.me), creator of [Owleye Analytics](https://owleye.dev). No account is required.

## What you can create

### Business invoices

Create itemized invoices with seller and customer details, invoice numbers, due dates, HSN/SAC codes, discounts, and manually configured GST, VAT or custom tax. Export customer and seller copies together.

### Society maintenance bills

Prepare recurring maintenance bills with flat or unit details and individual charges. Add optional bank details, payment instructions and a UPI QR code showing where to pay. Import a resident list from Excel, CSV or JSON to generate multiple documents with sequential numbers.

### Shop and food receipts

Make receipts for kirana stores, food stalls and local shops. Add items, quantities, prices, a payment mode (cash, UPI, card, bank transfer or cheque), payment references and a paid stamp, then download a PDF or PNG or copy the receipt as text.

### Rent receipts

Record the tenant, landlord, property address, rental period, rent amount and payment reference. Add PAN details when applicable and include a signature area in the receipt template.

### Cash vouchers and cash memos

Record cash received or paid out with a cash voucher, or create an itemized cash memo for a sale, including quantities, prices, discounts and tax. Reuse your business information, choose a template and keep the generated documents in your local library.

### Your own document templates

Change colors, fonts, layout, logo, letterhead and signature. Add and reorder text, terms and payment components. Use bundled sans-serif, serif and monospace fonts or upload your own font files.

## How to create a bill

1. **Choose a document.** Select New document, then choose an invoice, receipt, rent receipt, maintenance bill, cash voucher or cash memo. Start with a built-in template or a saved custom template.

2. **Enter the details.** Add your business and recipient details, document date, items and payment information. Fill in the tax identifiers and additional fields applicable to your document.

3. **Set tax and customize.** Choose the tax mode and enter tax percentages yourself. Review totals and required fields, then customize fonts, colors, letterhead and signature in the preview.

4. **Save and export.** Save the document to your browser. Download a PDF or PNG, copy its text, or open your browser’s share dialog. For bulk work, import a file and download a ZIP of generated documents.

## Frequently asked questions

### What is Billbook?

Billbook is a free, frontend-only invoice and receipt generator by Lowkey Tools. It creates invoices, shop receipts, rent receipts, society maintenance bills, cash vouchers and cash memos in your browser, with no account required.

### Does the bill generator work offline?

Yes. Open the app while connected and wait for “Ready to work offline”. The production app caches its interface, bundled fonts, import tools and export tools for later offline use. It requires a browser with service worker support and HTTPS or localhost.

### Where are my invoices and business details stored?

Documents, settings, templates and uploaded fonts are saved locally in IndexedDB for the current browser and site origin. Billbook does not upload this workspace to an application server. Clearing site data or losing the browser profile can remove your documents; download a workspace backup from Settings. Devices, browser profiles and different site origins have separate workspaces.

### Can I add GST, VAT and custom tax percentages?

Yes. Billbook supports CGST plus SGST, IGST, VAT, custom tax and tax-inclusive pricing, with manually entered item tax percentages. All six document types can show GSTIN, VAT ID and a business registration number, plus PAN, HSN/SAC and place of supply. The document displays item tax percentages and amounts, with a breakdown by rate for CGST/SGST, IGST, VAT or custom tax. Required-field checks depend on document type and tax mode. You choose applicable rates and confirm the statutory requirements for your location; the app does not automatically determine them.

### Can I generate multiple invoices from Excel or JSON?

Yes. Bulk generate accepts Excel .xlsx and .xls files, CSV and JSON, with a limit of 500 rows and 10 MB per file. Excel imports use the first worksheet. Matching document_key values group line items into a single document, and JSON also supports nested items arrays. Download a sample in Bulk generate to see the supported fields.

### Can I create rent receipts and society maintenance bills?

Yes. Rent receipts include landlord, tenant, property, rent period and payment details. Maintenance bills support resident or unit details and itemized charges, with optional bank details, payment instructions and a UPI payment QR code. QR codes are generated offline from the payee UPI ID for INR documents; they can include the current bill total or let the payer enter an amount. Bulk import can generate documents for multiple residents using the selected template.

### Can I customize templates and upload fonts?

Yes. Save reusable templates with your logo, letterhead, colors, signature and reorderable text, terms and payment components. Bundled fonts include Inter, DM Sans, Manrope, Lora, Libre Baskerville, Playfair Display, IBM Plex Mono, JetBrains Mono and Space Mono. You can also upload font files for use in your browser.

### Which export and sharing formats are supported?

Download documents as PDF or PNG, copy their text, and use native text sharing where the browser supports it. PDFs can include customer and seller copies. Batch exports create ZIP files containing PDF and text documents. PDF pages preserve the visual design as images; use the separate text export when selectable text is needed.

### Are document numbers assigned automatically?

Yes. Billbook allocates incremental document numbers locally, lets you configure the numbering prefix and checks for duplicate numbers in the workspace. These sequences are specific to your browser’s saved workspace and are not synchronized across devices.

### Is Billbook free, and do I need to sign up?

Billbook is free to use and does not require sign-up. The app runs in the browser without an application backend. Install it from a supporting browser for a standalone window, or keep using the website.

## Public discovery files

- [Application](https://lowkey.tools/billbook)
- [LLM index](https://lowkey.tools/billbook/llms.txt)
- [Sitemap](https://lowkey.tools/billbook/sitemap.xml)

This document describes the public application. Private invoices, uploaded files and local workspace data are not published here.
