'use client';
import { useState } from 'react';
import { typeMeta } from './document-types';
import {
  Plus,
  ArrowUpRight,
  ArrowLeft,
  Save,
  Trash2,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  type Template,
  type Settings,
  type DocType,
  typeNames,
  builtinTemplates,
  newDocument,
  uuid,
  defaultDesign,
  documentTypes,
} from '@/lib/billbook/model';
import { type CustomFont } from '@/lib/billbook/storage';
import { TextField, Choice, taxOptions } from './fields';
import DesignControls from './design-controls';
import DocumentPreview from './document-preview';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

export default function Templates({
  templates,
  settings,
  customFonts,
  onCreate,
  onSave,
  onDelete,
  onFontUpload,
}: {
  templates: Template[];
  settings: Settings;
  customFonts: CustomFont[];
  onCreate: (type: DocType, t?: Template) => void;
  onSave: (t: Template) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onFontUpload: (f: File) => Promise<void>;
}) {
  const [editing, setEditing] = useState<Template | null>(null),
    [filter, setFilter] = useState('all'),
    [busy, setBusy] = useState(false),
    [remove, setRemove] = useState<Template | null>(null);
  if (editing) {
    const doc = newDocument(editing.type, settings, editing);
    doc.seller.name = doc.seller.name || 'Your business';
    doc.customer.name = 'Alex Morgan';
    doc.items = [
      {
        id: 'preview',
        description:
          editing.type === 'rent'
            ? 'Monthly rent'
            : editing.type === 'maintenance'
              ? 'Society maintenance'
              : 'Professional services',
        quantity: 1,
        rate: 2500,
        tax: editing.taxRate,
        hsn: '',
      },
    ];
    return (
      <div className="template-editor">
        <div className="editor-top">
          <div className="editor-title">
            <button
              className="icon-button"
              aria-label="Back to templates"
              onClick={() => setEditing(null)}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1>Template studio</h1>
              <span className="editor-save-state">
                A little personality on every page.
              </span>
            </div>
          </div>
          <button
            className="button primary"
            disabled={busy || !editing.name.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave(editing);
                toast.success('Template saved');
                setEditing(null);
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Save size={16} />
            Save template
          </button>
        </div>
        <div className="editor-layout">
          <div className="editor-form">
            <div className="form-section">
              <h3>The basics</h3>
              <TextField
                label="Template name *"
                value={editing.name}
                onChange={(v) => setEditing({ ...editing, name: v })}
              />
              <TextField
                label="Description"
                value={editing.description}
                onChange={(v) => setEditing({ ...editing, description: v })}
              />
              <Choice
                label="Document type"
                value={editing.type}
                onChange={(v) => setEditing({ ...editing, type: v as DocType })}
                options={documentTypes.map((t) => ({
                  value: t,
                  label: typeNames[t],
                }))}
              />
              <div className="field-grid">
                <Choice
                  label="Default tax"
                  value={editing.taxMode}
                  onChange={(v) =>
                    setEditing({
                      ...editing,
                      taxMode: v as Template['taxMode'],
                    })
                  }
                  options={taxOptions}
                />
                <TextField
                  label="Tax rate %"
                  type="number"
                  min={0}
                  max={100}
                  value={editing.taxRate}
                  onChange={(v) =>
                    setEditing({ ...editing, taxRate: Number(v) })
                  }
                />
              </div>
            </div>
            <DesignControls
              design={editing.design}
              onChange={(v) => setEditing({ ...editing, design: v })}
              customFonts={customFonts}
              onFontUpload={onFontUpload}
            />
            <div className="form-section">
              <TextField
                label="Default notes"
                value={editing.notes}
                onChange={(v) => setEditing({ ...editing, notes: v })}
                multiline
              />
              <TextField
                label="Default terms"
                value={editing.terms}
                onChange={(v) => setEditing({ ...editing, terms: v })}
                multiline
              />
            </div>
          </div>
          <div className="preview-pane">
            <div className="preview-toolbar">
              <span>
                <span className="status-dot" />
                Template preview
              </span>
              <span>A4</span>
            </div>
            <div className="paper-scroll">
              <DocumentPreview doc={doc} />
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR BUSINESS. YOUR STYLE.</div>
          <h1>A good first impression.</h1>
          <p>
            Thoughtful templates for everyday paperwork. Make any one your own.
          </p>
        </div>
        <button
          className="button primary"
          onClick={() =>
            setEditing({
              id: uuid(),
              name: 'My custom template',
              description: 'Made by you, for your business.',
              type: 'invoice',
              design: structuredClone(defaultDesign),
              taxRate: 0,
              taxMode: 'none',
              notes: '',
              terms: '',
            })
          }
        >
          <Plus size={16} />
          Create template
        </button>
      </div>
      <div className="template-filter">
        <Choice
          label="Show templates"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All document types' },
            ...documentTypes.map((t) => ({ value: t, label: typeNames[t] })),
          ]}
        />
        <span>
          {
            [...builtinTemplates, ...templates].filter(
              (t) => filter === 'all' || t.type === filter,
            ).length
          }{' '}
          templates · endlessly yours
        </span>
      </div>
      <div className="template-gallery">
        {[...builtinTemplates, ...templates]
          .filter((t) => filter === 'all' || t.type === filter)
          .map((t) => {
            const doc = newDocument(t.type, settings, t);
            doc.seller.name = 'YOUR BUSINESS';
            doc.customer.name = 'Alex Morgan';
            doc.items = [
              {
                id: 'sample',
                description:
                  t.type === 'rent'
                    ? 'Monthly rent'
                    : t.type === 'maintenance'
                      ? 'Society maintenance'
                      : 'Products & services',
                quantity: 1,
                rate: 2500,
                tax: t.taxRate,
                hsn: '',
              },
              {
                id: 'sample-2',
                description: 'Additional services',
                quantity: 1,
                rate: 500,
                tax: t.taxRate,
                hsn: '',
              },
            ];
            const meta = typeMeta[t.type];
            return (
              <article className="gallery-card" key={t.id}>
                <button
                  className={'template-thumbnail ' + meta.color}
                  onClick={() => onCreate(t.type, t)}
                  aria-label={`Use ${t.name}`}
                >
                  <div className="mini-paper">
                    <DocumentPreview doc={doc} />
                  </div>
                  <span className="thumbnail-cta">
                    Use template
                    <ArrowUpRight size={15} />
                  </span>
                </button>
                <div className="gallery-info">
                  <div>
                    <span className={'template-type ' + meta.color}>
                      {typeNames[t.type]}
                    </span>
                    {!t.id.startsWith('tpl-') && (
                      <span className="custom-tag">CUSTOM</span>
                    )}
                  </div>
                  <h3>{t.name}</h3>
                  <p>{t.description}</p>
                  <div className="gallery-actions">
                    <button
                      className="text-button"
                      onClick={() => onCreate(t.type, t)}
                    >
                      Use template
                      <ArrowUpRight size={15} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Customize ${t.name}`}
                      title="Customize template"
                      onClick={() =>
                        setEditing({
                          ...structuredClone(t),
                          id: t.id.startsWith('tpl-') ? uuid() : t.id,
                          name: t.id.startsWith('tpl-')
                            ? `${t.name} · custom`
                            : t.name,
                        })
                      }
                    >
                      <Pencil size={15} />
                    </button>
                    {!t.id.startsWith('tpl-') && (
                      <button
                        className="icon-button"
                        aria-label={`Delete ${t.name}`}
                        onClick={() => setRemove(t)}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
      </div>
      <AlertDialog open={!!remove} onOpenChange={(v) => !v && setRemove(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete this template?</AlertDialogTitle>
          <AlertDialogDescription>
            “{remove?.name}” will be removed. Documents made from it will
            remain.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (remove) await onDelete(remove.id);
                setRemove(null);
              }}
            >
              Delete template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
