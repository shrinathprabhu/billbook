'use client';
import { useState, useEffect } from 'react';
import { useForm, type PathValue } from 'react-hook-form';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Download,
  ChevronDown,
  Image,
  Copy,
  Share2,
  FileText,
  Check,
  Eye,
  Palette,
  List,
  Building2,
  LoaderCircle,
  Printer,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  type BillDoc,
  type Settings,
  type Template,
  billSchema,
  typeNames,
  uuid,
  validateForExport,
} from '@/lib/billbook/model';
import { type CustomFont } from '@/lib/billbook/storage';
import { calculate, money } from '@/lib/billbook/calculations';
import {
  TextField,
  Choice,
  PartyFields,
  CheckField,
  taxOptions,
} from './fields';
import DesignControls from './design-controls';
import DocumentPreview from './document-preview';
import PaymentDetailsFields from './payment-details';
export default function Editor({
  initial,
  settings,
  customFonts,
  onSave,
  onBack,
  onFontUpload,
  onSaveTemplate,
  onDraftChange,
}: {
  initial: BillDoc;
  settings: Settings;
  customFonts: CustomFont[];
  onSave: (doc: BillDoc) => Promise<BillDoc>;
  onBack: () => void;
  onFontUpload: (f: File) => Promise<void>;
  onSaveTemplate: (t: Template) => Promise<void>;
  onDraftChange: (doc: BillDoc, dirty: boolean) => void;
}) {
  const form = useForm<BillDoc>({
    defaultValues: initial,
  });
  const doc = form.watch();
  const [busy, setBusy] = useState(false),
    [tab, setTab] = useState('details'),
    [copy, setCopy] = useState('Original'),
    [saved, setSaved] = useState(initial.number ? JSON.stringify(initial) : ''),
    [errors, setErrors] = useState<string[]>([]),
    [leave, setLeave] = useState(false),
    [mobilePreview, setMobilePreview] = useState(false);
  const dirty = JSON.stringify(doc) !== saved;
  useEffect(() => onDraftChange(doc, dirty), [doc, dirty, onDraftChange]);
  const set = <K extends keyof BillDoc>(key: K, value: BillDoc[K]) =>
    form.setValue(key, value as PathValue<BillDoc, K>, { shouldDirty: true });
  const total = calculate(doc);
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', fn);
    return () => window.removeEventListener('beforeunload', fn);
  }, [dirty]);
  async function save() {
    const parsed = billSchema.safeParse(doc);
    if (!parsed.success) {
      setErrors([
        'Check your item quantities, amounts and tax rates. Quantities must be greater than zero.',
      ]);
      return null;
    }
    if (doc.status !== 'draft') {
      const found = validateForExport(doc);
      if (found.length) {
        setErrors(found);
        return null;
      }
    }
    const result = await onSave(doc);
    form.reset(result);
    setSaved(JSON.stringify(result));
    setErrors([]);
    return result;
  }
  async function saveClick() {
    setBusy(true);
    try {
      if (await save()) toast.success('Document saved on this device');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function doExport(
    format: 'pdf' | 'png' | 'text' | 'share' | 'print',
    both = false,
  ) {
    const found = validateForExport(doc);
    if (found.length) {
      setErrors(found);
      toast.error('A few details are missing. See the editor.');
      setMobilePreview(false);
      return;
    }
    if (format === 'share') {
      try {
        const { documentText } = await import('@/lib/billbook/calculations');
        const text = documentText(doc, copy);
        if (navigator.share) {
          await navigator.share({
            title: doc.number || typeNames[doc.type],
            text,
          });
        } else {
          await navigator.clipboard.writeText(text);
          toast.success('Document text copied — paste it into any app');
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError')
          toast.error((e as Error).message);
      }
      return;
    }
    setBusy(true);
    try {
      const result = await save();
      if (!result) return;
      const { exportDocument } = await import('@/lib/billbook/export');
      await exportDocument(
        result,
        format,
        both ? ['Customer copy', 'Seller copy'] : [copy],
      );
      toast.success(
        format === 'text'
          ? 'Document text copied'
          : format === 'print'
            ? 'PDF downloaded. Open it to print.'
            : `${format.toUpperCase()} downloaded`,
      );
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveAsTemplate() {
    try {
      const t: Template = {
        id: uuid(),
        name: `${typeNames[doc.type]} · ${doc.design.font}`,
        type: doc.type,
        description: 'Your custom template',
        design: structuredClone(doc.design),
        taxRate: doc.items[0]?.tax ?? 0,
        taxMode: doc.taxMode,
        notes: doc.notes,
        terms: doc.terms,
      };
      await onSaveTemplate(t);
      toast.success('Saved to your templates');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <div className="editor">
      <div className="editor-top">
        <div className="editor-title">
          <button
            className="icon-button"
            onClick={() => (dirty ? setLeave(true) : onBack())}
            aria-label="Back to documents"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1>{doc.number || `New ${typeNames[doc.type].toLowerCase()}`}</h1>
            <span className="editor-save-state">
              {saved && !dirty ? (
                <>
                  <Check size={12} />
                  Saved on this device
                </>
              ) : (
                <>Unsaved {doc.status === 'draft' ? 'draft' : 'changes'}</>
              )}
            </span>
          </div>
        </div>
        <div className="editor-actions">
          <button
            className="button secondary preview-toggle"
            onClick={() => setMobilePreview(!mobilePreview)}
          >
            <Eye size={16} />
            {mobilePreview ? 'Edit' : 'Preview'}
          </button>
          <button
            className="button secondary"
            disabled={busy}
            onClick={saveClick}
          >
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Save size={16} />
            )}
            Save
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger className="button primary" disabled={busy}>
              <Download size={16} />
              Export
              <ChevronDown size={14} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="action-menu">
              <DropdownMenuItem onClick={() => void doExport('pdf')}>
                <FileText />
                Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void doExport('pdf', true)}>
                <Copy />
                PDF · customer & seller copies
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void doExport('png')}>
                <Image />
                Download image (PNG)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void doExport('text')}>
                <Copy />
                Copy as text
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void doExport('print')}>
                <Printer />
                Prepare PDF for printing
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void doExport('share')}>
                <Share2 />
                Share document
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div
        className={
          'editor-layout ' + (mobilePreview ? 'show-mobile-preview' : '')
        }
      >
        <div className="editor-form">
          <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
            <TabsList className="editor-tabs" variant="line">
              <TabsTrigger value="details">
                <Building2 size={15} />
                Details
              </TabsTrigger>
              <TabsTrigger value="items">
                <List size={15} />
                Items & tax
              </TabsTrigger>
              <TabsTrigger value="design">
                <Palette size={15} />
                Design
              </TabsTrigger>
            </TabsList>
            {errors.length > 0 && (
              <div className="validation-box" role="alert">
                <strong>A few details to finish</strong>
                <ul>
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            <TabsContent value="details">
              <div className="form-section">
                <h3>Document details</h3>
                <div className="field-grid">
                  <TextField
                    label="Document number"
                    value={doc.number}
                    onChange={(v) => set('number', v)}
                    placeholder="Auto-assigned on save"
                    hint="Leave blank for automatic numbering."
                  />
                  <Choice
                    label="Status"
                    value={doc.status}
                    onChange={(v) => set('status', v as BillDoc['status'])}
                    options={[
                      { value: 'draft', label: 'Draft' },
                      {
                        value: 'unpaid',
                        label: 'Unpaid / issued',
                      },
                      { value: 'paid', label: 'Paid' },
                    ]}
                  />
                  <TextField
                    label="Issue date *"
                    type="date"
                    value={doc.date}
                    onChange={(v) => set('date', v)}
                  />
                  <TextField
                    label="Due date"
                    type="date"
                    value={doc.dueDate}
                    onChange={(v) => set('dueDate', v)}
                  />
                </div>
                {doc.type === 'maintenance' && (
                  <TextField
                    label="Flat / unit number"
                    value={doc.unit}
                    onChange={(v) => set('unit', v)}
                    placeholder="A-101"
                  />
                )}
                {doc.type === 'voucher' && (
                  <Choice
                    label="Transaction direction"
                    value={doc.voucherDirection}
                    onChange={(v) =>
                      set('voucherDirection', v as BillDoc['voucherDirection'])
                    }
                    options={[
                      { value: 'received', label: 'Cash received' },
                      { value: 'paid', label: 'Cash paid out' },
                    ]}
                  />
                )}
              </div>
              <PartyFields
                party={doc.seller}
                onChange={(p) => set('seller', p)}
                label={
                  doc.type === 'rent'
                    ? 'Landlord details'
                    : 'From · your business'
                }
              />
              <PartyFields
                party={doc.customer}
                onChange={(p) => set('customer', p)}
                label={doc.type === 'rent' ? 'Tenant details' : 'To · customer'}
              />
              {doc.type === 'rent' && (
                <div className="form-section">
                  <h3>A place called home</h3>
                  <TextField
                    label="Rented property address *"
                    multiline
                    value={doc.rentAddress}
                    onChange={(v) => set('rentAddress', v)}
                  />
                  <div className="field-grid">
                    <TextField
                      label="Rent period from *"
                      type="date"
                      value={doc.rentFrom}
                      onChange={(v) => set('rentFrom', v)}
                    />
                    <TextField
                      label="Rent period to *"
                      type="date"
                      value={doc.rentTo}
                      onChange={(v) => set('rentTo', v)}
                    />
                  </div>
                </div>
              )}
              <div className="form-section">
                <h3>Payment & other details</h3>
                <div className="field-grid">
                  <Choice
                    label="Payment mode"
                    value={doc.paymentMethod}
                    onChange={(v) => set('paymentMethod', v)}
                    options={[
                      'Bank transfer',
                      'UPI',
                      'Cash',
                      'Card',
                      'Cheque',
                      'Other',
                    ]}
                  />
                  <TextField
                    label="Payment reference"
                    value={doc.paymentReference}
                    onChange={(v) => set('paymentReference', v)}
                  />
                </div>
                <PaymentDetailsFields
                  value={doc}
                  onChange={(value) => {
                    set('bankDetails', value.bankDetails);
                    set('paymentInstructions', value.paymentInstructions);
                    set('upiId', value.upiId);
                    set('upiName', value.upiName);
                    set('upiIncludeAmount', value.upiIncludeAmount);
                  }}
                  design={doc.design}
                  onDesignChange={(value) =>
                    set('design', { ...doc.design, ...value })
                  }
                  currency={doc.currency}
                />
                {(doc.memoSubject || doc.memoBody) && (
                  <>
                    <TextField
                      label="Saved note heading"
                      value={doc.memoSubject}
                      onChange={(v) => set('memoSubject', v)}
                    />
                    <TextField
                      label="Saved note"
                      multiline
                      value={doc.memoBody}
                      onChange={(v) => set('memoBody', v)}
                    />
                  </>
                )}
                <TextField
                  label="Notes"
                  value={doc.notes}
                  onChange={(v) => set('notes', v)}
                  multiline
                />
                <TextField
                  label="Terms & conditions"
                  value={doc.terms}
                  onChange={(v) => set('terms', v)}
                  multiline
                />
              </div>
            </TabsContent>
            <TabsContent value="items">
              <div className="form-section">
                <div className="form-section-heading">
                  <h3>Line items</h3>
                  <span>
                    {doc.items.length}{' '}
                    {doc.items.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
                {doc.items.map((item, index) => (
                  <div className="line-item" key={item.id}>
                    <div className="line-item-heading">
                      <span>ITEM {String(index + 1).padStart(2, '0')}</span>
                      <button
                        className="icon-button"
                        aria-label={`Remove item ${index + 1}`}
                        disabled={doc.items.length === 1}
                        onClick={() =>
                          set(
                            'items',
                            doc.items.filter((i) => i.id !== item.id),
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <TextField
                      label="Description *"
                      value={item.description}
                      onChange={(v) =>
                        set(
                          'items',
                          doc.items.map((i) =>
                            i.id === item.id ? { ...i, description: v } : i,
                          ),
                        )
                      }
                      placeholder="Product or service name"
                    />
                    <div className="item-numbers">
                      {(
                        [
                          {
                            key: 'quantity',
                            label: 'Quantity',
                            min: 0.001,
                          },
                          { key: 'rate', label: 'Unit price', min: 0 },
                          { key: 'tax', label: 'Tax %', min: 0 },
                        ] as const
                      ).map((f) => (
                        <TextField
                          key={f.key}
                          label={f.label}
                          type="number"
                          min={f.min}
                          max={f.key === 'tax' ? 100 : undefined}
                          step="any"
                          value={item[f.key]}
                          onChange={(v) =>
                            set(
                              'items',
                              doc.items.map((i) =>
                                i.id === item.id
                                  ? {
                                      ...i,
                                      [f.key]: v === '' ? 0 : Number(v),
                                    }
                                  : i,
                              ),
                            )
                          }
                        />
                      ))}
                    </div>
                    <div className="field-grid">
                      <TextField
                        label="HSN / SAC code"
                        value={item.hsn}
                        onChange={(v) =>
                          set(
                            'items',
                            doc.items.map((i) =>
                              i.id === item.id ? { ...i, hsn: v } : i,
                            ),
                          )
                        }
                        placeholder="For tax invoices"
                      />
                      <div className="item-amount">
                        <span>Item amount</span>
                        <strong>
                          {money(total.lines[index].total, doc.currency)}
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  className="button secondary add-item"
                  onClick={() =>
                    set('items', [
                      ...doc.items,
                      {
                        id: uuid(),
                        description: '',
                        hsn: '',
                        quantity: 1,
                        rate: 0,
                        tax: doc.items[0]?.tax ?? settings.defaultTax,
                      },
                    ])
                  }
                >
                  <Plus size={16} />
                  Add line item
                </button>
              </div>
              <div className="form-section">
                <h3>Tax & totals</h3>
                <Choice
                  label="Tax calculation"
                  value={doc.taxMode}
                  onChange={(v) => set('taxMode', v as BillDoc['taxMode'])}
                  options={taxOptions}
                />
                {doc.taxMode === 'custom' && (
                  <TextField
                    label="Tax label"
                    value={doc.taxName}
                    onChange={(v) => set('taxName', v)}
                  />
                )}
                <p className="section-hint">
                  Set the tax percentage on each item. Use the rate appropriate
                  for your transaction.
                </p>
                <CheckField
                  label="Item prices already include tax"
                  checked={doc.taxInclusive}
                  onChange={(v) => set('taxInclusive', v)}
                />
                <div className="field-grid">
                  <TextField
                    label="Discount (fixed amount)"
                    type="number"
                    min={0}
                    step="0.01"
                    value={doc.discount}
                    onChange={(v) => set('discount', Number(v))}
                  />
                  <Choice
                    label="Currency"
                    value={doc.currency}
                    onChange={(v) => set('currency', v as BillDoc['currency'])}
                    options={['INR', 'USD', 'EUR', 'GBP', 'AED']}
                  />
                </div>
                <div className="editor-total">
                  <span>Document total</span>
                  <strong>{money(total.total, doc.currency)}</strong>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="design">
              <DesignControls
                design={doc.design}
                onChange={(d) => set('design', d)}
                customFonts={customFonts}
                onFontUpload={onFontUpload}
              />
              <div className="form-section">
                <button
                  className="button secondary add-item"
                  onClick={() => void saveAsTemplate()}
                >
                  <Save size={16} />
                  Save design as a template
                </button>
                <p className="section-hint">
                  Reuse this design, tax setup, notes, and terms.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <div className="preview-pane">
          <div className="preview-toolbar">
            <span>
              <span className="status-dot" />
              Live preview
            </span>
            <Choice
              label="Copy"
              value={copy}
              onChange={setCopy}
              options={[
                'Original',
                'Customer copy',
                'Seller copy',
                'Office copy',
              ]}
            />
            <span>A4</span>
          </div>
          <div className="paper-scroll">
            <DocumentPreview doc={doc} copy={copy} />
          </div>
          <div className="preview-footnote">
            Your details. Your design. Ready to share.
          </div>
        </div>
      </div>
      <AlertDialog open={leave} onOpenChange={setLeave}>
        <AlertDialogContent>
          <AlertDialogTitle>Keep your changes?</AlertDialogTitle>
          <AlertDialogDescription>
            This document has changes that haven’t been saved yet.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <button className="button secondary" onClick={onBack}>
              Discard
            </button>
            <AlertDialogAction
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  if (await save()) onBack();
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save & close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
