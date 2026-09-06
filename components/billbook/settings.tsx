'use client';
import { useState } from 'react';
import {
  Save,
  Download,
  Upload,
  ShieldCheck,
  HardDrive,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { type Settings, fonts, settingsSchema } from '@/lib/billbook/model';
import { backup, restoreBackup, type CustomFont } from '@/lib/billbook/storage';
import { TextField, PartyFields, Choice, taxOptions } from './fields';
import PaymentDetailsFields from './payment-details';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
export default function SettingsView({
  settings,
  customFonts,
  onSave,
  onRefresh,
  onFontUpload,
  documentCount,
}: {
  settings: Settings;
  customFonts: CustomFont[];
  onSave: (s: Settings) => Promise<void>;
  onRefresh: () => Promise<void>;
  onFontUpload: (f: File) => Promise<void>;
  documentCount: number;
}) {
  const [value, setValue] = useState(settings),
    [busy, setBusy] = useState(false),
    [restore, setRestore] = useState<unknown>(null),
    [persistent, setPersistent] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setValue({ ...value, [k]: v });
  async function exportBackup() {
    try {
      const { download } = await import('@/lib/billbook/export');
      download(
        JSON.stringify(await backup(), null, 2),
        `billbook-backup-${new Date().toISOString().slice(0, 10)}.json`,
      );
      toast.success('Workspace backup downloaded');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function readBackup(f: File | undefined) {
    if (!f) return;
    try {
      if (f.size > 50 * 1024 * 1024)
        throw new Error('Backup must be smaller than 50 MB.');
      const data = JSON.parse(await f.text());
      if (data.version !== 1 || !Array.isArray(data.documents))
        throw new Error('Choose a Billbook workspace backup.');
      setRestore(data);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SET IT ONCE. MAKE IT YOURS.</div>
          <h1>Workspace settings</h1>
          <p>Your business details, ready on every new document.</p>
        </div>
        <button
          className="button primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const parsed = settingsSchema.parse(value);
              if (!parsed.workspace.trim())
                throw new Error('Add a workspace name.');
              if (parsed.prefix && !/^[A-Za-z0-9-]+$/.test(parsed.prefix))
                throw new Error(
                  'Use letters, numbers and dashes for the prefix.',
                );
              await onSave(parsed);
              toast.success('Workspace settings saved');
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Save size={16} />
          Save settings
        </button>
      </div>
      <div className="settings-layout">
        <div>
          <section className="surface-card">
            <h2>A familiar workspace</h2>
            <TextField
              label="Workspace name"
              value={value.workspace}
              onChange={(v) => set('workspace', v)}
            />
            <PartyFields
              party={value.seller}
              onChange={(v) => set('seller', v)}
              label="Your business details"
            />
          </section>
          <section className="surface-card">
            <h2>The usual details</h2>
            <div className="field-grid">
              <Choice
                label="Default currency"
                value={value.currency}
                onChange={(v) => set('currency', v as Settings['currency'])}
                options={['INR', 'USD', 'EUR', 'GBP', 'AED']}
              />
              <TextField
                label="Invoice prefix"
                value={value.prefix}
                onChange={(v) => set('prefix', v.toUpperCase())}
                maxLength={12}
                hint="For example: INV → INV-0001"
              />
              <Choice
                label="Default tax mode"
                value={value.taxMode}
                onChange={(v) => set('taxMode', v as Settings['taxMode'])}
                options={taxOptions}
              />
              <TextField
                label="Default tax rate %"
                type="number"
                min={0}
                max={100}
                value={value.defaultTax}
                onChange={(v) => set('defaultTax', Number(v))}
              />
            </div>
            <p className="section-hint">
              Tax is always yours to set. Check the applicable rate and required
              details for each transaction.
            </p>
            <PaymentDetailsFields
              value={value}
              onChange={(payment) =>
                setValue((current) => ({ ...current, ...payment }))
              }
              design={value.defaultDesign}
              onDesignChange={(payment) =>
                set('defaultDesign', { ...value.defaultDesign, ...payment })
              }
              currency={value.currency}
            />
          </section>
        </div>
        <div>
          <section className="surface-card storage-settings">
            <span className="template-icon green">
              <ShieldCheck size={23} />
            </span>
            <h2>A little peace of mind.</h2>
            <p>
              Everything stays in this browser on this device. Keep a backup
              before clearing browser data or switching devices.
            </p>
            <div className="storage-count">
              <HardDrive size={17} />
              <strong>{documentCount}</strong>saved documents
            </div>
            <button
              className="button primary full-width"
              onClick={() => void exportBackup()}
            >
              <Download size={16} />
              Download workspace backup
            </button>
            <label className="button secondary full-width">
              <Upload size={16} />
              Restore a backup
              <input
                type="file"
                accept=".json"
                onChange={(e) => {
                  void readBackup(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            <button
              className="text-button"
              disabled={persistent}
              onClick={async () => {
                try {
                  const ok = await navigator.storage?.persist?.();
                  setPersistent(!!ok);
                  toast[ok ? 'success' : 'info'](
                    ok
                      ? 'Persistent storage enabled'
                      : 'Your browser manages storage automatically. Keep regular backups.',
                  );
                } catch {
                  toast.info('Keep regular backups to protect your documents.');
                }
              }}
            >
              {persistent ? <Check size={14} /> : <ShieldCheck size={14} />}{' '}
              {persistent
                ? 'Persistent storage enabled'
                : 'Protect local storage'}
            </button>
          </section>
          <section className="surface-card">
            <h2>Find your type.</h2>
            <p className="section-hint">
              Bundled fonts are available offline. Your uploaded fonts stay on
              this device.
            </p>
            {fonts.map((g) => (
              <div className="font-group" key={g.group}>
                <span>{g.group}</span>
                {g.names.map((n) => (
                  <div key={n} style={{ fontFamily: `"${n}",serif` }}>
                    {n}
                    <span>Aa</span>
                  </div>
                ))}
              </div>
            ))}
            {customFonts.length > 0 && (
              <div className="font-group">
                <span>Your fonts</span>
                {customFonts.map((f) => (
                  <div key={f.id} style={{ fontFamily: `"${f.name}"` }}>
                    {f.name}
                    <span>Aa</span>
                  </div>
                ))}
              </div>
            )}
            <label className="button secondary full-width">
              <Upload size={16} />
              Upload a font
              <input
                type="file"
                accept=".woff,.woff2,.ttf,.otf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f)
                    void onFontUpload(f).catch((e) => toast.error(e.message));
                  e.target.value = '';
                }}
              />
            </label>
            <p className="section-hint">WOFF, WOFF2, TTF or OTF · up to 3 MB</p>
          </section>
        </div>
      </div>
      <AlertDialog
        open={restore !== null}
        onOpenChange={(v) => !v && setRestore(null)}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Restore this workspace backup?</AlertDialogTitle>
          <AlertDialogDescription>
            Documents and templates will be merged. Matching records and
            workspace settings will be replaced with the backup versions.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await restoreBackup(restore);
                  await onRefresh();
                  setRestore(null);
                  toast.success('Workspace backup restored');
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Restore backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
