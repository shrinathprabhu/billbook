'use client';
import { useState, useRef, useMemo, useEffect } from 'react';
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  Download,
  Check,
  FileJson,
  LoaderCircle,
  Layers2,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Choice, TextField, taxOptions } from './fields';
import {
  type BillDoc,
  type Settings,
  type Template,
  type DocType,
  typeNames,
  documentTypes,
  builtinTemplates,
  validateForExport,
} from '@/lib/billbook/model';
import {
  parseRows,
  downloadSample,
  type ImportRow,
} from '@/lib/billbook/import';
import { readImportOffThread } from '@/lib/billbook/import-client';
import { calculate, money } from '@/lib/billbook/calculations';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
export default function BulkImport({
  settings,
  templates,
  onGenerate,
  onOpen,
}: {
  settings: Settings;
  templates: Template[];
  onGenerate: (docs: BillDoc[]) => Promise<BillDoc[]>;
  onOpen: (d: BillDoc) => void;
}) {
  const [type, setType] = useState<DocType>('maintenance'),
    [templateId, setTemplateId] = useState('tpl-maintenance'),
    [rows, setRows] = useState<ImportRow[]>([]),
    [filename, setFilename] = useState(''),
    [fileError, setFileError] = useState(''),
    [busy, setBusy] = useState(false),
    [generated, setGenerated] = useState<BillDoc[]>([]),
    [drag, setDrag] = useState(false),
    [progress, setProgress] = useState(0),
    [taxMode, setTaxMode] = useState<BillDoc['taxMode']>(settings.taxMode),
    [taxRate, setTaxRate] = useState(settings.defaultTax),
    [status, setStatus] = useState<BillDoc['status']>('draft');
  const fileInput = useRef<HTMLInputElement>(null);
  const importRequest = useRef<AbortController | null>(null);
  useEffect(() => () => importRequest.current?.abort(), []);
  const allTemplates = [...builtinTemplates, ...templates],
    template = allTemplates.find((t) => t.id === templateId);
  const parsed = useMemo(() => {
    const result = rows.length
      ? parseRows(
          rows,
          type,
          settings,
          template ? { ...template, taxMode, taxRate } : undefined,
        )
      : { documents: [], errors: [] };
    result.documents = result.documents.map((d) => ({ ...d, status }));
    if (status !== 'draft')
      result.errors.push(
        ...result.documents.flatMap((d) =>
          validateForExport(d).map((e) => `${d.customer.name}: ${e}`),
        ),
      );
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100)
      result.errors.push('Set a default tax rate between 0 and 100.');
    return result;
  }, [rows, type, settings, template, taxMode, taxRate, status]);
  async function load(file: File | undefined) {
    if (!file) return;
    importRequest.current?.abort();
    const request = new AbortController();
    importRequest.current = request;
    setBusy(true);
    setFileError('');
    setGenerated([]);
    try {
      const result = await readImportOffThread(file, request.signal);
      setRows(result);
      setFilename(file.name);
    } catch (e) {
      if (request.signal.aborted) return;
      setFileError((e as Error).message);
      setRows([]);
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }
  async function generate() {
    setBusy(true);
    try {
      const result = await onGenerate(parsed.documents);
      setGenerated(result);
      toast.success(`${result.length} documents saved`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function exportAll() {
    setBusy(true);
    setProgress(0);
    try {
      const { exportBulk } = await import('@/lib/billbook/export');
      await exportBulk(generated, setProgress);
      toast.success('Your document bundle is ready');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ONE FILE. EVERYONE SORTED.</div>
          <h1>Bulk generate</h1>
          <p>A whole month of paperwork, in a few clicks.</p>
        </div>
        <span className="soft-tag">
          <ShieldCheck size={15} />
          Processed on your device
        </span>
      </div>
      <div className="bulk-layout">
        <div className="bulk-main">
          <section className="surface-card">
            <div className="step-heading">
              <span>1</span>
              <div>
                <h2>Choose your document</h2>
                <p>
                  Every row becomes a document. Matching keys combine line
                  items.
                </p>
              </div>
            </div>
            <div className="field-grid">
              <Choice
                label="Document type"
                value={type}
                onChange={(v) => {
                  setType(v as DocType);
                  setTemplateId(`tpl-${v}`);
                  setGenerated([]);
                }}
                options={documentTypes.map((t) => ({
                  value: t,
                  label: typeNames[t],
                }))}
              />
              <Choice
                label="Template"
                value={templateId}
                onChange={(v) => {
                  setTemplateId(v);
                  const selected = allTemplates.find((t) => t.id === v);
                  if (selected) {
                    setTaxMode(selected.taxMode);
                    setTaxRate(selected.taxRate);
                  }
                  setGenerated([]);
                }}
                options={allTemplates
                  .filter((t) => t.type === type)
                  .map((t) => ({ value: t.id, label: t.name }))}
              />
            </div>
            <div className="field-grid">
              <Choice
                label="Tax calculation"
                value={taxMode}
                onChange={(v) => {
                  setTaxMode(v as BillDoc['taxMode']);
                  setGenerated([]);
                }}
                options={taxOptions}
              />
              <TextField
                label="Default tax rate %"
                type="number"
                min={0}
                max={100}
                value={taxRate}
                onChange={(v) => {
                  setTaxRate(Number(v));
                  setGenerated([]);
                }}
              />
            </div>
            <Choice
              label="Save documents as"
              value={status}
              onChange={(v) => {
                setStatus(v as BillDoc['status']);
                setGenerated([]);
              }}
              options={[
                { value: 'draft', label: 'Draft · review before issuing' },
                { value: 'unpaid', label: 'Issued / unpaid' },
                { value: 'paid', label: 'Paid' },
              ]}
            />
          </section>
          <section className="surface-card">
            <div className="step-heading">
              <span>2</span>
              <div>
                <h2>Bring in your details</h2>
                <p>Excel, CSV, or JSON. No data leaves your browser.</p>
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              aria-label="Upload an Excel, CSV or JSON file"
              onClick={() => fileInput.current?.click()}
              className={'dropzone ' + (drag ? 'dragging' : '')}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                void load(e.dataTransfer.files[0]);
              }}
            >
              <span className="upload-badge">
                {busy ? (
                  <LoaderCircle size={25} className="spin" />
                ) : (
                  <Upload size={25} />
                )}
              </span>
              <strong>{filename || 'Drop your file here'}</strong>
              <span>
                or <u>browse files</u> on your device
              </span>
              <small>XLSX, XLS, CSV, JSON · up to 10 MB · 500 rows</small>
            </button>
            <input
              hidden
              type="file"
              ref={fileInput}
              tabIndex={-1}
              aria-label="Choose import file"
              disabled={busy}
              accept=".xlsx,.xls,.csv,.json"
              onChange={(e) => {
                void load(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            {fileError && (
              <div className="validation-box" role="alert">
                {fileError}
              </div>
            )}
            <div className="sample-downloads">
              <span>Need a starting point?</span>
              <button
                onClick={() =>
                  void downloadSample('xlsx').catch((e) =>
                    toast.error(e.message),
                  )
                }
              >
                <FileSpreadsheet size={16} />
                Excel sample
                <Download size={13} />
              </button>
              <button
                onClick={() =>
                  void downloadSample('json').catch((e) =>
                    toast.error(e.message),
                  )
                }
              >
                <FileJson size={16} />
                JSON sample
                <Download size={13} />
              </button>
            </div>
          </section>
          {rows.length > 0 && (
            <section className="surface-card">
              <div className="step-heading">
                <span>{generated.length ? <Check size={15} /> : 3}</span>
                <div>
                  <h2>
                    {generated.length
                      ? 'All together. All done.'
                      : 'Check before you generate'}
                  </h2>
                  <p>
                    {generated.length
                      ? `${generated.length} numbered documents are saved in your documents.`
                      : `${rows.length} rows → ${parsed.documents.length} documents`}
                  </p>
                </div>
              </div>
              {parsed.errors.length > 0 && (
                <div className="validation-box" role="alert">
                  <strong>Fix these rows before generating</strong>
                  <ul>
                    {parsed.errors.slice(0, 10).map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                  {parsed.errors.length > 10 && (
                    <span>…and {parsed.errors.length - 10} more</span>
                  )}
                </div>
              )}
              <div className="import-preview">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead className="amount-cell">Total</TableHead>
                      {generated.length > 0 && <TableHead />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(generated.length ? generated : parsed.documents)
                      .slice(0, 20)
                      .map((d) => (
                        <TableRow key={d.id}>
                          <TableCell>
                            <strong>{d.customer.name}</strong>
                            <small>{d.number || d.unit}</small>
                          </TableCell>
                          <TableCell>{d.items.length}</TableCell>
                          <TableCell className="amount-cell">
                            {money(calculate(d).total, d.currency)}
                          </TableCell>
                          {generated.length > 0 && (
                            <TableCell>
                              <button
                                className="text-button"
                                onClick={() => onOpen(d)}
                              >
                                Open
                                <ArrowRight size={14} />
                              </button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
              {parsed.documents.length > 20 && (
                <p className="section-hint">
                  Showing the first 20 of {parsed.documents.length} documents.
                </p>
              )}
              <div className="bulk-generate-action">
                {generated.length ? (
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() => void exportAll()}
                  >
                    {busy ? (
                      <LoaderCircle size={16} className="spin" />
                    ) : (
                      <Download size={16} />
                    )}
                    Download all PDFs + text{busy ? ` · ${progress}%` : ''}
                  </button>
                ) : (
                  <button
                    className="button primary"
                    disabled={
                      busy || !!parsed.errors.length || !parsed.documents.length
                    }
                    onClick={() => void generate()}
                  >
                    {busy ? (
                      <LoaderCircle size={16} className="spin" />
                    ) : (
                      <Layers2 size={16} />
                    )}
                    Generate {parsed.documents.length} documents
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </section>
          )}
        </div>
        <aside className="bulk-guide">
          <span className="template-icon green">
            <FileSpreadsheet size={23} />
          </span>
          <h3>A little structure goes a long way.</h3>
          <p>
            Start with our sample, replace the example rows, and bring it back
            here.
          </p>
          <div>
            <strong>The essentials</strong>
            <p>
              <code>customer_name</code>
              <br />
              <code>description</code>
              <br />
              <code>rate</code>
            </p>
          </div>
          <div>
            <strong>Make it your own</strong>
            <p>
              Add quantity, tax_percent, GST/VAT IDs, HSN codes, addresses, and
              payment details. Use payment_mode, bank_details,
              payment_instructions, upi_id, upi_name and show_upi_qr for payment
              options. Use registration_number for the customer’s business
              registration number.
            </p>
          </div>
          <div>
            <strong>More than one line item?</strong>
            <p>
              Give rows the same <code>document_key</code> to combine them. JSON
              also accepts an <code>items</code> array.
            </p>
          </div>
          <div>
            <strong>Rent receipts & cash documents</strong>
            <p>
              Rent uses rent_address, rent_from and rent_to. Cash memos and cash
              vouchers use line items, amounts and tax percentages, just like
              invoices.
            </p>
          </div>
          <span className="guide-note">
            <ShieldCheck size={17} />
            Choose drafts to review first, or issue completed documents
            together.
          </span>
        </aside>
      </div>
    </>
  );
}
