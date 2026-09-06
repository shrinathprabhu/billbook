import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { calculate, documentText } from '../lib/billbook/calculations';
import {
  defaultSettings,
  newDocument,
  validateForExport,
  validDate,
} from '../lib/billbook/model';
import { parseRows, readImportFile } from '../lib/billbook/import';
import {
  saveDocuments,
  loadWorkspace,
  deleteDocument,
  backup,
  restoreBackup,
} from '../lib/billbook/storage';
const settings = structuredClone(defaultSettings);
settings.seller.name = 'Greenview Society';
settings.seller.address = 'Mumbai';
function invoice() {
  const d = newDocument('invoice', settings);
  d.customer.name = 'Aarav Sharma';
  d.items = [
    {
      id: 'one',
      description: 'Maintenance',
      quantity: 1,
      rate: 100,
      tax: 18,
      hsn: '9995',
    },
  ];
  return d;
}
void test('exclusive GST splits into CGST and SGST and reconciles exactly', () => {
  const d = invoice();
  d.taxMode = 'gst';
  const t = calculate(d);
  assert.equal(t.subtotal, 10000);
  assert.equal(t.tax, 1800);
  assert.equal(t.cgst, 900);
  assert.equal(t.sgst, 900);
  assert.equal(t.total, 11800);
});
void test('tax-inclusive prices extract tax without adding it again', () => {
  const d = invoice();
  d.items[0].rate = 118;
  d.taxMode = 'igst';
  d.taxInclusive = true;
  const t = calculate(d);
  assert.equal(t.taxable, 10000);
  assert.equal(t.tax, 1800);
  assert.equal(t.total, 11800);
});
void test('mixed rates receive proportional discounts before tax', () => {
  const d = invoice();
  d.taxMode = 'vat';
  d.discount = 30;
  d.items.push({
    id: 'two',
    description: 'Services',
    rate: 200,
    quantity: 1,
    tax: 5,
    hsn: '',
  });
  const t = calculate(d);
  assert.deepEqual(
    t.lines.map((i) => i.discount),
    [1000, 2000],
  );
  assert.equal(t.tax, 2520);
  assert.equal(t.total, 29520);
});
void test('tiny line item discounts never produce negative taxable amounts', () => {
  const d = invoice();
  d.discount = 0.5;
  d.items = Array.from({ length: 100 }, (_, i) => ({
    id: String(i),
    description: 'Small item',
    quantity: 1,
    rate: 0.01,
    tax: 0,
    hsn: '',
  }));
  const t = calculate(d);
  assert.equal(t.discount, 50);
  assert.equal(t.total, 50);
  assert.ok(t.lines.every((l) => l.base >= 0 && l.discount >= 0));
  assert.equal(
    t.lines.reduce((n, l) => n + l.discount, 0),
    50,
  );
});
void test('no-tax ignores stored line tax rates', () => {
  const d = invoice();
  assert.equal(calculate(d).total, 10000);
});
void test('fractional quantities round once at the line boundary', () => {
  const d = invoice();
  d.items[0].quantity = 2.5;
  d.items[0].rate = 1.11;
  assert.equal(calculate(d).total, 278);
});
void test('tax document validation requires business identifiers and supply details', () => {
  const d = invoice();
  d.taxMode = 'gst';
  assert.ok(validateForExport(d).some((e) => e.includes('GSTIN')));
  d.seller.gst = '27ABCDE1234F1Z5';
  d.customer.state = 'Maharashtra';
  assert.deepEqual(validateForExport(d), []);
});
void test('rent receipts require valid property and rental period', () => {
  const d = invoice();
  d.type = 'rent';
  assert.ok(validateForExport(d).some((e) => e.includes('property')));
  d.rentAddress = 'A-101 Greenview';
  d.rentFrom = '2026-09-01';
  d.rentTo = '2026-09-30';
  assert.deepEqual(validateForExport(d), []);
  d.rentTo = '2026-08-31';
  assert.ok(validateForExport(d).some((e) => e.includes('end date')));
});
void test('invalid dates are rejected rather than rolled to the following month', () => {
  assert.equal(validDate('2026-02-31'), false);
  assert.equal(validDate('2026-09-05'), true);
  assert.equal(validDate('2026-13-01'), false);
});
void test('imports generate one document per row without a grouping key', () => {
  const result = parseRows(
    [
      { customer_name: 'One', description: 'Rent', rate: 2000 },
      { customer_name: 'Two', description: 'Rent', rate: 2500 },
    ],
    'receipt',
    settings,
  );
  assert.equal(result.errors.length, 0);
  assert.equal(result.documents.length, 2);
  assert.equal(result.documents[1].items[0].rate, 2500);
});
void test('matching import keys group items without merging different customers', () => {
  const result = parseRows(
    [
      {
        document_key: 'a',
        customer_name: 'One',
        description: 'Rent',
        rate: 2000,
      },
      {
        document_key: 'a',
        customer_name: 'One',
        description: 'Water',
        rate: 100,
      },
      {
        document_key: 'a',
        customer_name: 'Different',
        description: 'Fee',
        rate: 500,
      },
    ],
    'maintenance',
    settings,
  );
  assert.equal(result.documents.length, 1);
  assert.equal(result.documents[0].items.length, 2);
  assert.equal(result.errors.length, 1);
});
void test('nested JSON items support mixed tax rates', () => {
  const result = parseRows(
    [
      {
        customer_name: 'One',
        items: [
          { description: 'Rice', rate: 50, quantity: 2, tax: 5 },
          { description: 'Soap', rate: 30, tax_percent: 18 },
        ],
      },
    ],
    'receipt',
    settings,
  );
  assert.equal(result.errors.length, 0);
  assert.deepEqual(
    result.documents[0].items.map((i) => i.tax),
    [5, 18],
  );
});
void test('bad numeric input and impossible tax rates are rejected with row numbers', () => {
  const result = parseRows(
    [
      { customer_name: 'One', description: 'Service', rate: 'oops' },
      {
        customer_name: 'Two',
        description: 'Service',
        rate: 20,
        tax_percent: 120,
      },
      { customer_name: 'Three', description: 'Service', rate: 20, quantity: 0 },
    ],
    'invoice',
    settings,
  );
  assert.equal(result.documents.length, 0);
  assert.equal(result.errors.length, 3);
  assert.ok(result.errors[0].startsWith('Row 2:'));
});
void test('XLSX file round-trips through the actual parser', async () => {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      { customer_name: 'Aarav', description: 'Maintenance', rate: 2500 },
    ]),
    'Bills',
  );
  const file = new File(
    [XLSX.write(wb, { type: 'array', bookType: 'xlsx' })],
    'input.xlsx',
  );
  const rows = await readImportFile(file);
  const parsed = parseRows(rows, 'maintenance', settings);
  assert.equal(parsed.documents[0].customer.name, 'Aarav');
  assert.equal(parsed.documents[0].items[0].rate, 2500);
});
void test('JSON files reject empty or malformed rows', async () => {
  await assert.rejects(
    () => readImportFile(new File(['[]'], 'empty.json')),
    /No rows/,
  );
  await assert.rejects(
    () => readImportFile(new File(['[null]'], 'bad.json')),
    /must be an object/,
  );
});
void test('copyable text includes document identity, identifiers, items, and totals', () => {
  const d = invoice();
  d.number = 'INV-0042';
  d.customer.gst = '27ABCDE1234F1Z5';
  const text = documentText(d, 'Customer copy');
  assert.ok(text.includes('INV-0042'));
  assert.ok(text.includes('Customer copy'));
  assert.ok(text.includes(d.customer.gst));
  assert.ok(text.includes('TOTAL:'));
  assert.ok(text.includes('100.00'));
});
void test('concurrent saves allocate unique sequential IDs and preserve documents', async () => {
  const results = await Promise.all(
    Array.from({ length: 10 }, () => saveDocuments([invoice()], settings)),
  );
  const numbers = results.flat().map((d) => d.number);
  assert.equal(new Set(numbers).size, 10);
  assert.deepEqual(
    numbers.map((n) => Number(n.split('-')[1])).sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  const workspace = await loadWorkspace();
  assert.equal(workspace.documents.length, 10);
});
void test('duplicate manual numbers reject atomically and do not partially save the batch', async () => {
  const a = invoice(),
    b = invoice();
  a.number = 'CUSTOM-1';
  b.number = 'CUSTOM-1';
  const before = (await loadWorkspace()).documents.length;
  await assert.rejects(() => saveDocuments([a, b], settings), /already in use/);
  assert.equal((await loadWorkspace()).documents.length, before);
});
void test('deleting a document does not recycle its number', async () => {
  const [a] = await saveDocuments([invoice()], settings);
  await deleteDocument(a.id);
  const [b] = await saveDocuments([invoice()], settings);
  assert.notEqual(a.number, b.number);
  assert.ok(Number(b.number.split('-')[1]) > Number(a.number.split('-')[1]));
});
void test('workspace backups restore deleted documents and reject invalid payloads', async () => {
  const [a] = await saveDocuments([invoice()], settings);
  const data = await backup();
  await deleteDocument(a.id);
  await restoreBackup(data);
  assert.ok((await loadWorkspace()).documents.some((d) => d.id === a.id));
  await assert.rejects(
    () => restoreBackup({ version: 2 }),
    /not a Billbook backup/,
  );
  await assert.rejects(() =>
    restoreBackup({ ...data, documents: [{ id: 'broken' }] }),
  );
});
void test('restoring a backup keeps higher numbering counters', async () => {
  const data = await backup();
  await restoreBackup({ ...data, counters: { INV: 100 } });
  const [d] = await saveDocuments([invoice()], settings);
  assert.equal(d.number, 'INV-0101');
});
void test('backup conflicts preserve the original workspace', async () => {
  const data = await backup();
  const conflict = { ...data.documents[0], id: 'a-new-conflicting-id' };
  const before = (await loadWorkspace()).documents.length;
  await assert.rejects(
    () => restoreBackup({ ...data, documents: [conflict] }),
    /conflicts/,
  );
  assert.equal((await loadWorkspace()).documents.length, before);
});
