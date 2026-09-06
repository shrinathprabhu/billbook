import { z } from 'zod';
export const documentTypes = [
  'invoice',
  'receipt',
  'rent',
  'maintenance',
  'voucher',
  'memo',
] as const;
export type DocType = (typeof documentTypes)[number];
export const typeNames: Record<DocType, string> = {
  invoice: 'Invoice',
  receipt: 'Receipt',
  rent: 'Rent receipt',
  maintenance: 'Maintenance',
  voucher: 'Cash voucher',
  memo: 'Cash memo',
};
export const prefixes: Record<DocType, string> = {
  invoice: 'INV',
  receipt: 'REC',
  rent: 'RNT',
  maintenance: 'MNT',
  voucher: 'VCH',
  memo: 'MEM',
};
export const partySchema = z.object({
  name: z.string(),
  address: z.string(),
  email: z.string(),
  phone: z.string(),
  gst: z.string(),
  vat: z.string(),
  registration: z.string().default(''),
  pan: z.string(),
  state: z.string(),
});
export type Party = z.infer<typeof partySchema>;
export const emptyParty: Party = {
  name: '',
  address: '',
  email: '',
  phone: '',
  gst: '',
  vat: '',
  registration: '',
  pan: '',
  state: '',
};
const finitePositive = z.number().min(0).max(1e8);
export const itemSchema = z.object({
  id: z.string(),
  description: z.string(),
  hsn: z.string(),
  quantity: z.number().positive().max(10000),
  rate: finitePositive,
  tax: z.number().min(0).max(100),
});
export type Item = z.infer<typeof itemSchema>;
const dataImage = z
  .string()
  .refine(
    (s) => !s || /^data:image\/(png|jpeg|webp);base64,/.test(s),
    'Use a PNG, JPEG, or WebP image',
  );
export const designSchema = z.object({
  accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  text: z.string().regex(/^#[0-9a-f]{6}$/i),
  background: z.string().regex(/^#[0-9a-f]{6}$/i),
  font: z.string(),
  layout: z.enum(['modern', 'classic', 'minimal']),
  logo: dataImage,
  letterhead: dataImage,
  signature: dataImage,
  showSignature: z.boolean(),
  showBank: z.boolean(),
  showUpiQr: z.boolean().default(false),
  showNotes: z.boolean(),
  showStamp: z.boolean(),
  footer: z.string(),
  blocks: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(['text', 'divider', 'payment', 'terms']),
      label: z.string(),
      text: z.string(),
    }),
  ),
});
export type Design = z.infer<typeof designSchema>;
export const defaultDesign: Design = {
  accent: '#227852',
  text: '#28352e',
  background: '#ffffff',
  font: 'Inter',
  layout: 'modern',
  logo: '',
  letterhead: '',
  signature: '',
  showSignature: true,
  showBank: true,
  showUpiQr: false,
  showNotes: true,
  showStamp: false,
  footer: 'Thank you for your business.',
  blocks: [],
};
export const paymentFieldsSchema = {
  paymentInstructions: z.string().default(''),
  upiId: z.string().max(128).default(''),
  upiName: z.string().max(100).default(''),
  upiIncludeAmount: z.boolean().default(true),
};
export const defaultPaymentFields = {
  paymentInstructions: '',
  upiId: '',
  upiName: '',
  upiIncludeAmount: true,
};
export const validUpiId = (id: string) =>
  /^[A-Za-z0-9._-]{2,100}@[A-Za-z0-9.-]{2,64}$/.test(id.trim()) &&
  id.trim().length <= 128;
export const billSchema = z
  .object({
    id: z.string(),
    number: z.string(),
    type: z.enum(documentTypes),
    status: z.enum(['draft', 'unpaid', 'paid']),
    date: z.string(),
    dueDate: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    seller: partySchema,
    customer: partySchema,
    items: z.array(itemSchema).max(500),
    taxMode: z.enum(['none', 'gst', 'igst', 'vat', 'custom']),
    taxName: z.string(),
    taxInclusive: z.boolean(),
    discount: finitePositive,
    currency: z.enum(['INR', 'USD', 'EUR', 'GBP', 'AED']),
    notes: z.string(),
    terms: z.string(),
    paymentMethod: z.string(),
    paymentReference: z.string(),
    bankDetails: z.string(),
    ...paymentFieldsSchema,
    rentAddress: z.string(),
    rentFrom: z.string(),
    rentTo: z.string(),
    unit: z.string(),
    memoSubject: z.string(),
    memoBody: z.string(),
    voucherDirection: z.enum(['received', 'paid']),
    design: designSchema,
  })
  .refine(
    (d) =>
      d.items.reduce((n, i) => n + Math.round(i.quantity * i.rate * 100), 0) <=
      1e12,
    { message: 'The supported document limit is 10 billion currency units.' },
  );
