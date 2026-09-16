/* oxlint-disable next/no-img-element */
// Uploaded data URLs render locally without an image optimization service.
import { memo } from 'react';
import { type BillDoc, typeNames } from '@/lib/billbook/model';
import {
  calculate,
  formatDate,
  money,
  taxRows,
} from '@/lib/billbook/calculations';
import { upiPaymentUri } from '@/lib/billbook/payment';
import UpiQr from './upi-qr';
const DocumentPreview = memo(function DocumentPreview({
  doc,
  copy = 'Original',
}: {
  doc: BillDoc;
  copy?: string;
}) {
  const t = calculate(doc),
    d = doc.design,
    m = (n: number) => money(n, doc.currency);
  const paymentUri = upiPaymentUri(doc, t.total);
  return (
    <article
      className={`paper paper-${d.layout}`}
      style={
        {
          '--document-accent': d.accent,
          color: d.text,
          backgroundColor: d.background,
          fontFamily: `"${d.font}", sans-serif`,
        } as React.CSSProperties
      }
    >
      {d.letterhead && (
        <img
          className="letterhead pdf-block"
          src={d.letterhead}
          alt="Letterhead"
        />
      )}
      <div className="paper-header pdf-block">
        <div>
          {d.logo ? (
            <img src={d.logo} alt="Business logo" className="paper-logo" />
          ) : (
            <span className="paper-brand-mark">
              {(doc.seller.name || 'B').slice(0, 1)}
            </span>
          )}
          <h2>{doc.seller.name || 'Your business name'}</h2>
          <p>{doc.seller.address || 'Your business address'}</p>
          <p>
            {[doc.seller.email, doc.seller.phone].filter(Boolean).join(' · ')}
          </p>
          {doc.seller.gst && <p>GSTIN: {doc.seller.gst}</p>}
          {doc.seller.vat && <p>VAT ID: {doc.seller.vat}</p>}
          {doc.seller.registration && (
            <p>Business registration number: {doc.seller.registration}</p>
          )}
          {doc.seller.pan && <p>PAN: {doc.seller.pan}</p>}
        </div>
        <div className="paper-title">
          <h1>
            {doc.type === 'maintenance'
              ? 'Maintenance bill'
              : doc.type === 'invoice' && doc.taxMode !== 'none'
                ? 'Tax invoice'
                : typeNames[doc.type]}
          </h1>
          <strong>{doc.number || 'Assigned when saved'}</strong>
          <span>
            {copy}
            {doc.status === 'draft' ? ' · DRAFT' : ''}
          </span>
        </div>
      </div>
      <div className="paper-parties pdf-block">
        <div>
          <span className="paper-label">
            {doc.type === 'rent'
              ? 'RECEIVED FROM'
              : doc.type === 'voucher'
                ? doc.voucherDirection === 'paid'
                  ? 'CASH PAID TO'
                  : 'CASH RECEIVED FROM'
                : 'BILL TO'}
          </span>
          <h3>{doc.customer.name || 'Customer name'}</h3>
          <p>{doc.customer.address}</p>
          {doc.customer.email && <p>{doc.customer.email}</p>}
          {doc.customer.phone && <p>{doc.customer.phone}</p>}
          {doc.customer.gst && <p>GSTIN: {doc.customer.gst}</p>}
          {doc.customer.vat && <p>VAT ID: {doc.customer.vat}</p>}
          {doc.customer.registration && (
            <p>Business registration number: {doc.customer.registration}</p>
          )}
          {doc.customer.pan && <p>PAN: {doc.customer.pan}</p>}
          {doc.customer.state && <p>Place of supply: {doc.customer.state}</p>}
          {doc.unit && <p>Flat / unit: {doc.unit}</p>}
        </div>
        <dl>
          <div>
            <dt>Issue date</dt>
            <dd>{formatDate(doc.date)}</dd>
          </div>
          {doc.dueDate && (
            <div>
              <dt>Due date</dt>
              <dd>{formatDate(doc.dueDate)}</dd>
            </div>
          )}
          {doc.paymentMethod && (
            <div>
              <dt>Payment mode</dt>
              <dd>{doc.paymentMethod}</dd>
            </div>
          )}
          {doc.paymentReference && (
            <div>
              <dt>Reference</dt>
              <dd>{doc.paymentReference}</dd>
            </div>
          )}
        </dl>
      </div>
      {doc.type === 'rent' && (
        <div className="rent-summary pdf-block">
          <span className="paper-label">RENT ACKNOWLEDGEMENT</span>
          <p>
            Received {m(t.total)} from{' '}
            <strong>{doc.customer.name || 'the tenant'}</strong> towards rent
            for <strong>{doc.rentAddress || 'the rented property'}</strong>, for
            the period <strong>{formatDate(doc.rentFrom)}</strong> to{' '}
            <strong>{formatDate(doc.rentTo)}</strong>.
          </p>
        </div>
      )}
      <table className="paper-table">
        <thead>
          <tr className="pdf-block">
            <th>DESCRIPTION</th>
            <th>QTY</th>
            <th>RATE</th>
            <th>TAX</th>
            <th>LINE TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((i, n) => (
            <tr className="pdf-block" key={i.id}>
              <td>
                <strong>{i.description || 'Item description'}</strong>
                {i.hsn && <small>HSN / SAC: {i.hsn}</small>}
              </td>
              <td>{i.quantity}</td>
              <td>{m(Math.round(i.rate * 100))}</td>
              <td>
                {doc.taxMode === 'none' ? '0' : i.tax}%
                <small>{m(t.lines[n].tax)}</small>
              </td>
              <td>{m(t.lines[n].total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="paper-totals pdf-block">
        <div>
          <span>Subtotal{doc.taxInclusive ? ' (tax inclusive)' : ''}</span>
          <span>{m(t.subtotal)}</span>
        </div>
        {t.discount > 0 && (
          <div>
            <span>Discount</span>
            <span>− {m(t.discount)}</span>
          </div>
        )}
        {doc.taxMode !== 'none' && (
          <div>
            <span>Taxable amount</span>
            <span>{m(t.taxable)}</span>
          </div>
        )}
        {taxRows(doc, t).map((row) => (
          <div className="pdf-block" key={row.label}>
            <span>{row.label}</span>
            <span>{m(row.amount)}</span>
          </div>
        ))}
        <div className="grand-total">
          <strong>Total {doc.status === 'paid' ? 'paid' : 'amount'}</strong>
          <strong>{m(t.total)}</strong>
        </div>
      </div>
      {(doc.memoSubject || doc.memoBody) && (
        <section className="paper-extra pdf-block">
          <h4>{doc.memoSubject || 'Additional details'}</h4>
          <p>{doc.memoBody}</p>
        </section>
      )}
      {((d.showBank && (doc.bankDetails || doc.paymentInstructions)) ||
        paymentUri) && (
        <section className="paper-extra paper-payment pdf-block">
          <div>
            <h4>Payment details</h4>
            {d.showBank && doc.bankDetails && (
              <>
                <strong>Bank details</strong>
                <p>{doc.bankDetails}</p>
              </>
            )}
            {d.showBank && doc.paymentInstructions && (
              <>
                <strong>Payment instructions</strong>
                <p>{doc.paymentInstructions}</p>
              </>
            )}
            {paymentUri && (
              <>
                <strong>Pay by UPI</strong>
                <p>{doc.upiName.trim() || doc.seller.name}</p>
                <p>UPI ID: {doc.upiId.trim()}</p>
                <p>
                  {doc.upiIncludeAmount
                    ? `Amount: ${m(t.total)}`
                    : 'Enter the amount in your UPI app.'}
                </p>
              </>
            )}
          </div>
          {paymentUri && (
            <div className="paper-qr">
              <UpiQr value={paymentUri} />
              <span>Scan to pay by UPI</span>
            </div>
          )}
        </section>
      )}
      {d.showNotes && doc.notes && (
        <section className="paper-extra pdf-block">
          <h4>Notes</h4>
          <p>{doc.notes}</p>
        </section>
      )}
      {doc.terms && (
        <section className="paper-extra pdf-block">
          <h4>Terms & conditions</h4>
          <p>{doc.terms}</p>
        </section>
      )}
      {d.blocks.map((b) =>
        b.kind === 'divider' ? (
          <hr className="paper-divider pdf-block" key={b.id} />
        ) : (
          <section key={b.id} className="paper-extra pdf-block">
            <h4>{b.label}</h4>
            <p>{b.text}</p>
          </section>
        ),
      )}
      <div className="paper-signoff pdf-block">
        {d.showStamp && doc.status === 'paid' ? (
          <span className="paid-stamp">PAID</span>
        ) : (
          <span />
        )}
        {d.showSignature && (
          <div>
            {d.signature ? (
              <img src={d.signature} alt="Authorized signature" />
            ) : (
              <div className="signature-space" />
            )}
            <span>
              {doc.type === 'rent'
                ? 'Landlord’s signature'
                : 'Authorized signature'}
            </span>
          </div>
        )}
      </div>
      <footer className="paper-footer pdf-block">{d.footer}</footer>
    </article>
  );
});
export default DocumentPreview;
