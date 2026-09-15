'use client';
import { useState } from 'react';
import { Check, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { installApp, useInstall } from '@/lib/billbook/install';

export default function InstallButton({
  offlineReady,
}: {
  offlineReady: boolean;
}) {
  const { installed, prompting } = useInstall();
  const [help, setHelp] = useState(false);
  const label = installed
    ? 'App installed'
    : prompting
      ? 'Installing…'
      : 'Install app';
  return (
    <>
      <Button
        variant="outline"
        className="install-button"
        type="button"
        aria-label={label}
        title={label}
        disabled={installed || prompting}
        onClick={async () => {
          if ((await installApp()) === 'instructions') setHelp(true);
        }}
      >
        {installed ? (
          <Check aria-hidden="true" />
        ) : (
          <Download aria-hidden="true" />
        )}
        <span>{label}</span>
      </Button>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="help-dialog install-dialog">
          <DialogTitle>Give Billbook a place on your device.</DialogTitle>
          <DialogDescription>
            Add it to your home screen or Dock and open it like an app. No
            account or separate download needed.
          </DialogDescription>
          <div className="help-section">
            <h3>Chrome or Edge</h3>
            <p>
              Choose the install icon in the address bar or Install app in the
              browser menu. On Android, look for Install app or Add to Home
              screen in the menu.
            </p>
          </div>
          <div className="help-section">
            <h3>iPhone or iPad</h3>
            <p>
              Open Billbook in Safari, tap Share, then Add to Home Screen. Turn
              on Open as Web App if shown, then tap Add.
            </p>
          </div>
          <div className="help-section">
            <h3>Safari on Mac</h3>
            <p>Choose File → Add to Dock, then Add.</p>
          </div>
          <output className="install-note">
            {offlineReady
              ? 'Ready to work offline. Keep a backup of your documents in Settings.'
              : 'For offline use, keep the app open while connected until the sidebar says “Ready to work offline”.'}
          </output>
          <p className="install-note">
            If installation is unavailable, open this page in a supported
            browser outside an embedded preview. Your bills stay in this
            browser; installing does not sync them between browsers or devices.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
