import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
// Bypass the framework’s optional Sharp type stub in this Node-only test.
const sharp = createRequire(import.meta.url)('sharp');
import jsQR from 'jsqr';
import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import {
  billSchema,
  settingsSchema,
  templateSchema,
  builtinTemplates,
  defaultSettings,
  newDocument,
  typeNames,
  documentTypes,
  validateForExport,
  type BillDoc,
} from '../lib/billbook/model';
import { calculate, documentText, taxRows } from '../lib/billbook/calculations';
import { upiPaymentUri } from '../lib/billbook/payment';
import { parseRows } from '../lib/billbook/import';
import {
  saveDocuments,
  loadWorkspace,
  backup,
  restoreBackup,
} from '../lib/billbook/storage';
import DocumentPreview from '../components/billbook/document-preview';
import UpiQr from '../components/billbook/upi-qr';

const settings = structuredClone(defaultSettings);
settings.seller.name = 'Greenview Society';
settings.seller.address = 'Mumbai';
settings.seller.gst = '27ABCDE1234F1Z5';
settings.seller.vat = 'VAT-42';
settings.seller.registration = 'REG-2026-42';
settings.upiId = 'greenview@upi';
settings.upiName = 'Greenview Society';
settings.bankDetails =
  'Greenview Society\nAccount: 1234567890\nIFSC: EXAM0000123';
settings.paymentInstructions = 'Use your flat number as the payment reference.';
settings.defaultDesign.showUpiQr = true;

function bill(type: BillDoc['type'] = 'maintenance') {
  const doc = newDocument(type, settings);
  doc.number = 'MNT-0042';
  doc.customer.name = 'Aarav';
  doc.customer.state = 'Maharashtra';
  doc.items = [
    {
      id: 'one',
      description: 'Maintenance',
      quantity: 1,
      rate: 100,
      tax: 18,
      hsn: '9995',
    },
  ];
  doc.taxMode = 'gst';
  return doc;
}

void test('built-in layouts inherit payment defaults and custom templates retain their own choices', () => {
  const preset = builtinTemplates.find((t) => t.type === 'maintenance')!;
  assert.equal(
    newDocument('maintenance', settings, preset).design.showUpiQr,
    true,
  );
  const custom = {
    ...structuredClone(preset),
    id: 'custom-template',
    design: { ...preset.design, showUpiQr: false },
  };
  assert.equal(
    newDocument('maintenance', settings, custom).design.showUpiQr,
    false,
  );
});

void test('cash memos and cash vouchers are financial documents with items, tax and payment modes', () => {
  for (const type of ['memo', 'voucher'] as const) {
    const doc = bill(type);
    assert.equal(doc.paymentMethod, 'Cash');
    assert.deepEqual(validateForExport(doc), []);
    const html = renderToStaticMarkup(createElement(DocumentPreview, { doc }));
    assert.ok(html.includes(typeNames[type]));
    assert.ok(html.includes('Maintenance'));
    assert.ok(html.includes('CGST (9%)') && html.includes('SGST (9%)'));
    assert.ok(html.includes('118.00'));
    const text = documentText(doc);
    assert.ok(text.startsWith(typeNames[type].toUpperCase()));
    assert.ok(text.includes('TOTAL: ₹118.00'));
    assert.ok(text.includes('Payment mode: Cash'));
    doc.items = [];
    assert.ok(validateForExport(doc).some((error) => error.includes('item')));
  }
});

void test('all six document types show business identifiers and zero or configured tax', () => {
  for (const type of documentTypes) {
    const doc = bill(type);
    doc.taxMode = 'none';
    const html = renderToStaticMarkup(createElement(DocumentPreview, { doc }));
    const text = documentText(doc);
    for (const value of [
      'GSTIN: 27ABCDE1234F1Z5',
      'VAT ID: VAT-42',
      'Business registration number: REG-2026-42',
      'Tax (not applied)',
    ]) {
      assert.ok(html.includes(value), `${type}: ${value}`);
      assert.ok(text.includes(value), `${type} text: ${value}`);
    }
    doc.taxMode = 'vat';
    assert.ok(
      renderToStaticMarkup(createElement(DocumentPreview, { doc })).includes(
        'VAT (18%)',
      ),
    );
    doc.taxMode = 'custom';
    doc.taxName = 'Local levy';
    assert.ok(documentText(doc).includes('Local levy (18%)'));
  }
});

