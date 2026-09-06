'use client';
import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { type Party } from '@/lib/billbook/model';
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function TextField({
  label,
  value,
  onChange,
  multiline = false,
  hint,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  multiline?: boolean;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={props.placeholder}
          rows={3}
        />
      ) : (
        <Input
          {...props}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}{' '}
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: ({ value: string; label: string } | string)[];
}) {
  return (
    <Field label={label}>
      <Select
        value={value}
        onValueChange={(v) => v !== null && onChange(String(v))}
      >
        <SelectTrigger aria-label={label} className="field-select">
          <SelectValue>
            {options
              .map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
              .find((o) => o.value === value)?.label ?? value}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options
            .map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
            .map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
export function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <label className="check-field" htmlFor={id}>
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
      <span>{label}</span>
    </label>
  );
}
export function PartyFields({
  party,
  onChange,
  label,
}: {
  party: Party;
  onChange: (p: Party) => void;
  label: string;
}) {
  const set = (key: keyof Party, value: string) =>
    onChange({ ...party, [key]: value });
  return (
    <div className="form-section">
      <h3>{label}</h3>
      <TextField
        label="Name *"
        value={party.name}
        onChange={(v) => set('name', v)}
        placeholder="Business or full name"
      />
      <TextField
        label="Address"
        multiline
        value={party.address}
        onChange={(v) => set('address', v)}
        placeholder="Street, city, postal code"
      />
      <div className="field-grid">
        <TextField
          label="Email"
          type="email"
          value={party.email}
          onChange={(v) => set('email', v)}
          placeholder="hello@example.com"
        />
        <TextField
          label="Phone"
          value={party.phone}
          onChange={(v) => set('phone', v)}
          placeholder="+91"
        />
        <TextField
          label="GSTIN"
          value={party.gst}
          onChange={(v) => set('gst', v.toUpperCase())}
          placeholder="15-character GST number"
          maxLength={15}
        />
        <TextField
          label="VAT ID"
          value={party.vat}
          onChange={(v) => set('vat', v)}
          placeholder="VAT registration number"
        />
        <TextField
          label="Business registration number"
          value={party.registration}
          onChange={(v) => set('registration', v)}
          placeholder="CIN, Udyam, shop or society registration"
        />
        <TextField
          label="PAN"
          value={party.pan}
          onChange={(v) => set('pan', v.toUpperCase())}
          placeholder="ABCDE1234F"
          maxLength={10}
        />
        <TextField
          label="State / place of supply"
          value={party.state}
          onChange={(v) => set('state', v)}
          placeholder="Maharashtra (27)"
        />
      </div>
    </div>
  );
}
export const taxOptions = [
  { value: 'none', label: 'No tax' },
  { value: 'gst', label: 'GST · CGST + SGST' },
  { value: 'igst', label: 'GST · IGST' },
  { value: 'vat', label: 'VAT' },
  { value: 'custom', label: 'Custom tax' },
];
export async function readUpload(file: File, maxMB = 3): Promise<string> {
  if (file.size > maxMB * 1024 * 1024)
    throw new Error(`Choose a file smaller than ${maxMB} MB.`);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('The file could not be read.'));
    reader.onerror = () => reject(new Error('This file could not be read.'));
    reader.readAsDataURL(file);
  });
}
