'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { z } from 'zod';
import { BASE_PATH } from '@/lib/site.mjs';
import SiteFooter from '@/components/billbook/site-footer';
import {
  Receipt,
  FileText,
  Layers2,
  Upload,
  Settings as SettingsIcon,
  CircleHelp,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import DocumentLibrary from '@/components/billbook/document-library';
import Templates, { typeMeta } from '@/components/billbook/templates';
import Editor from '@/components/billbook/editor';
import BulkImport from '@/components/billbook/bulk-import';
import SettingsView from '@/components/billbook/settings';
import { readUpload } from '@/components/billbook/fields';
import {
  loadWorkspace,
  saveDocuments,
  saveSettings,
  saveTemplate,
  saveFont,
  deleteDocument,
  deleteTemplate,
  type CustomFont,
} from '@/lib/billbook/storage';
import {
  type BillDoc,
  type Settings,
  type Template,
  type DocType,
  documentTypes,
  defaultSettings,
  builtinTemplates,
  newDocument,
  uuid,
  validateForExport,
} from '@/lib/billbook/model';
import { calculate } from '@/lib/billbook/calculations';

type Page = 'documents' | 'templates' | 'bulk' | 'settings';
const pageNames: Record<Page, string> = {
  documents: 'Documents',
  templates: 'Templates',
  bulk: 'Bulk generate',
  settings: 'Settings',
};
function NavButton({
  onClick,
  children,
  className,
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <button
      className={className}
      onClick={() => {
        setOpenMobile(false);
        onClick();
      }}
    >
      {children}
    </button>
  );
}
export default function Workspace({
  discovery,
}: {
  discovery: React.ReactNode;
}) {
  const [page, setPage] = useState<Page>('documents'),
    [documents, setDocuments] = useState<BillDoc[]>([]),
    [templates, setTemplates] = useState<Template[]>([]),
    [settings, setSettingsState] = useState<Settings>(defaultSettings),
    [customFonts, setCustomFonts] = useState<CustomFont[]>([]),
    [editing, setEditing] = useState<BillDoc | null>(null),
    [create, setCreate] = useState(false),
    [help, setHelp] = useState(false),
    [remove, setRemove] = useState<BillDoc | null>(null),
    [loading, setLoading] = useState(true),
    [storageError, setStorageError] = useState(''),
    [offlineReady, setOfflineReady] = useState(false),
    [deleteBusy, setDeleteBusy] = useState(false);
  const [pendingPage, setPendingPage] = useState<Page | null>(null),
    [navigationBusy, setNavigationBusy] = useState(false);
  const editorDraft = useRef<BillDoc | null>(null),
    editorDirty = useRef(false);
  const draftChanged = useCallback((doc: BillDoc, dirty: boolean) => {
    editorDraft.current = doc;
    editorDirty.current = dirty;
  }, []);
  const refresh = useCallback(async () => {
    try {
      const data = await loadWorkspace();
      setDocuments(data.documents);
      setTemplates(data.templates);
      setSettingsState(data.settings);
      setCustomFonts(data.fonts);
      setStorageError('');
      await Promise.allSettled(
        data.fonts.map(async (f) => {
          const font = await new FontFace(f.name, `url(${f.data})`).load();
          document.fonts.add(font);
        }),
      );
    } catch {
      setStorageError(
        'Your browser’s local storage is unavailable. Allow site storage and retry.',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(refresh);
    const fn = () => void refresh();
    window.addEventListener('focus', fn);
    return () => window.removeEventListener('focus', fn);
  }, [refresh]);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      const standalone = ['/', '/index.html'].includes(
        window.location.pathname,
      );
      void navigator.serviceWorker
        .register(standalone ? '/standalone-sw.js' : `${BASE_PATH}/sw.js`, {
          scope: standalone ? '/' : BASE_PATH,
        })
        .then(() => navigator.serviceWorker.ready)
        .then(() => setOfflineReady(true))
        .catch(() =>
          toast.info(
            'Offline setup could not finish. Reopen the app while connected.',
          ),
        );
    }
  }, []);
  function finishNavigate(p: Page) {
    setPage(p);
    setEditing(null);
    setPendingPage(null);
    editorDirty.current = false;
  }
  function navigate(p: Page) {
    if (editing && editorDirty.current) {
      setPendingPage(p);
      return;
    }
    finishNavigate(p);
  }
  function createDoc(type?: DocType, t?: Template) {
    if (storageError) {
      toast.error(storageError);
      return;
    }
    if (!type) {
      setCreate(true);
      return;
    }
    const template = t ?? builtinTemplates.find((t) => t.type === type);
    const doc = newDocument(type, settings, template);
    if (!t) {
      doc.taxMode = settings.taxMode;
      doc.items = doc.items.map((i) => ({ ...i, tax: settings.defaultTax }));
    }
    setEditing(doc);
    setCreate(false);
  }
  async function saveDocs(docs: BillDoc[]) {
    const saved = await saveDocuments(docs, settings);
    setDocuments((current) => [
      ...current.filter((d) => !saved.some((s) => s.id === d.id)),
      ...saved,
    ]);
    return saved;
  }
  async function saveDoc(doc: BillDoc) {
    return (await saveDocs([doc]))[0];
  }
  async function templateSave(t: Template) {
    await saveTemplate(t);
    setTemplates((current) => [...current.filter((v) => v.id !== t.id), t]);
  }
  async function fontUpload(file: File) {
    if (!/\.(woff2?|ttf|otf)$/i.test(file.name))
      throw new Error('Choose a WOFF, WOFF2, TTF or OTF font.');
    const name = file.name
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9 _-]/g, '')
      .slice(0, 60);
    if (!name) throw new Error('Give your font a recognizable file name.');
    const data = await readUpload(file);
    const font = await new FontFace(name, `url(${data})`).load();
    const existing = customFonts.find((f) => f.name === name);
    const record = { id: existing?.id ?? uuid(), name, data };
    await saveFont(record);
    document.fonts.add(font);
    setCustomFonts((current) => [
      ...current.filter((f) => f.id !== record.id),
      record,
    ]);
    toast.success(`${name} is ready to use`);
  }
  async function duplicate(doc: BillDoc) {
    try {
      const copy = {
        ...structuredClone(doc),
        id: uuid(),
        number: '',
        status: 'draft' as const,
        createdAt: new Date().toISOString(),
      };
      const saved = await saveDoc(copy);
      setEditing(saved);
      toast.success('A fresh copy is ready');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function markPaid(doc: BillDoc) {
    const errors = validateForExport(doc);
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    try {
      await saveDoc({ ...doc, status: 'paid' });
      toast.success('Marked as paid');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) ||
        (e.target as HTMLElement)?.isContentEditable
      )
        return;
      if (e.key === '?' && !editing) setHelp(true);
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !editing)
        setCreate(true);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [editing]);
  const live = useRef({ documents, settings, saveDocs });
  useEffect(() => {
    live.current = { documents, settings, saveDocs };
  });
  useEffect(() => {
    type Tool = {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    };
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: Tool,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    const schema = z
      .object({
        type: z.enum(documentTypes),
        customer_name: z.string().min(1),
        description: z.string().min(1),
        rate: z.number().min(0).max(1e10),
      })
      .strict();
    const tools: Tool[] = [
      {
        name: 'list_local_documents',
        description:
          'Read document numbers, recipients, statuses and amounts in the current local Billbook workspace.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute(input) {
          z.object({}).strict().parse(input);
          return live.current.documents.map((d) => ({
            id: d.id,
            number: d.number,
            type: d.type,
            recipient: d.customer.name,
            status: d.status,
            currency: d.currency,
            total: calculate(d).total / 100,
          }));
        },
      },
      {
        name: 'create_local_document_draft',
        description:
          'Create and save a numbered document draft on this device. The document can then be opened and finished in the editor.',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: documentTypes },
            customer_name: { type: 'string', minLength: 1 },
            description: { type: 'string', minLength: 1 },
            rate: { type: 'number', minimum: 0, maximum: 1e10 },
          },
          required: ['type', 'customer_name', 'description', 'rate'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(input) {
          const v = schema.parse(input);
          const d = newDocument(v.type, live.current.settings);
          d.customer.name = v.customer_name;
          d.items[0].description = v.description;
          d.items[0].rate = v.rate;
          const saved = (await live.current.saveDocs([d]))[0];
          return { id: saved.id, number: saved.number, status: saved.status };
        },
      },
    ];
    for (const tool of tools) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: controller.signal }),
        ).catch(() => {});
      } catch {}
    }
    return () => controller.abort();
  }, []);
  const initials = settings.workspace.trim().slice(0, 1).toUpperCase() || 'M';
  return (
    <SidebarProvider
      style={{ '--sidebar-width': '232px' } as React.CSSProperties}
    >
      <Toaster
        richColors
        position="bottom-right"
        toastOptions={{
          style: { fontFamily: 'Inter, sans-serif', fontSize: '14px' },
        }}
      />
      <Sidebar className="app-sidebar">
        <SidebarHeader>
          <NavButton className="brand" onClick={() => navigate('documents')}>
            <span className="brand-symbol">
              <Receipt size={23} />
            </span>
            billbook<span className="brand-dot">.</span>
          </NavButton>
          <NavButton
            className="workspace-button"
            onClick={() => navigate('settings')}
          >
            <span className="workspace-avatar">{initials}</span>
            <span>
              {settings.workspace}
              <small>Personal workspace</small>
            </span>
            <ChevronDown size={15} />
          </NavButton>
        </SidebarHeader>
        <SidebarContent>
          <div className="nav-label">WORKSPACE</div>
          <nav className="nav-list">
            <NavButton
              className={'nav-item ' + (page === 'documents' ? 'active' : '')}
              onClick={() => navigate('documents')}
            >
              <FileText />
              Documents<span className="nav-count">{documents.length}</span>
            </NavButton>
            <NavButton
              className={'nav-item ' + (page === 'templates' ? 'active' : '')}
              onClick={() => navigate('templates')}
            >
              <Layers2 />
              Templates<span className="nav-note">{6 + templates.length}</span>
            </NavButton>
            <NavButton
              className={'nav-item ' + (page === 'bulk' ? 'active' : '')}
              onClick={() => navigate('bulk')}
            >
              <Upload />
              Bulk generate
            </NavButton>
          </nav>
          <div className="nav-label nav-space">PREFERENCES</div>
          <nav className="nav-list">
            <NavButton
              className={'nav-item ' + (page === 'settings' ? 'active' : '')}
              onClick={() => navigate('settings')}
            >
              <SettingsIcon />
              Settings
            </NavButton>
            <NavButton className="nav-item" onClick={() => setHelp(true)}>
              <CircleHelp />
              Help & shortcuts
            </NavButton>
          </nav>
        </SidebarContent>
        <SidebarFooter>
          <div className="local-card">
            <span className="local-icon">
              <ShieldCheck size={20} />
            </span>
            <strong>Yours. And only yours.</strong>
            <p>Your documents stay on this device. No cloud. No sign-ups.</p>
            <span className="local-card-status">
              <span className="status-dot" />
              {offlineReady ? 'Ready to work offline' : 'Stored on your device'}
            </span>
          </div>
          <NavButton
            className="sidebar-bottom"
            onClick={() => navigate('settings')}
          >
            <span className="workspace-avatar">{initials}</span>
            <div>
              {settings.workspace}
              <small>Local account</small>
            </div>
            <MoreHorizontal size={19} />
          </NavButton>
        </SidebarFooter>
      </Sidebar>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <SidebarTrigger className="mobile-trigger" />
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{editing ? 'Document editor' : pageNames[page]}</strong>
          </div>
          <div className="topbar-right">
            <span className="device-state">
              <span className="status-dot" />
              {loading ? 'Opening workspace…' : 'Stored on this device'}
            </span>
            <span className="topbar-divider" />
            <button
              className="icon-button"
              aria-label="Help and shortcuts"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={19} />
            </button>
            <button
              className="user-avatar"
              aria-label="Workspace settings"
              onClick={() => navigate('settings')}
            >
              {initials}
            </button>
          </div>
        </header>
        {storageError && (
          <div className="storage-error" role="alert">
            <strong>{storageError}</strong>
            <button className="button secondary" onClick={() => void refresh()}>
              Retry
            </button>
          </div>
        )}
        {editing ? (
          <main id="main-content" tabIndex={-1}>
            <Editor
              key={editing.id}
              initial={editing}
              settings={settings}
              customFonts={customFonts}
              onSave={saveDoc}
              onBack={() => setEditing(null)}
              onFontUpload={fontUpload}
              onSaveTemplate={templateSave}
              onDraftChange={draftChanged}
            />
          </main>
        ) : (
          <main className="main-content" id="main-content" tabIndex={-1}>
            {page === 'documents' ? (
              <DocumentLibrary
                documents={documents}
                settings={settings}
                onCreate={createDoc}
                onOpen={setEditing}
                onBulk={() => navigate('bulk')}
                onTemplates={() => navigate('templates')}
                onDuplicate={(d) => void duplicate(d)}
                onDelete={setRemove}
                onPaid={(d) => void markPaid(d)}
                loading={loading}
              />
            ) : page === 'templates' ? (
              <Templates
                templates={templates}
                settings={settings}
                customFonts={customFonts}
                onCreate={createDoc}
                onSave={templateSave}
                onDelete={async (id) => {
                  try {
                    await deleteTemplate(id);
                    setTemplates((v) => v.filter((t) => t.id !== id));
                    toast.success('Template deleted');
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
                onFontUpload={fontUpload}
              />
            ) : page === 'bulk' ? (
              <BulkImport
                settings={settings}
                templates={templates}
                onGenerate={saveDocs}
                onOpen={setEditing}
              />
            ) : (
              <SettingsView
                key={JSON.stringify(settings)}
                settings={settings}
                customFonts={customFonts}
                onSave={async (s) => {
                  await saveSettings(s);
                  setSettingsState(s);
                }}
                onRefresh={refresh}
                onFontUpload={fontUpload}
                documentCount={documents.length}
              />
            )}
            {page === 'documents' && discovery}
            <footer className="page-footer">
              <span>
                <span className="tiny-brand">
                  <Receipt size={14} />
                </span>
                Less paperwork. More possibilities.
              </span>
              <span>
                Made for your everyday business
                <span className="footer-dot">·</span>100% local
              </span>
            </footer>
          </main>
        )}
        <SiteFooter />
      </div>
      <Dialog open={create} onOpenChange={setCreate}>
        <DialogContent className="choose-dialog">
          <DialogTitle>Create something official.</DialogTitle>
          <DialogDescription>
            Choose a starting point for your next document.
          </DialogDescription>
          <div className="choose-grid">
            {documentTypes.map((type) => {
              const t = typeMeta[type];
              return (
                <button
                  key={type}
                  className="choose-card"
                  disabled={loading || !!storageError}
                  onClick={() => createDoc(type)}
                >
                  <span className={'template-icon ' + t.color}>
                    <t.icon />
                  </span>
                  <strong>{t.name}</strong>
                  <span>{t.desc}</span>
                  <ArrowRight size={16} />
                </button>
              );
            })}
          </div>
          <div className="dialog-footnote">
            <ShieldCheck size={14} />
            Saved only on your device. Always.
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="help-dialog">
          <DialogTitle>A little help with the paperwork.</DialogTitle>
          <DialogDescription>
            Everything you need to make Billbook feel like home.
          </DialogDescription>
          <div className="help-section">
            <h3>From blank page to finished document</h3>
            <ol>
              <li>Add your business details in Settings.</li>
              <li>Choose a document, fill in details, and set the tax rate.</li>
              <li>
                Save your draft, then export a PDF, image, or copyable text.
              </li>
            </ol>
          </div>
          <div className="help-section">
            <h3>Keep your work safe</h3>
            <p>
              Documents, fonts, and templates live in this browser’s storage.
              Download backups from Settings, especially before clearing site
              data or switching devices. The production app works offline after
              its first complete load.
            </p>
          </div>
          <div className="help-section">
            <h3>Quick on the keys</h3>
            <div className="shortcut-row">
              <span>Search documents</span>
              <kbd>⌘ / Ctrl K</kbd>
            </div>
            <div className="shortcut-row">
              <span>New document</span>
              <kbd>N</kbd>
            </div>
            <div className="shortcut-row">
              <span>Open this help</span>
              <kbd>?</kbd>
            </div>
          </div>
          <div className="help-section">
            <h3>About your totals</h3>
            <p>
              Summary cards use your default currency and exclude drafts and
              outgoing cash vouchers. Invoices and receipts are counted
              separately, so avoid recording the same payment twice if using
              these totals.
            </p>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={pendingPage !== null}
        onOpenChange={(v) => !v && setPendingPage(null)}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Save before you go?</AlertDialogTitle>
          <AlertDialogDescription>
            Your document has unsaved changes.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <button
              className="button secondary"
              onClick={() => pendingPage && finishNavigate(pendingPage)}
            >
              Discard
            </button>
            <AlertDialogAction
              disabled={navigationBusy}
              onClick={async () => {
                if (!editorDraft.current || !pendingPage) return;
                setNavigationBusy(true);
                try {
                  const doc = editorDraft.current;
                  if (doc.status !== 'draft') {
                    const errors = validateForExport(doc);
                    if (errors.length) throw new Error(errors[0]);
                  }
                  await saveDoc(doc);
                  finishNavigate(pendingPage);
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setNavigationBusy(false);
                }
              }}
            >
              Save & continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!remove} onOpenChange={(v) => !v && setRemove(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete {remove?.number}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the document from this device. You can restore it only
            from a workspace backup.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep document</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteBusy}
              onClick={async () => {
                if (!remove) return;
                setDeleteBusy(true);
                try {
                  await deleteDocument(remove.id);
                  setDocuments((v) => v.filter((d) => d.id !== remove.id));
                  setRemove(null);
                  toast.success('Document deleted');
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setDeleteBusy(false);
                }
              }}
            >
              Delete document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