export type BillDoc = z.infer<typeof billSchema>;
export const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(documentTypes),
  description: z.string(),
  design: designSchema,
  taxRate: z.number().min(0).max(100),
  taxMode: billSchema.shape.taxMode,
  notes: z.string(),
  terms: z.string(),
});
export type Template = z.infer<typeof templateSchema>;
export const settingsSchema = z.object({
  workspace: z.string(),
  seller: partySchema,
  currency: billSchema.shape.currency,
  prefix: z
    .string()
    .max(12)
    .regex(/^[A-Za-z0-9-]*$/),
  defaultTax: z.number().min(0).max(100),
  taxMode: billSchema.shape.taxMode,
  bankDetails: z.string(),
  ...paymentFieldsSchema,
  defaultDesign: designSchema,
});
export type Settings = z.infer<typeof settingsSchema>;
export const defaultSettings: Settings = {
  workspace: 'My workspace',
  seller: { ...emptyParty },
  currency: 'INR',
  prefix: 'INV',
  defaultTax: 0,
  taxMode: 'none',
  bankDetails: '',
  ...defaultPaymentFields,
  defaultDesign: { ...defaultDesign },
};
export const fonts = [
  { group: 'Sans serif', names: ['Inter', 'DM Sans', 'Manrope'] },
  { group: 'Serif', names: ['Lora', 'Libre Baskerville', 'Playfair Display'] },
  {
    group: 'Monospace',
    names: ['IBM Plex Mono', 'JetBrains Mono', 'Space Mono'],
  },
  { group: 'System classics', names: ['Arial', 'Georgia', 'Times New Roman'] },
];
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(value + 'T12:00:00Z').valueOf()) &&
    new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value
  );
}
export const today = () => new Date().toLocaleDateString('en-CA');
export const uuid = () => crypto.randomUUID();
export function newDocument(
  type: DocType,
  settings: Settings,
  template?: Template,
): BillDoc {
  const now = new Date().toISOString();
  const design = structuredClone(template?.design ?? settings.defaultDesign);
  // Built-in layouts use the workspace's payment defaults; custom templates
  // keep the display choices saved in the template studio.
  if (template?.id.startsWith('tpl-')) {
    design.showBank = settings.defaultDesign.showBank;
    design.showUpiQr = settings.defaultDesign.showUpiQr;
  }
  return {
    id: uuid(),
    number: '',
    type,
    status: 'draft',
    date: today(),
    dueDate: '',
    createdAt: now,
    updatedAt: now,
    seller: { ...settings.seller },
    customer: { ...emptyParty },
    items: [
      {
        id: uuid(),
        description:
          type === 'rent'
            ? 'Monthly rent'
            : type === 'maintenance'
              ? 'Monthly maintenance'
              : '',
        hsn: '',
        quantity: 1,
        rate: 0,
        tax: template?.taxRate ?? settings.defaultTax,
      },
    ],
    taxMode: template?.taxMode ?? settings.taxMode,
    taxName: 'Tax',
    taxInclusive: false,
    discount: 0,
    currency: settings.currency,
    notes: template?.notes ?? '',
    terms: template?.terms ?? '',
    paymentMethod:
      type === 'memo' || type === 'voucher' ? 'Cash' : 'Bank transfer',
    paymentReference: '',
    bankDetails: settings.bankDetails,
    paymentInstructions: settings.paymentInstructions,
    upiId: settings.upiId,
    upiName: settings.upiName,
    upiIncludeAmount: settings.upiIncludeAmount,
    rentAddress: '',
    rentFrom: '',
    rentTo: '',
    unit: '',
    memoSubject: '',
    memoBody: '',
    voucherDirection: 'received',
    design,
  };
}
export function validateForExport(doc: BillDoc): string[] {
  const parsed = billSchema.safeParse(doc);
  if (!parsed.success)
    return ['Please correct invalid item amounts, quantities, or tax rates.'];
  const errors: string[] = [];
  if (!doc.seller.name.trim()) errors.push('Add the business or issuer name.');
  if (!doc.customer.name.trim())
    errors.push('Add the customer or recipient name.');
  if (!validDate(doc.date)) errors.push('Choose a document date.');
  if (doc.dueDate && !validDate(doc.dueDate))
    errors.push('Choose a valid due date.');
  if (doc.dueDate && doc.dueDate < doc.date)
    errors.push('Due date must be on or after the document date.');
  if (doc.design.showUpiQr) {
    if (!validUpiId(doc.upiId))
      errors.push(
        'Add a valid payee UPI ID, such as yourname@bank, or turn off the UPI QR.',
      );
    if (!doc.upiName.trim() && !doc.seller.name.trim())
      errors.push('Add the UPI payee name.');
    if (doc.currency !== 'INR')
      errors.push(
        'UPI QR payments require INR. Change the currency or turn off the UPI QR.',
      );
  }
  if (!doc.items.length || doc.items.some((i) => !i.description.trim()))
    errors.push('Add a description for every item.');
  if (doc.items.reduce((n, i) => n + i.rate * i.quantity, 0) <= 0)
    errors.push('Add an item amount greater than zero.');
  if (doc.taxMode === 'gst' || doc.taxMode === 'igst') {
    if (
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(
        doc.seller.gst.toUpperCase(),
      )
    )
      errors.push('Add a valid 15-character business GSTIN.');
    if (!doc.seller.address.trim())
      errors.push('Add the business address for the tax invoice.');
    if (!doc.customer.state.trim())
      errors.push('Add the customer’s place of supply / state.');
    if (doc.items.some((i) => !i.hsn.trim()))
      errors.push('Add HSN / SAC codes for each tax invoice item.');
  }
  if (doc.taxMode === 'vat' && !doc.seller.vat.trim())
    errors.push('Add the business VAT ID.');
  if (doc.type === 'rent') {
    if (!doc.rentAddress.trim())
      errors.push('Add the rented property address.');
    if (!validDate(doc.rentFrom) || !validDate(doc.rentTo))
      errors.push('Add a valid rental period.');
    else if (doc.rentTo < doc.rentFrom)
      errors.push('Rental end date must follow the start date.');
  }
  const subtotal =
    doc.items.reduce((n, i) => n + Math.round(i.rate * i.quantity * 100), 0) /
    100;
  if (doc.discount > subtotal)
    errors.push('Discount cannot exceed the subtotal.');
  if (
    doc.design.showUpiQr &&
    doc.upiIncludeAmount &&
    Math.round((subtotal - doc.discount) * 100) <= 0
  )
    errors.push(
      'A UPI QR with an amount needs a positive bill total. Turn off the amount option for an open-amount QR.',
    );
  return errors;
}
export const builtinTemplates: Template[] = [
  {
    id: 'tpl-invoice',
    name: 'The everyday invoice',
    type: 'invoice',
    description: 'A clean, confident classic for your business.',
    design: defaultDesign,
    taxRate: 0,
    taxMode: 'none',
    notes: '',
    terms: 'Payment is due by the date shown above.',
  },
  {
    id: 'tpl-receipt',
    name: 'Little shop receipt',
    type: 'receipt',
    description: 'From morning chai to the weekly groceries.',
    design: {
      ...defaultDesign,
      accent: '#b98442',
      font: 'IBM Plex Mono',
      layout: 'minimal',
    },
    taxRate: 0,
    taxMode: 'none',
    notes: '',
    terms: '',
  },
  {
    id: 'tpl-rent',
    name: 'Home, sweet home',
    type: 'rent',
    description: 'Monthly rent, neatly acknowledged.',
    design: {
      ...defaultDesign,
      accent: '#8d75b2',
      font: 'Lora',
      layout: 'classic',
    },
    taxRate: 0,
    taxMode: 'none',
    notes: 'Rent received for the property and period specified.',
    terms: '',
  },
  {
    id: 'tpl-maintenance',
    name: 'A better community',
    type: 'maintenance',
    description: 'Monthly maintenance for every neighbour.',
    design: { ...defaultDesign, accent: '#577eae' },
    taxRate: 0,
    taxMode: 'none',
    notes: 'Please include your flat number in the payment reference.',
    terms: '',
  },
  {
    id: 'tpl-voucher',
    name: 'Every transaction counts',
    type: 'voucher',
    description: 'A cash voucher for money received or paid out.',
    design: { ...defaultDesign, accent: '#b26c86', layout: 'classic' },
    taxRate: 0,
    taxMode: 'none',
    notes: '',
    terms: '',
  },
  {
    id: 'tpl-memo',
    name: 'The everyday cash memo',
    type: 'memo',
    description: 'Itemized cash sales with quantities, prices and tax.',
    design: { ...defaultDesign, accent: '#a98c39', showSignature: true },
    taxRate: 0,
    taxMode: 'none',
    notes: '',
    terms: '',
  },
];
