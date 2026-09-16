import {
  FileText,
  Receipt,
  House,
  Building2,
  Ticket,
  StickyNote,
} from 'lucide-react';

export const typeMeta = {
  invoice: {
    name: 'Invoice',
    desc: 'For products & services',
    icon: FileText,
    color: 'green',
  },
  receipt: {
    name: 'Receipt',
    desc: 'A proof of payment',
    icon: Receipt,
    color: 'orange',
  },
  rent: {
    name: 'Rent receipt',
    desc: 'For a place called home',
    icon: House,
    color: 'purple',
  },
  maintenance: {
    name: 'Maintenance',
    desc: 'For your community',
    icon: Building2,
    color: 'blue',
  },
  voucher: {
    name: 'Cash voucher',
    desc: 'Record cash in or out',
    icon: Ticket,
    color: 'pink',
  },
  memo: {
    name: 'Cash memo',
    desc: 'Itemized cash sales',
    icon: StickyNote,
    color: 'yellow',
  },
};