void test('receipts print every payment mode and its reference', () => {
  const doc = bill('receipt');
  doc.paymentReference = 'TXN-42';
  for (const mode of [
    'Cash',
    'UPI',
    'Card',
    'Bank transfer',
    'Cheque',
    'Other',
  ]) {
    doc.paymentMethod = mode;
    const html = renderToStaticMarkup(createElement(DocumentPreview, { doc }));
    assert.ok(html.includes(`<dd>${mode}</dd>`));
    assert.ok(html.includes('TXN-42'));
    assert.ok(documentText(doc).includes(`Payment mode: ${mode}`));
  }
});

void test('tax rows reconcile mixed rates, discounts, inclusive pricing and paise rounding', () => {
  for (const inclusive of [true, false]) {
    const doc = bill();
    doc.taxInclusive = inclusive;
    doc.discount = 0.01;
    doc.items = [
      { id: 'a', description: 'A', quantity: 1, rate: 0.11, tax: 5, hsn: '1' },
      { id: 'b', description: 'B', quantity: 1, rate: 0.17, tax: 18, hsn: '2' },
      { id: 'c', description: 'C', quantity: 1, rate: 20, tax: 12, hsn: '3' },
    ];
    const totals = calculate(doc);
    assert.equal(
      totals.taxBreakdown.reduce((n, row) => n + row.tax, 0),
      totals.tax,
    );
    assert.equal(
      totals.taxBreakdown.reduce((n, row) => n + row.cgst, 0),
      totals.cgst,
    );
    assert.equal(
      totals.taxBreakdown.reduce((n, row) => n + row.sgst, 0),
      totals.sgst,
    );
    assert.equal(
      taxRows(doc).reduce((n, row) => n + row.amount, 0),
      totals.tax,
    );
    assert.equal(
      totals.lines.reduce((n, row) => n + row.total, 0),
      totals.total,
    );
    assert.ok(taxRows(doc).some((row) => row.label === 'CGST (2.5%)'));
  }
});

void test('UPI payload uses the payee and calculated final amount without parameter injection', () => {
  const doc = bill();
  doc.discount = 10;
  doc.upiName = 'Society & Co = Office';
  doc.number = 'INV&pa=someone@upi';
  const uri = upiPaymentUri(doc, calculate(doc).total);
  assert.ok(uri);
  const url = new URL(uri);
  assert.equal(url.protocol, 'upi:');
  assert.equal(url.hostname, 'pay');
  assert.equal(url.searchParams.get('pa'), 'greenview@upi');
  assert.equal(url.searchParams.getAll('pa').length, 1);
  assert.equal(url.searchParams.get('pn'), 'Society & Co = Office');
  assert.equal(url.searchParams.get('tn'), doc.number);
  assert.equal(url.searchParams.get('am'), '106.20');
  assert.equal(url.searchParams.get('cu'), 'INR');
  doc.items[0].quantity = 2;
  assert.equal(
    new URL(upiPaymentUri(doc, calculate(doc).total)!).searchParams.get('am'),
    '224.20',
  );
  doc.upiIncludeAmount = false;
  assert.equal(new URL(upiPaymentUri(doc, 0)!).searchParams.has('am'), false);
  doc.upiId = 'invalid&pa=another@upi';
  assert.equal(upiPaymentUri(doc, 10000), null);
  assert.ok(validateForExport(doc).some((error) => error.includes('UPI ID')));
  doc.upiId = 'greenview@upi';
  doc.currency = 'USD';
  assert.equal(upiPaymentUri(doc, 10000), null);
  assert.ok(validateForExport(doc).some((error) => error.includes('INR')));
});

void test('the actual rendered UPI QR decodes to the intended payment request', async () => {
  const doc = bill();
  const uri = upiPaymentUri(doc, calculate(doc).total)!;
  const svg = renderToStaticMarkup(createElement(UpiQr, { value: uri }));
  const { data, info } = await sharp(Buffer.from(svg))
    .resize(480, 480)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  assert.ok(decoded, 'Generated payment QR must be scannable');
  assert.equal(decoded.data, uri);
});

void test('bank instructions and QR display are optional independently in HTML and text', () => {
  const doc = bill();
  let html = renderToStaticMarkup(createElement(DocumentPreview, { doc }));
  assert.ok(html.includes('IFSC: EXAM0000123'));
  assert.ok(html.includes(settings.paymentInstructions));
  assert.ok(html.includes('Scan to pay by UPI'));
  doc.design.showBank = false;
  html = renderToStaticMarkup(createElement(DocumentPreview, { doc }));
  assert.ok(!html.includes('IFSC: EXAM0000123'));
  assert.ok(!documentText(doc).includes(settings.paymentInstructions));
  assert.ok(html.includes('Scan to pay by UPI'));
  doc.design.showUpiQr = false;
  assert.ok(
    !renderToStaticMarkup(createElement(DocumentPreview, { doc })).includes(
      'Scan to pay by UPI',
    ),
  );
  assert.ok(!documentText(doc).includes('upi://'));
});

