import type { BillDoc } from './model';
import { typeNames } from './model';
import { upiPaymentUri } from './payment';
/** All monetary calculations use integer minor units. Discounts are allocated
 * proportionally before tax using the largest remainder method. */
export function calculate(
  doc: Pick<BillDoc, 'items' | 'discount' | 'taxMode' | 'taxInclusive'>,
) {
  const gross = doc.items.map((i) => Math.round(i.quantity * i.rate * 100));
  const subtotal = gross.reduce((a, b) => a + b, 0);
  const discount = Math.min(
    subtotal,
    Math.max(0, Math.round(doc.discount * 100)),
  );
  const shares = gross.map((amount) =>
    subtotal ? (discount * amount) / subtotal : 0,
  );
  const discounts = shares.map(Math.floor);
  let remainder = discount - discounts.reduce((a, b) => a + b, 0);
  const order = shares
    .map((amount, index) => ({ index, fraction: amount - discounts[index] }))
    .sort((a, b) => b.fraction - a.fraction);
  for (const entry of order) {
    if (remainder <= 0) break;
    discounts[entry.index]++;
    remainder--;
  }

  const lines = doc.items.map((item, index) => {
    const share = discounts[index];
    const amount = gross[index] - share;
    const rate = doc.taxMode === 'none' ? 0 : item.tax;
    const base = doc.taxInclusive
      ? Math.round(amount / (1 + rate / 100))
      : amount;
    const tax = doc.taxInclusive
      ? amount - base
      : Math.round((base * rate) / 100);
    return {
      gross: gross[index],
      discount: share,
      base,
      tax,
      total: base + tax,
    };
  });
  const taxable = lines.reduce((s, l) => s + l.base, 0),
    tax = lines.reduce((s, l) => s + l.tax, 0);
  const cgst = Math.floor(tax / 2),
    sgst = tax - cgst;
  const rates = new Map<
    number,
    { rate: number; taxable: number; tax: number; cgst: number; sgst: number }
  >();
  lines.forEach((line, index) => {
    const rate = doc.taxMode === 'none' ? 0 : doc.items[index].tax;
    const group = rates.get(rate) ?? {
      rate,
      taxable: 0,
      tax: 0,
      cgst: 0,
      sgst: 0,
    };
    group.taxable += line.base;
    group.tax += line.tax;
    rates.set(rate, group);
  });
  const taxBreakdown = [...rates.values()].sort((a, b) => a.rate - b.rate);
  let cgstRemainder =
    cgst - taxBreakdown.reduce((n, row) => n + Math.floor(row.tax / 2), 0);
  for (const row of taxBreakdown) {
    row.cgst = Math.floor(row.tax / 2);
    if (cgstRemainder > 0 && row.tax % 2) {
      row.cgst++;
      cgstRemainder--;
    }
    row.sgst = row.tax - row.cgst;
  }
  return {
    subtotal,
    discount,
    taxable,
    tax,
    cgst,
    sgst,
    total: taxable + tax,
    lines,
    taxBreakdown,
  };
}
export function taxRows(doc: BillDoc, totals = calculate(doc)) {
  if (doc.taxMode === 'none')
    return [{ label: 'Tax (not applied)', amount: 0 }];
  return totals.taxBreakdown.flatMap((row) =>
    doc.taxMode === 'gst'
      ? [
          { label: `CGST (${row.rate / 2}%)`, amount: row.cgst },
          { label: `SGST (${row.rate / 2}%)`, amount: row.sgst },
        ]
      : [
          {
            label: `${doc.taxMode === 'custom' ? doc.taxName || 'Tax' : doc.taxMode.toUpperCase()} (${row.rate}%)`,
            amount: row.tax,
          },
        ],
  );
}
export function money(minorUnits: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minorUnits / 100);
}
export function formatDate(value: string) {
  if (!value) return '—';
  const d = new Date(value + 'T12:00:00');
  return Number.isNaN(d.valueOf())
    ? value
    : d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
}
export function documentText(doc: BillDoc, copy = 'Original') {
  const t = calculate(doc);
  const uri = upiPaymentUri(doc, t.total);
  const party = (p: BillDoc['seller']) => [
    p.address,
    [p.email, p.phone].filter(Boolean).join(' · '),
    p.gst ? `GSTIN: ${p.gst}` : '',
    p.vat ? `VAT ID: ${p.vat}` : '',
    p.registration ? `Business registration number: ${p.registration}` : '',
    p.pan ? `PAN: ${p.pan}` : '',
  ];
  return [
    typeNames[doc.type].toUpperCase() + ' ' + doc.number,
    copy,
    `Date: ${formatDate(doc.date)}`,
    doc.dueDate ? `Due: ${formatDate(doc.dueDate)}` : '',
    `From: ${doc.seller.name}`,
    ...party(doc.seller),
    `${doc.type === 'voucher' ? (doc.voucherDirection === 'paid' ? 'Cash paid to' : 'Cash received from') : 'To'}: ${doc.customer.name}`,
    ...party(doc.customer),
    doc.customer.state ? `Place of supply: ${doc.customer.state}` : '',
    doc.unit ? `Unit / flat: ${doc.unit}` : '',
    doc.type === 'rent'
      ? `Property: ${doc.rentAddress}\nPeriod: ${formatDate(doc.rentFrom)} to ${formatDate(doc.rentTo)}`
      : '',
    ...doc.items.map(
      (i, n) =>
        `${i.description}${i.hsn ? ` (HSN/SAC ${i.hsn})` : ''} — ${i.quantity} × ${money(Math.round(i.rate * 100), doc.currency)} · Tax ${doc.taxMode === 'none' ? 0 : i.tax}%: ${money(t.lines[n].tax, doc.currency)} = ${money(t.lines[n].total, doc.currency)}`,
    ),
    `Subtotal${doc.taxInclusive ? ' (tax inclusive)' : ''}: ${money(t.subtotal, doc.currency)}`,
    `Discount: ${money(t.discount, doc.currency)}`,
    doc.taxMode !== 'none'
      ? `Taxable amount: ${money(t.taxable, doc.currency)}`
      : '',
    ...taxRows(doc, t).map(
      (row) => `${row.label}: ${money(row.amount, doc.currency)}`,
    ),
    `TOTAL: ${money(t.total, doc.currency)}`,
    `Status: ${doc.status.toUpperCase()}`,
    doc.paymentMethod ? `Payment mode: ${doc.paymentMethod}` : '',
    doc.paymentReference ? `Payment reference: ${doc.paymentReference}` : '',
    doc.design.showBank && doc.bankDetails
      ? `Bank details:\n${doc.bankDetails}`
      : '',
    doc.design.showBank && doc.paymentInstructions
      ? `Payment instructions:\n${doc.paymentInstructions}`
      : '',
    uri
      ? `UPI payee: ${doc.upiName.trim() || doc.seller.name}\nUPI ID: ${doc.upiId.trim()}\nPay by UPI: ${uri}`
      : '',
    [doc.memoSubject, doc.memoBody].filter(Boolean).join('\n'),
    doc.design.showNotes ? doc.notes : '',
    doc.terms,
    ...doc.design.blocks
      .filter((b) => b.kind !== 'divider')
      .map((b) => `${b.label}\n${b.text}`),
    doc.design.footer,
  ]
    .filter(Boolean)
    .join('\n\n');
}
