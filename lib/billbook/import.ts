import {
  newDocument,
  type BillDoc,
  type DocType,
  type Settings,
  type Template,
  uuid,
  itemSchema,
  today,
  validDate,
  validUpiId,
} from './model';
export type ImportRow = Record<string, unknown>;
const text = (v: unknown): string => {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v).trim();
  throw new Error('Cell values must be text or numbers.');
};
function numeric(v: unknown, fallback: number, label: string) {
  if (v === undefined || v === null || v === '') return fallback;
  const value = typeof v === 'number' ? v : Number(text(v).replaceAll(',', ''));
  if (!Number.isFinite(value)) throw new Error(`${label} must be a number.`);
  return value;
}
function boolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = text(value).toLowerCase();
  if (['true', 'yes', '1'].includes(normalized)) return true;
  if (['false', 'no', '0'].includes(normalized)) return false;
  throw new Error(
    'Use true/false, yes/no, or 1/0 for payment display options.',
  );
}
function date(v: unknown, fallback = '') {
  if (!v) return fallback;
  if (v instanceof Date) return v.toLocaleDateString('en-CA');
  const value = text(v).slice(0, 10);
  if (!validDate(value)) throw new Error('Use dates in YYYY-MM-DD format.');
  return value;
}
export function normalizeRows(rows: ImportRow[]) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [
        k
          .trim()
          .toLowerCase()
          .replace(/[\s-]+/g, '_'),
        v,
      ]),
    ),
  );
}
export function parseRows(
  rows: ImportRow[],
  type: DocType,
  settings: Settings,
  template?: Template,
): { documents: BillDoc[]; errors: string[] } {
  const errors: string[] = [],
    groups = new Map<string, BillDoc>();
  for (const [index, row] of normalizeRows(rows).entries()) {
    try {
      const name = text(row.customer_name ?? row.name ?? row.customer);
      if (!name) throw new Error('Customer name is required.');
      const key = text(row.document_key) || `row-${index}`;
      let doc = groups.get(key);
      if (doc && doc.customer.name !== name)
        throw new Error(
          'Rows sharing a document_key must have the same customer.',
        );
      const fresh = !doc;
      if (!doc) {
        doc = newDocument(type, settings, template);
        doc.items = [];
        doc.customer = {
          ...doc.customer,
          name,
          address: text(row.customer_address ?? row.address),
          email: text(row.email),
          phone: text(row.phone),
          gst: text(row.gst_id ?? row.gstin).toUpperCase(),
          vat: text(row.vat_id),
          registration: text(
            row.registration_number ?? row.business_registration_number,
          ),
          pan: text(row.pan).toUpperCase(),
          state: text(row.state),
        };
        doc.date = date(row.date, today());
        doc.dueDate = date(row.due_date);
        doc.unit = text(row.unit ?? row.flat);
        doc.rentAddress = text(row.rent_address);
        doc.rentFrom = date(row.rent_from);
        doc.rentTo = date(row.rent_to);
        doc.paymentMethod =
          text(row.payment_mode ?? row.payment_method) || doc.paymentMethod;
        doc.paymentReference = text(row.payment_reference);
        doc.notes = text(row.notes) || template?.notes || '';
        if (row.bank_details !== undefined)
          doc.bankDetails = text(row.bank_details);
        if (row.payment_instructions !== undefined)
          doc.paymentInstructions = text(row.payment_instructions);
        if (row.upi_id !== undefined) doc.upiId = text(row.upi_id);
        if (row.upi_name !== undefined) doc.upiName = text(row.upi_name);
        doc.design.showBank = boolean(
          row.show_payment_details,
          doc.design.showBank,
        );
        doc.design.showUpiQr = boolean(row.show_upi_qr, doc.design.showUpiQr);
        doc.upiIncludeAmount = boolean(
          row.upi_include_amount,
          doc.upiIncludeAmount,
        );
        if (doc.design.showUpiQr && !validUpiId(doc.upiId))
          throw new Error(
            'A valid payee upi_id is required when show_upi_qr is enabled.',
          );
        if (doc.design.showUpiQr && doc.currency !== 'INR')
          throw new Error('UPI QR codes require INR.');
        if (row.seller_gst_id !== undefined)
          doc.seller.gst = text(row.seller_gst_id).toUpperCase();
        if (row.seller_vat_id !== undefined)
          doc.seller.vat = text(row.seller_vat_id);
        if (row.seller_registration_number !== undefined)
          doc.seller.registration = text(row.seller_registration_number);
        if (
          row.voucher_direction !== undefined &&
          text(row.voucher_direction)
        ) {
          const direction = text(row.voucher_direction).toLowerCase();
          if (direction !== 'received' && direction !== 'paid')
            throw new Error('voucher_direction must be received or paid.');
          doc.voucherDirection = direction;
        }
        doc.discount = numeric(row.discount, 0, 'Discount');
        if (doc.discount < 0) throw new Error('Discount cannot be negative.');
      }
      {
        const rawItems = Array.isArray(row.items) ? row.items : [row];
        if (!rawItems.length) throw new Error('At least one item is required.');
        const items = rawItems.map((raw: unknown) => {
          if (!raw || typeof raw !== 'object')
            throw new Error('Each item must be an object.');
          const item = raw as ImportRow;
          const description = text(item.description ?? item.item);
          if (!description) throw new Error('Item description is required.');
          const candidate = {
            id: uuid(),
            description,
            hsn: text(item.hsn ?? item.hsn_sac),
            quantity: numeric(item.quantity, 1, 'Quantity'),
            rate: numeric(item.rate ?? item.amount, NaN, 'Rate'),
            tax: numeric(
              item.tax_percent ?? item.tax,
              template?.taxRate ?? settings.defaultTax,
              'Tax percentage',
            ),
          };
          if (!Number.isFinite(candidate.rate))
            throw new Error('An item rate or amount is required.');
          const result = itemSchema.safeParse(candidate);
          if (!result.success)
            throw new Error(
              'Quantity must be positive, rate non-negative, and tax between 0 and 100.',
            );
          return result.data;
        });
        doc.items.push(...items);
      }
      if (fresh) groups.set(key, doc);
    } catch (e) {
      errors.push(`Row ${index + 2}: ${(e as Error).message}`);
    }
  }
  return { documents: [...groups.values()], errors };
}
export async function readImportFile(file: File): Promise<ImportRow[]> {
  if (file.size > 10 * 1024 * 1024)
    throw new Error('Choose a file smaller than 10 MB.');
  const ext = file.name.split('.').pop()?.toLowerCase();
  let rows: unknown;
  if (ext === 'json') {
    const parsed = JSON.parse(await file.text());
    rows = Array.isArray(parsed) ? parsed : (parsed.documents ?? parsed.rows);
  } else if (['xlsx', 'xls', 'csv'].includes(ext ?? '')) {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(await file.arrayBuffer(), {
      type: 'array',
      cellDates: true,
      // Read only the supported worksheet and enough rows to detect overflow.
      sheets: 0,
      sheetRows: 502,
    });
    if (!workbook.SheetNames.length)
      throw new Error('The workbook has no sheets.');
    rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
      defval: '',
    });
  } else throw new Error('Choose an Excel (.xlsx, .xls), CSV, or JSON file.');
  if (!Array.isArray(rows) || !rows.length)
    throw new Error('No rows found. Start with a sample file.');
  if (rows.length > 500) throw new Error('Import up to 500 rows at a time.');
  if (rows.some((r) => !r || typeof r !== 'object' || Array.isArray(r)))
    throw new Error('Each imported row must be an object.');
  return rows as ImportRow[];
}
export const sampleRows = [
  {
    document_key: 'A-101',
    customer_name: 'Aarav Sharma',
    customer_address: 'A-101, Greenview Society, Mumbai',
    unit: 'A-101',
    description: 'Monthly society maintenance',
    quantity: 1,
    rate: 2500,
    tax_percent: 0,
    hsn: '',
    state: 'Maharashtra',
    date: today(),
    due_date: '',
    email: '',
    phone: '',
    gst_id: '',
    vat_id: '',
    registration_number: '',
    pan: '',
    payment_method: 'Bank transfer',
    payment_reference: '',
    bank_details: '',
    payment_instructions: 'Include your flat number in the payment reference.',
    upi_id: '',
    upi_name: '',
    show_payment_details: true,
    show_upi_qr: false,
    upi_include_amount: true,
    rent_address: '',
    rent_from: '',
    rent_to: '',
    notes: '',
  },
  {
    document_key: 'A-102',
    customer_name: 'Priya Patel',
    customer_address: 'A-102, Greenview Society, Mumbai',
    unit: 'A-102',
    description: 'Monthly society maintenance',
    quantity: 1,
    rate: 2500,
    tax_percent: 0,
    hsn: '',
    state: 'Maharashtra',
    date: today(),
    due_date: '',
    email: '',
    phone: '',
    gst_id: '',
    vat_id: '',
    registration_number: '',
    pan: '',
    payment_method: 'Bank transfer',
    payment_reference: '',
    bank_details: '',
    payment_instructions: 'Include your flat number in the payment reference.',
    upi_id: '',
    upi_name: '',
    show_payment_details: true,
    show_upi_qr: false,
    upi_include_amount: true,
    rent_address: '',
    rent_from: '',
    rent_to: '',
    notes: '',
  },
];
export async function downloadSample(format: 'xlsx' | 'json') {
  const { download } = await import('./export');
  if (format === 'json') {
    download(
      JSON.stringify(sampleRows, null, 2),
      'billbook-import-sample.json',
    );
    return;
  }
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(sampleRows);
  sheet['!cols'] = Object.keys(sampleRows[0]).map((key) => ({
    wch: key.includes('address') ? 44 : Math.max(16, key.length + 3),
  }));
  XLSX.utils.book_append_sheet(workbook, sheet, 'Documents');
  download(
    new Blob([XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    'billbook-import-sample.xlsx',
  );
}
