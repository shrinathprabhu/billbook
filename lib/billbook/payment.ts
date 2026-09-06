import type { BillDoc } from './model';
import { validUpiId } from './model';

export function upiPaymentUri(doc: BillDoc, amount: number): string | null {
  if (!doc.design.showUpiQr || doc.currency !== 'INR' || !validUpiId(doc.upiId))
    return null;
  const name = doc.upiName.trim() || doc.seller.name.trim();
  if (!name) return null;
  if (doc.upiIncludeAmount && (!Number.isSafeInteger(amount) || amount <= 0))
    return null;
  const values: Record<string, string> = {
    pa: doc.upiId.trim(),
    pn: name,
    cu: 'INR',
  };
  if (doc.upiIncludeAmount) values.am = (amount / 100).toFixed(2);
  if (doc.number) values.tn = doc.number.slice(0, 80);
  // Percent-encode each value: names/notes cannot introduce new payment parameters.
  return (
    'upi://pay?' +
    Object.entries(values)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&')
  );
}
