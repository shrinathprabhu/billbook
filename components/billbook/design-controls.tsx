/* oxlint-disable next/no-img-element */
// Uploaded data URLs render locally without an image optimization service.
'use client';
import { type Design, fonts, uuid } from '@/lib/billbook/model';
import { type CustomFont } from '@/lib/billbook/storage';
import { TextField, Choice, CheckField, readUpload } from './fields';
import {
  Plus,
  Upload,
  X,
  ArrowUp,
  ArrowDown,
  Type,
  Minus,
  CreditCard,
  ListChecks,
} from 'lucide-react';
import { toast } from 'sonner';
export default function DesignControls({
  design,
  onChange,
  customFonts,
  onFontUpload,
}: {
  design: Design;
  onChange: (d: Design) => void;
  customFonts: CustomFont[];
  onFontUpload: (f: File) => Promise<void>;
}) {
  const set = <K extends keyof Design>(key: K, value: Design[K]) =>
    onChange({ ...design, [key]: value });
  async function upload(
    file: File | undefined,
    key: 'logo' | 'letterhead' | 'signature',
  ) {
    if (!file) return;
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
        throw new Error('Choose a PNG, JPEG, or WebP image.');
      set(key, await readUpload(file));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  function move(index: number, delta: number) {
    const blocks = [...design.blocks];
    [blocks[index], blocks[index + delta]] = [
      blocks[index + delta],
      blocks[index],
    ];
    set('blocks', blocks);
  }
  return (
    <>
      <div className="form-section">
        <h3>Make it your own</h3>
        <Choice
          label="Document style"
          value={design.layout}
          onChange={(v) => set('layout', v as Design['layout'])}
          options={[
            { value: 'modern', label: 'Modern · clean & confident' },
            { value: 'classic', label: 'Classic · timeless & formal' },
            { value: 'minimal', label: 'Minimal · just the essentials' },
          ]}
        />
        <Choice
          label="Document font"
          value={design.font}
          onChange={(v) => set('font', v)}
          options={[
            ...fonts.flatMap((g) => g.names),
            ...customFonts.map((f) => f.name),
          ]}
        />
        <label className="upload-inline">
          <Upload size={15} />
          Upload your own font
          <input
            type="file"
            accept=".woff,.woff2,.ttf,.otf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFontUpload(f).catch((e) => toast.error(e.message));
              e.target.value = '';
            }}
          />
        </label>
        <div className="color-grid">
          {(
            [
              { key: 'accent', label: 'Accent' },
              { key: 'text', label: 'Text' },
              { key: 'background', label: 'Paper' },
            ] as const
          ).map((c) => (
            <label key={c.key}>
              <span>{c.label}</span>
              <div>
                <input
                  type="color"
                  value={design[c.key]}
                  onChange={(e) => set(c.key, e.target.value)}
                />
                <span>{design[c.key]}</span>
              </div>
            </label>
          ))}
        </div>
      </div>
      <div className="form-section">
        <h3>Your finishing touches</h3>
        {(
          [
            { key: 'logo', label: 'Business logo' },
            { key: 'letterhead', label: 'Header / letterhead' },
            { key: 'signature', label: 'Signature image' },
          ] as const
        ).map((a) => (
          <div className="asset-upload" key={a.key}>
            <div>
              <strong>{a.label}</strong>
              <span>PNG, JPG or WebP · up to 3 MB</span>
            </div>
            {design[a.key] ? (
              <>
                <img src={design[a.key]} alt={a.label} />
                <button
                  className="icon-button"
                  aria-label={'Remove ' + a.label}
                  onClick={() => set(a.key, '')}
                >
                  <X size={16} />
                </button>
              </>
            ) : (
              <label className="button secondary compact">
                <Upload size={14} />
                Add
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => void upload(e.target.files?.[0], a.key)}
                />
              </label>
            )}
          </div>
        ))}
        <div className="check-stack">
          <CheckField
            label="Signature section"
            checked={design.showSignature}
            onChange={(v) => set('showSignature', v)}
          />
          <CheckField
            label="Bank / payment details"
            checked={design.showBank}
            onChange={(v) => set('showBank', v)}
          />
          <CheckField
            label="UPI payment QR code"
            checked={design.showUpiQr}
            onChange={(v) => set('showUpiQr', v)}
          />
          <CheckField
            label="Notes section"
            checked={design.showNotes}
            onChange={(v) => set('showNotes', v)}
          />
          <CheckField
            label="Paid stamp on paid documents"
            checked={design.showStamp}
            onChange={(v) => set('showStamp', v)}
          />
        </div>
        <TextField
          label="Footer message"
          value={design.footer}
          onChange={(v) => set('footer', v)}
        />
      </div>
      <div className="form-section">
        <h3>Build it your way</h3>
        <p className="section-hint">
          Add a component, then move it into place.
        </p>
        <div className="component-picker">
          {[
            { kind: 'text', label: 'Custom text', icon: Type },
            { kind: 'divider', label: 'Divider', icon: Minus },
            { kind: 'payment', label: 'Payment info', icon: CreditCard },
            { kind: 'terms', label: 'Terms', icon: ListChecks },
          ].map((c) => (
            <button
              key={c.kind}
              onClick={() =>
                set('blocks', [
                  ...design.blocks,
                  {
                    id: uuid(),
                    kind: c.kind as Design['blocks'][number]['kind'],
                    label: c.label,
                    text: '',
                  },
                ])
              }
            >
              <c.icon size={16} />
              {c.label}
              <Plus size={13} />
            </button>
          ))}
        </div>
        {design.blocks.map((b, i) => (
          <div className="custom-block" key={b.id}>
            <div className="custom-block-heading">
              <strong>
                {b.kind === 'divider' ? 'Divider' : b.label || 'Text block'}
              </strong>
              <button
                aria-label="Move component up"
                className="icon-button"
                disabled={!i}
                onClick={() => move(i, -1)}
              >
                <ArrowUp size={14} />
              </button>
              <button
                aria-label="Move component down"
                className="icon-button"
                disabled={i === design.blocks.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown size={14} />
              </button>
              <button
                aria-label="Remove component"
                className="icon-button"
                onClick={() =>
                  set(
                    'blocks',
                    design.blocks.filter((v) => v.id !== b.id),
                  )
                }
              >
                <X size={14} />
              </button>
            </div>
            {b.kind !== 'divider' && (
              <>
                <TextField
                  label="Heading"
                  value={b.label}
                  onChange={(v) =>
                    set(
                      'blocks',
                      design.blocks.map((c) =>
                        c.id === b.id ? { ...c, label: v } : c,
                      ),
                    )
                  }
                />
                <TextField
                  label="Content"
                  multiline
                  value={b.text}
                  onChange={(v) =>
                    set(
                      'blocks',
                      design.blocks.map((c) =>
                        c.id === b.id ? { ...c, text: v } : c,
                      ),
                    )
                  }
                />
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
