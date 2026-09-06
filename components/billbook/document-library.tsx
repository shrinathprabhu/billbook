'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Search,
  FileText,
  Upload,
  MoreHorizontal,
  ShieldCheck,
  HardDrive,
  CircleCheck,
  Wallet,
  Clock3,
  Download,
  Copy,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowDownUp,
  LoaderCircle,
} from 'lucide-react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  type BillDoc,
  type DocType,
  type Settings,
  typeNames,
  documentTypes,
} from '@/lib/billbook/model';
import { calculate, money, formatDate } from '@/lib/billbook/calculations';
import { typeMeta } from './templates';
import { Choice } from './fields';
import { toast } from 'sonner';
export default function DocumentLibrary({
  documents,
  settings,
  onCreate,
  onOpen,
  onBulk,
  onTemplates,
  onDuplicate,
  onDelete,
  onPaid,
  loading,
}: {
  documents: BillDoc[];
  settings: Settings;
  onCreate: (t?: DocType) => void;
  onOpen: (d: BillDoc) => void;
  onBulk: () => void;
  onTemplates: () => void;
  onDuplicate: (d: BillDoc) => void;
  onDelete: (d: BillDoc) => void;
  onPaid: (d: BillDoc) => void;
  loading: boolean;
}) {
  const [tab, setTab] = useState('all'),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState('all'),
    [sorting, setSorting] = useState<SortingState>([
      { id: 'date', desc: true },
    ]),
    [selection, setSelection] = useState<RowSelectionState>({}),
    [exporting, setExporting] = useState(false),
    [progress, setProgress] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);
  const filtered = useMemo(
    () =>
      documents.filter(
        (d) =>
          (tab === 'all' ||
            (tab === 'invoice' && d.type === 'invoice') ||
            (tab === 'receipt' &&
              (d.type === 'receipt' || d.type === 'rent')) ||
            (tab === 'other' &&
              !['invoice', 'receipt', 'rent'].includes(d.type))) &&
          (status === 'all' || d.status === status) &&
          `${d.number} ${d.customer.name} ${d.seller.name} ${typeNames[d.type]} ${d.unit}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [documents, tab, status, search],
  );
  const current = documents.filter(
    (d) =>
      d.currency === settings.currency &&
      !(d.type === 'voucher' && d.voucherDirection === 'paid'),
  );
  const issued = current.filter((d) => d.status !== 'draft'),
    paid = current.filter((d) => d.status === 'paid'),
    unpaid = current.filter((d) => d.status === 'unpaid');
  const sum = (list: BillDoc[]) =>
    list.reduce((n, d) => n + calculate(d).total, 0);
  const drafts = documents.filter((d) => d.status === 'draft');
  async function downloadDoc(doc: BillDoc) {
    setExporting(true);
    try {
      const { exportDocument } = await import('@/lib/billbook/export');
      await exportDocument(doc, 'pdf');
      toast.success('PDF downloaded');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  const columns: ColumnDef<BillDoc>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all documents on this page"
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(v)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Select ${row.original.number}`}
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(v)}
        />
      ),
      enableSorting: false,
    },
    {
      id: 'number',
      accessorKey: 'number',
      header: 'Document',
      cell: ({ row }) => {
        const d = row.original,
          meta = typeMeta[d.type];
        return (
          <button
            className="document-name"
            aria-label={`Open ${d.number}`}
            onClick={() => onOpen(d)}
          >
            <span className={'document-type-icon ' + meta.color}>
              <meta.icon size={19} />
            </span>
            <span>
              <strong>{d.number}</strong>
              <small>{typeNames[d.type]}</small>
            </span>
          </button>
        );
      },
    },
    {
      id: 'customer',
      accessorFn: (d) => d.customer.name,
      header: 'To / From',
      cell: ({ row }) => (
        <div className="recipient-cell">
          <strong>{row.original.customer.name || 'No recipient yet'}</strong>
          <small>
            {row.original.unit ||
              row.original.customer.email ||
              row.original.seller.name}
          </small>
        </div>
      ),
    },
    {
      id: 'date',
      accessorKey: 'date',
      header: ({ column }) => (
        <button
          className="sort-button"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Date
          <ArrowDownUp size={12} />
        </button>
      ),
      cell: ({ row }) => (
        <span className="date-cell">{formatDate(row.original.date)}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <span className={'document-status ' + row.original.status}>
          <span />
          {row.original.status === 'unpaid'
            ? 'Unpaid'
            : row.original.status === 'paid'
              ? 'Paid'
              : 'Draft'}
        </span>
      ),
    },
    {
      id: 'amount',
      header: () => <span className="amount-header">Amount</span>,
      cell: ({ row }) => (
        <span className="document-amount">
          {money(calculate(row.original).total, row.original.currency)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="icon-button"
            aria-label={`Actions for ${row.original.number}`}
          >
            <MoreHorizontal size={18} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="action-menu">
            <DropdownMenuItem onClick={() => onOpen(row.original)}>
              <FileText />
              Open document
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(row.original)}>
              <Copy />
              Duplicate
            </DropdownMenuItem>
            {row.original.status !== 'paid' && (
              <DropdownMenuItem onClick={() => onPaid(row.original)}>
                <Check />
                Mark as paid
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              disabled={exporting}
              onClick={() => void downloadDoc(row.original)}
            >
              <Download />
              Download PDF
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(row.original)}
            >
              <Trash2 />
              Delete document
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, rowSelection: selection },
    onSortingChange: setSorting,
    onRowSelectionChange: setSelection,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } },
    enableRowSelection: true,
  });
  const selected = table.getSelectedRowModel().rows.map((r) => r.original);
  async function exportSelected() {
    setExporting(true);
    setProgress(0);
    try {
      const { exportBulk } = await import('@/lib/billbook/export');
      await exportBulk(selected, setProgress);
      toast.success('Document bundle downloaded');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A LITTLE LESS PAPERWORK</div>
          <h1>Invoice &amp; receipt generator</h1>
          <p>
            Free, offline paperwork. From your corner shop to your housing
            society.
          </p>
        </div>
        <div className="heading-actions">
          <button className="button secondary" onClick={onBulk}>
            <Upload size={16} />
            Bulk generate
          </button>
          <button className="button primary" onClick={() => onCreate()}>
            <Plus size={18} />
            New document
          </button>
        </div>
      </div>
      <div className="stats-grid">
        {[
          {
            label: 'Total billed',
            value: money(sum(issued), settings.currency),
            note: `Across ${issued.length} issued ${settings.currency} documents`,
            icon: Wallet,
            color: 'green',
          },
          {
            label: 'Collected',
            value: money(sum(paid), settings.currency),
            note: `${paid.length} paid documents`,
            icon: CircleCheck,
            color: 'green',
          },
          {
            label: 'Outstanding',
            value: money(sum(unpaid), settings.currency),
            note: `${unpaid.length} awaiting payment`,
            icon: Clock3,
            color: 'orange',
          },
          {
            label: 'Drafts',
            value: String(drafts.length),
            note: 'Ready when you are',
            icon: FileText,
            color: 'gray',
          },
        ].map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-top">
              <span>{s.label}</span>
              <s.icon size={18} className={'text-' + s.color} />
            </div>
            <strong>{s.value}</strong>
            <span className="stat-note">{s.note}</span>
          </div>
        ))}
      </div>
      <section className="quick-create">
        <div className="section-heading">
          <div>
            <h2>A fresh start, without the blank page.</h2>
            <p>Pick a template. Add your details. Done.</p>
          </div>
          <button className="text-button" onClick={onTemplates}>
            Explore templates
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="template-grid">
          {documentTypes.map((type) => {
            const t = typeMeta[type];
            return (
              <button
                key={type}
                className="template-card"
                onClick={() => onCreate(type)}
              >
                <span className={'template-icon ' + t.color}>
                  <t.icon size={22} />
                </span>
                <strong>{t.name}</strong>
                <span>{t.desc}</span>
                <span className="template-arrow">
                  <ArrowUpRight size={17} />
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <section className="documents-section">
        <div className="section-heading">
          <h2>
            All documents <span className="count-chip">{documents.length}</span>
          </h2>
          <div className="small-muted">
            <HardDrive size={14} />
            Saved locally
          </div>
        </div>
        <div className="table-toolbar">
          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(String(v));
              setSelection({});
            }}
          >
            <TabsList variant="line" className="document-tabs">
              {[
                { id: 'all', name: 'All documents' },
                { id: 'invoice', name: 'Invoices' },
                { id: 'receipt', name: 'Receipts' },
                { id: 'other', name: 'Other' },
              ].map((t) => (
                <TabsTrigger key={t.id} value={t.id}>
                  {t.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="table-controls">
            {documents.length > 0 && (
              <div className="status-filter">
                <Choice
                  label="Filter status"
                  value={status}
                  onChange={(v) => {
                    setStatus(v);
                    setSelection({});
                  }}
                  options={[
                    { value: 'all', label: 'All status' },
                    { value: 'draft', label: 'Drafts' },
                    { value: 'paid', label: 'Paid' },
                    { value: 'unpaid', label: 'Unpaid / issued' },
                  ]}
                />
              </div>
            )}
            <div className="table-search">
              <Search size={16} />
              <input
                ref={searchRef}
                aria-label="Search documents"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelection({});
                }}
                placeholder="Search documents…"
              />
              <span>⌘ K</span>
            </div>
          </div>
        </div>
        {selected.length > 0 && (
          <div className="selection-bar">
            <span>
              <Check size={15} />
              {selected.length} selected
            </span>
            <button
              className="text-button"
              disabled={exporting}
              onClick={() => void exportSelected()}
            >
              {exporting ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <Download size={15} />
              )}
              Export PDF bundle{exporting ? ` · ${progress}%` : ''}
            </button>
            <button className="text-button" onClick={() => setSelection({})}>
              Clear
            </button>
          </div>
        )}
        <div className="document-table">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={
                        header.column.id === 'select' ? 'checkbox-cell' : ''
                      }
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? 'selected' : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={
                          cell.column.id === 'select'
                            ? 'checkbox-cell'
                            : undefined
                        }
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length}>
                    <div className="empty-documents">
                      <span className="empty-icon">
                        <FileText size={29} />
                        <span>
                          <Plus size={12} />
                        </span>
                      </span>
                      <h3>
                        {loading
                          ? 'Opening your workspace…'
                          : documents.length
                            ? 'No documents found'
                            : 'Your first document starts here'}
                      </h3>
                      <p>
                        {documents.length ? (
                          'Try a different search or filter.'
                        ) : (
                          <>
                            Create a professional bill in minutes.
                            <br />
                            We’ll keep it safe, right here on your device.
                          </>
                        )}
                      </p>
                      {!loading &&
                        (documents.length ? (
                          <button
                            className="button secondary"
                            onClick={() => {
                              setSearch('');
                              setStatus('all');
                              setTab('all');
                            }}
                          >
                            Clear filters
                          </button>
                        ) : (
                          <button
                            className="button secondary"
                            onClick={() => onCreate()}
                          >
                            <Plus size={16} />
                            Create a document
                          </button>
                        ))}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="table-footer">
            <span>
              {filtered.length}{' '}
              {filtered.length === 1 ? 'document' : 'documents'}
              {filtered.length > 8
                ? ` · Page ${table.getState().pagination.pageIndex + 1} of ${table.getPageCount()}`
                : ''}
            </span>
            {filtered.length > 8 ? (
              <div className="pagination-controls">
                <button
                  className="icon-button"
                  aria-label="Previous page"
                  disabled={!table.getCanPreviousPage()}
                  onClick={() => table.previousPage()}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Next page"
                  disabled={!table.getCanNextPage()}
                  onClick={() => table.nextPage()}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            ) : (
              <span>
                Your work stays with you.
                <ShieldCheck size={14} />
              </span>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
