import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { Worker } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import * as XLSX from 'xlsx';

// Execute the actual bundled browser worker in a separate local thread. Only
// its message transport is adapted; file decoding and lazy XLSX loading are real.
const directory = 'dist/workers/_next/static/workers';
const entry = (await readdir(directory)).find((name) =>
  /^import\.worker-.*\.js$/.test(name),
);
assert.ok(entry, 'The production package must contain the import worker');
const workerUrl = pathToFileURL(path.resolve(directory, entry)).href;
async function decode(t, name, content) {
  const source = `
    import { parentPort } from 'node:worker_threads';
    globalThis.self = { postMessage: (message) => parentPort.postMessage(message) };
    await import(${JSON.stringify(workerUrl)});
    parentPort.on('message', ({name, content}) => self.onmessage({data: new File([content], name)}));
  `;
  const worker = new Worker(
    new URL(`data:text/javascript,${encodeURIComponent(source)}`),
  );
  t.after(() => worker.terminate());
  return new Promise((resolve, reject) => {
    worker.once('error', reject);
    worker.once('message', resolve);
    worker.postMessage({ name, content });
  });
}
const rows = Array.from({ length: 500 }, (_, i) => ({
  customer_name: `Test resident ${i + 1}`,
  description: 'Maintenance',
  rate: 2500,
  quantity: 1,
}));
await test(
  'the bundled import worker decodes the full 500-row Excel limit',
  { timeout: 15000 },
  async (t) => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(rows),
      'Documents',
    );
    const result = await decode(
      t,
      'maintenance.xlsx',
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
    );
    assert.deepEqual(result, { rows });
  },
);
await test(
  'the bundled import worker handles JSON and CSV without altering row data',
  { timeout: 15000 },
  async (t) => {
    assert.deepEqual(
      await decode(t, 'maintenance.json', JSON.stringify(rows)),
      { rows },
    );
    assert.deepEqual(
      await decode(
        t,
        'maintenance.csv',
        'customer_name,description,rate\nTest resident,Maintenance,2500',
      ),
      {
        rows: [
          {
            customer_name: 'Test resident',
            description: 'Maintenance',
            rate: 2500,
          },
        ],
      },
    );
  },
);
await test(
  'the bundled import worker returns actionable file validation errors',
  { timeout: 15000 },
  async (t) => {
    assert.match((await decode(t, 'empty.json', '[]')).error, /No rows found/);
    assert.match(
      (await decode(t, 'too-many.json', JSON.stringify([...rows, rows[0]])))
        .error,
      /500 rows/,
    );
    assert.match(
      (await decode(t, 'wrong.txt', 'text')).error,
      /Choose an Excel/,
    );
  },
);
