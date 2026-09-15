import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstallController } from '../lib/billbook/install';

function fixture(standalone = false, iosStandalone = false) {
  const events = new EventTarget();
  const media = Object.assign(new EventTarget(), { matches: standalone });
  const host = {
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    matchMedia: () => media,
    navigator: { standalone: iosStandalone },
  } as unknown as Parameters<typeof createInstallController>[0];
  return { events, media, controller: createInstallController(host) };
}

await test('manual instructions remain available without a browser install event', async () => {
  const { controller } = fixture();
  assert.equal(await controller.install(), 'instructions');
  assert.deepEqual(controller.getSnapshot(), {
    installed: false,
    prompting: false,
  });
  controller.dispose();
});

await test('install prompts are single-use and acceptance does not claim installation', async () => {
  const { controller, events } = fixture();
  let calls = 0;
  let accept!: (choice: { outcome: 'accepted' }) => void;
  const event = Object.assign(
    new Event('beforeinstallprompt', { cancelable: true }),
    {
      prompt: async () => {
        calls++;
      },
      userChoice: new Promise<{ outcome: 'accepted' }>((resolve) => {
        accept = resolve;
      }),
    },
  );
  events.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  const result = controller.install();
  assert.equal(calls, 1);
  assert.equal(controller.getSnapshot().prompting, true);
  assert.equal(await controller.install(), 'handled');
  accept({ outcome: 'accepted' });
  assert.equal(await result, 'handled');
  assert.equal(controller.getSnapshot().installed, false);
  assert.equal(await controller.install(), 'instructions');
  events.dispatchEvent(new Event('appinstalled'));
  assert.equal(controller.getSnapshot().installed, true);
  assert.equal(await controller.install(), 'handled');
  assert.equal(calls, 1);
  controller.dispose();
});

await test('dismissed and failed prompts allow manual instructions on the next click', async () => {
  for (const fail of [false, true]) {
    const { controller, events } = fixture();
    events.dispatchEvent(
      Object.assign(new Event('beforeinstallprompt'), {
        prompt: async () => {
          if (fail) throw new Error('Unavailable');
        },
        userChoice: Promise.resolve({ outcome: 'dismissed' }),
      }),
    );
    assert.equal(await controller.install(), fail ? 'instructions' : 'handled');
    assert.equal(controller.getSnapshot().prompting, false);
    assert.equal(controller.getSnapshot().installed, false);
    assert.equal(await controller.install(), 'instructions');
    controller.dispose();
  }
});

await test('standalone browser mode and iOS standalone mode show installed state', () => {
  for (const [standalone, iosStandalone] of [
    [true, false],
    [false, true],
  ]) {
    const { controller } = fixture(standalone, iosStandalone);
    assert.equal(controller.getSnapshot().installed, true);
    controller.dispose();
  }
  const { controller, media, events } = fixture();
  let changes = 0;
  controller.subscribe(() => {
    changes++;
  });
  media.matches = true;
  media.dispatchEvent(new Event('change'));
  assert.equal(controller.getSnapshot().installed, true);
  assert.equal(changes, 1);
  controller.dispose();
  media.matches = false;
  media.dispatchEvent(new Event('change'));
  events.dispatchEvent(new Event('appinstalled'));
  assert.equal(changes, 1);
});
