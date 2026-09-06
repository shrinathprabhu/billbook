import type { BillDoc, Design } from '@/lib/billbook/model';
import { CheckField, TextField } from './fields';

type PaymentDetails = Pick<
  BillDoc,
  | 'bankDetails'
  | 'paymentInstructions'
  | 'upiId'
  | 'upiName'
  | 'upiIncludeAmount'
>;
type PaymentDesign = Pick<Design, 'showBank' | 'showUpiQr'>;
export default function PaymentDetailsFields({
  value,
  onChange,
  design,
  onDesignChange,
  currency,
}: {
  value: PaymentDetails;
  onChange: (value: PaymentDetails) => void;
  design: PaymentDesign;
  onDesignChange: (value: PaymentDesign) => void;
  currency: string;
}) {
  const set = <K extends keyof PaymentDetails>(
    key: K,
    next: PaymentDetails[K],
  ) =>
    onChange({
      bankDetails: value.bankDetails,
      paymentInstructions: value.paymentInstructions,
      upiId: value.upiId,
      upiName: value.upiName,
      upiIncludeAmount: value.upiIncludeAmount,
      [key]: next,
    });
  return (
    <div className="payment-fields">
      <h3>
        Where to pay <span className="optional-label">Optional</span>
      </h3>
      <CheckField
        label="Show bank details and payment instructions on the document"
        checked={design.showBank}
        onChange={(showBank) => onDesignChange({ ...design, showBank })}
      />
      <TextField
        label="Bank details"
        multiline
        value={value.bankDetails}
        onChange={(v) => set('bankDetails', v)}
        placeholder="Account holder, bank, account number and IFSC"
      />
      <TextField
        label="Payment instructions"
        multiline
        value={value.paymentInstructions}
        onChange={(v) => set('paymentInstructions', v)}
        placeholder="Where and how to pay; include your flat number as the reference."
      />
      <CheckField
        label="Show a UPI payment QR code"
        checked={design.showUpiQr}
        onChange={(showUpiQr) => onDesignChange({ ...design, showUpiQr })}
      />
      <div className="field-grid">
        <TextField
          label="Payee UPI ID"
          value={value.upiId}
          onChange={(v) => set('upiId', v.trim())}
          placeholder="yourname@bank"
          maxLength={128}
        />
        <TextField
          label="UPI payee name"
          value={value.upiName}
          onChange={(v) => set('upiName', v)}
          placeholder="Defaults to the business name"
          maxLength={100}
        />
      </div>
      <CheckField
        label="Include this document’s total in the QR code"
        checked={value.upiIncludeAmount}
        onChange={(v) => set('upiIncludeAmount', v)}
      />
      <p className="section-hint">
        {currency === 'INR'
          ? 'The QR updates with the bill total and works offline. Leave the amount unchecked to let the payer enter it.'
          : 'UPI QR codes are available for INR documents. Turn the QR off for other currencies.'}
      </p>
    </div>
  );
}