void test('cash memo bulk import accepts line items, identifiers and payment instructions', () => {
  const result = parseRows(
    [
      {
        document_key: 'one',
        customer_name: 'Aarav',
        description: 'Rice',
        rate: 50,
        quantity: 2,
        tax_percent: 5,
        registration_number: 'BUYER-42',
        payment_mode: 'UPI',
        payment_reference: 'TXN-42',
        bank_details: 'Savings 123',
        payment_instructions: 'Pay at the counter',
        upi_id: 'shop@upi',
        upi_name: 'Corner shop',
        show_upi_qr: 'yes',
      },
      {
        document_key: 'one',
        customer_name: 'Aarav',
        description: 'Soap',
        rate: 30,
        tax_percent: 18,
      },
    ],
    'memo',
    settings,
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.documents.length, 1);
  const doc = result.documents[0];
  assert.equal(doc.items.length, 2);
  assert.equal(doc.customer.registration, 'BUYER-42');
  assert.equal(doc.paymentMethod, 'UPI');
  assert.equal(doc.paymentReference, 'TXN-42');
  assert.equal(doc.bankDetails, 'Savings 123');
  assert.equal(doc.paymentInstructions, 'Pay at the counter');
  assert.equal(doc.upiId, 'shop@upi');
  assert.equal(doc.design.showUpiQr, true);
  assert.equal(doc.seller.registration, 'REG-2026-42');
  assert.ok(
    parseRows(
      [{ customer_name: 'A', subject: 'Announcement', message: 'Text' }],
      'memo',
      settings,
    ).errors.some((error) => error.includes('description')),
  );
  const voucher = parseRows(
    [
      {
        customer_name: 'A',
        description: 'Petty cash',
        rate: 100,
        voucher_direction: 'paid',
      },
    ],
    'voucher',
    settings,
  );
  assert.equal(voucher.documents[0].voucherDirection, 'paid');
  assert.equal(voucher.documents[0].paymentMethod, 'Cash');
});

void test('existing schemas and stored documents gain safe defaults without losing saved memo notes', async () => {
  const legacy = JSON.parse(JSON.stringify(bill('memo')));
  delete legacy.seller.registration;
  delete legacy.customer.registration;
  delete legacy.upiId;
  delete legacy.upiName;
  delete legacy.upiIncludeAmount;
  delete legacy.paymentInstructions;
  delete legacy.design.showUpiQr;
  legacy.memoSubject = 'Saved heading';
  legacy.memoBody = 'Saved details';
  const parsed = billSchema.parse(legacy);
  assert.equal(parsed.upiId, '');
  assert.equal(parsed.design.showUpiQr, false);
  assert.equal(parsed.seller.registration, '');
  assert.equal(parsed.memoBody, 'Saved details');
  assert.ok(documentText(parsed).includes('Saved details'));
  const legacySettings = JSON.parse(JSON.stringify(settings));
  delete legacySettings.upiId;
  delete legacySettings.upiName;
  delete legacySettings.upiIncludeAmount;
  delete legacySettings.paymentInstructions;
  delete legacySettings.defaultDesign.showUpiQr;
  delete legacySettings.seller.registration;
  assert.equal(settingsSchema.parse(legacySettings).upiId, '');
  const oldTemplate = JSON.parse(JSON.stringify(builtinTemplates[0]));
  delete oldTemplate.design.showUpiQr;
  assert.equal(templateSchema.parse(oldTemplate).design.showUpiQr, false);
  await loadWorkspace();
  const db = await openDB('billbook-local');
  await db.put('documents', legacy);
  const loaded = (await loadWorkspace()).documents.find(
    (d) => d.id === legacy.id,
  )!;
  assert.equal(loaded.upiId, '');
  assert.equal(loaded.memoBody, 'Saved details');
  db.close();
});

void test('payment configuration and business registration survive save and backup restore', async () => {
  const doc = bill();
  doc.number = 'PAY-0042';
  const [saved] = await saveDocuments([doc], settings);
  assert.equal(saved.upiId, 'greenview@upi');
  const snapshot = await backup();
  await restoreBackup(snapshot);
  const restored = (await loadWorkspace()).documents.find(
    (d) => d.id === doc.id,
  )!;
  assert.equal(restored.seller.registration, 'REG-2026-42');
  assert.equal(restored.paymentInstructions, settings.paymentInstructions);
  assert.equal(restored.design.showUpiQr, true);
  assert.equal(
    upiPaymentUri(restored, calculate(restored).total),
    upiPaymentUri(doc, calculate(doc).total),
  );
});
