import { useSyncExternalStore } from 'react';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
type InstallState = { installed: boolean; prompting: boolean };
type InstallHost = Pick<
  Window,
  'addEventListener' | 'removeEventListener' | 'matchMedia' | 'navigator'
>;
const serverState: InstallState = { installed: false, prompting: false };

export function createInstallController(host: InstallHost) {
  const displayMode = host.matchMedia('(display-mode: standalone)');
  const isStandalone = () =>
    displayMode.matches ||
    Boolean(
      (host.navigator as Navigator & { standalone?: boolean }).standalone,
    );
  let state: InstallState = { installed: isStandalone(), prompting: false };
  let deferred: InstallPrompt | null = null;
  let installedThisSession = false;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<InstallState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  const onPrompt = (event: Event) => {
    event.preventDefault();
    deferred = event as InstallPrompt;
  };
  const onInstalled = () => {
    installedThisSession = true;
    deferred = null;
    update({ installed: true, prompting: false });
  };
  const onDisplayMode = () =>
    update({ installed: installedThisSession || isStandalone() });
  host.addEventListener('beforeinstallprompt', onPrompt);
  host.addEventListener('appinstalled', onInstalled);
  displayMode.addEventListener('change', onDisplayMode);

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async install(): Promise<'handled' | 'instructions'> {
      if (state.installed || state.prompting) return 'handled';
      if (!deferred) return 'instructions';
      // The browser event is single-use; prompt() must run from this click.
      const event = deferred;
      deferred = null;
      update({ prompting: true });
      try {
        await event.prompt();
        await event.userChoice;
        // Acceptance is not an installation signal. Wait for appinstalled or
        // standalone mode before reporting that the app is installed.
        return 'handled';
      } catch {
        return 'instructions';
      } finally {
        update({ prompting: false });
      }
    },
    dispose() {
      host.removeEventListener('beforeinstallprompt', onPrompt);
      host.removeEventListener('appinstalled', onInstalled);
      displayMode.removeEventListener('change', onDisplayMode);
      deferred = null;
      listeners.clear();
    },
  };
}

// Load with the workspace so the browser's event is captured before the user
// opens a dialog. Server rendering always starts from the same snapshot.
const controller =
  typeof window === 'undefined' ? null : createInstallController(window);
const subscribe = (listener: () => void) =>
  controller?.subscribe(listener) ?? (() => {});
export const useInstall = () =>
  useSyncExternalStore(
    subscribe,
    () => controller?.getSnapshot() ?? serverState,
    () => serverState,
  );
export const installApp = () =>
  controller?.install() ?? Promise.resolve('instructions' as const);
