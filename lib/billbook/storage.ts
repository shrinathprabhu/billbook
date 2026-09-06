import { z } from 'zod';
import { openDB, type DBSchema } from 'idb';
import {
  billSchema,
  defaultSettings,
  settingsSchema,
  templateSchema,
  type BillDoc,
  type Settings,
  type Template,
  prefixes,
} from './model';
export interface CustomFont {
  id: string;
  name: string;
  data: string;
}
interface BillbookDB extends DBSchema {
  documents: { key: string; value: BillDoc };
  templates: { key: string; value: Template };
  fonts: { key: string; value: CustomFont };
  meta: { key: string; value: unknown };
}
const db = () =>
  openDB<BillbookDB>('billbook-local', 1, {
    upgrade(db) {
      db.createObjectStore('documents', { keyPath: 'id' });
      db.createObjectStore('templates', { keyPath: 'id' });
      db.createObjectStore('fonts', { keyPath: 'id' });
      db.createObjectStore('meta');
    },
  });
export async function loadWorkspace() {
  const d = await db();
  const [documents, templates, fonts, settings] = await Promise.all([
    d.getAll('documents'),
    d.getAll('templates'),
    d.getAll('fonts'),
    d.get('meta', 'settings'),
  ]);
  return {
    documents: documents.map((doc) => billSchema.parse(doc)),
    templates: templates.map((template) => templateSchema.parse(template)),
    fonts,
    settings: settings
      ? settingsSchema.parse(settings)
      : structuredClone(defaultSettings),
  };
}
export async function saveDocuments(docs: BillDoc[], settings: Settings) {
  const parsed = docs.map((d) => billSchema.parse(d));
  const d = await db();
  const tx = d.transaction(['documents', 'meta'], 'readwrite');
  const counters = Object.assign(
    Object.create(null),
    (await tx.objectStore('meta').get('counters')) ?? {},
  ) as Record<string, number>;
  const usedNumbers = new Map(
    (await tx.objectStore('documents').getAll()).map((d) => [d.number, d.id]),
  );
  const saved: BillDoc[] = [];
  for (const doc of parsed) {
    if (!doc.number) {
      const prefix =
        doc.type === 'invoice' ? settings.prefix || 'INV' : prefixes[doc.type];
      let next = counters[prefix] ?? 0;
      do {
        next++;
        doc.number = `${prefix}-${String(next).padStart(4, '0')}`;
      } while (usedNumbers.has(doc.number));
      counters[prefix] = next;
    }
    if (usedNumbers.has(doc.number) && usedNumbers.get(doc.number) !== doc.id) {
      tx.abort();
      await tx.done.catch(() => {});
      throw new Error(`Document number ${doc.number} is already in use.`);
    }
    usedNumbers.set(doc.number, doc.id);
    doc.updatedAt = new Date().toISOString();
    await tx.objectStore('documents').put(doc);
    saved.push(doc);
  }
  await tx.objectStore('meta').put(counters, 'counters');
  await tx.done;
  return saved;
}
export async function deleteDocument(id: string) {
  await (await db()).delete('documents', id);
}
export async function saveSettings(value: Settings) {
  await (await db()).put('meta', settingsSchema.parse(value), 'settings');
}
export async function saveTemplate(value: Template) {
  await (await db()).put('templates', templateSchema.parse(value));
}
export async function deleteTemplate(id: string) {
  await (await db()).delete('templates', id);
}
export async function saveFont(value: CustomFont) {
  await (await db()).put('fonts', value);
}
export async function backup() {
  const d = await db();
  const data = await loadWorkspace();
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    ...data,
    counters: (await d.get('meta', 'counters')) ?? {},
  };
}
export async function restoreBackup(raw: unknown) {
  if (
    !raw ||
    typeof raw !== 'object' ||
    !('version' in raw) ||
    raw.version !== 1
  )
    throw new Error('This is not a Billbook backup.');
  const value = raw as Record<string, unknown>;
  if (
    !Array.isArray(value.documents) ||
    !Array.isArray(value.templates) ||
    !Array.isArray(value.fonts)
  )
    throw new Error('The backup is incomplete.');
  const documents = value.documents.map((d) => billSchema.parse(d)),
    templates = value.templates.map((t) => templateSchema.parse(t)),
    settings = settingsSchema.parse(value.settings);
  const fonts = value.fonts.map((f: unknown) => {
    if (
      !f ||
      typeof f !== 'object' ||
      !('id' in f) ||
      !('name' in f) ||
      !('data' in f) ||
      typeof f.id !== 'string' ||
      typeof f.name !== 'string' ||
      typeof f.data !== 'string' ||
      !/^data:.*;base64,/.test(f.data)
    )
      throw new Error('The backup contains an invalid font.');
    return f as CustomFont;
  });
  const restoredCounters = z
    .record(
      z.string().regex(/^[A-Za-z0-9-]*$/),
      z.number().int().min(0).max(1e9),
    )
    .parse(value.counters ?? {});
  const d = await db();
  const tx = d.transaction(
    ['documents', 'templates', 'fonts', 'meta'],
    'readwrite',
  );
  const existing = await tx.objectStore('documents').getAll();
  const byNumber = new Map(existing.map((doc) => [doc.number, doc.id]));
  for (const doc of documents) {
    if (byNumber.has(doc.number) && byNumber.get(doc.number) !== doc.id) {
      tx.abort();
      await tx.done.catch(() => {});
      throw new Error(
        `Number ${doc.number} conflicts with an existing document. Restore into an empty workspace.`,
      );
    }
    byNumber.set(doc.number, doc.id);
    await tx.objectStore('documents').put(doc);
  }
  for (const t of templates) await tx.objectStore('templates').put(t);
  for (const f of fonts) await tx.objectStore('fonts').put(f);
  const counters = Object.assign(
    Object.create(null),
    (await tx.objectStore('meta').get('counters')) ?? {},
  ) as Record<string, number>;
  for (const [prefix, count] of Object.entries(restoredCounters))
    counters[prefix] = Math.max(counters[prefix] ?? 0, count);
  await tx.objectStore('meta').put(counters, 'counters');
  await tx.objectStore('meta').put(settings, 'settings');
  await tx.done;
}
