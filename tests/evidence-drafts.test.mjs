import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURE, replayFixture, reduce } from '../src/ledger.mjs';
import { roles } from '../src/agents.mjs';

let instance = 0;
const decode = text => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

// A small DOM adapter for the app's documented controls. Textarea markup follows
// HTML's initial-LF rule; assigning the value property does not apply that rule.
// The application imports its real, local fixture ledger and role functions.
async function openApp() {
  const elements = new Map();
  const alerts = [];
  let reloads = 0;
  class Element {
    constructor(id) {
      this.id = id;
      this.textContent = '';
      this.listeners = new Map();
      this.value = '';
      this.readOnly = false;
      this.disabled = false;
      this._html = '';
    }
    addEventListener(type, callback) { this.listeners.set(type, callback); }
    set innerHTML(value) {
      this._html = value;
      if (this.id !== 'checkpoint-list') return;
      for (const key of [...elements.keys()]) {
        if (/^(evidence|suggest|approve)-/.test(key)) elements.delete(key);
      }
      for (const match of value.matchAll(/<textarea([^>]*)>([\s\S]*?)<\/textarea>/g)) {
        const id = /id="([^"]+)"/.exec(match[1])[1];
        const node = new Element(id);
        const text = decode(match[2]).replace(/\r\n?/g, '\n');
        node.value = text.startsWith('\n') ? text.slice(1) : text;
        node.readOnly = /\breadonly\b/.test(match[1]);
        elements.set(id, node);
      }
      for (const match of value.matchAll(/<button([^>]*)>[\s\S]*?<\/button>/g)) {
        const id = /data-id="([^"]+)"/.exec(match[1])?.[1];
        if (!id) continue;
        const classes = /class="([^"]+)"/.exec(match[1])?.[1].split(' ') ?? [];
        const kind = classes.includes('suggest') ? 'suggest' : 'approve';
        const node = new Element(`${kind}-${id}`);
        node.disabled = /\bdisabled\b/.test(match[1]);
        node.dataset = { id };
        node.classList = { contains: value => classes.includes(value) };
        elements.set(node.id, node);
      }
    }
    get innerHTML() { return this._html; }
  }
  for (const id of ['total', 'approved', 'captured', 'remaining', 'checkpoint-list',
    'role-cards', 'ledger-body', 'ledger-count', 'add-checkpoint', 'replay',
    'capture-title', 'capture-guidance', 'export-record', 'export-status']) {
    elements.set(id, new Element(id));
  }
  globalThis.document = {
    querySelector: selector => elements.get(selector.slice(1)) ?? null,
    getElementById: id => elements.get(id) ?? null,
  };
  globalThis.window = { location: { reload: () => { reloads++; } } };
  globalThis.alert = message => alerts.push(message);
  await import(new URL(`../app.mjs?evidence-test=${++instance}`, import.meta.url));
  return {
    elements, alerts,
    editor: id => elements.get(`evidence-${id}`),
    button: (kind, id) => elements.get(`${kind}-${id}`),
    click(kind, id) {
      elements.get('checkpoint-list').listeners.get('click')({ target: elements.get(`${kind}-${id}`) });
    },
    replay() { elements.get('replay').listeners.get('click')(); },
    reloads: () => reloads,
  };
}

test('approving one checkpoint preserves another pending draft, including initial line feeds', async () => {
  const app = await openApp();
  const draft = '\n\nDraft <note> & “quoted” 😀\n';
  app.editor('handoff').value = draft;
  app.editor('accessibility').value = '  Reviewed accessibility evidence  ';
  app.click('approve', 'accessibility');
  assert.equal(app.editor('handoff').value, draft);
  assert.equal(app.editor('accessibility').value, 'Reviewed accessibility evidence');
  assert.equal(app.elements.get('approved').textContent, '2 / 3');
});

test('refused approval retains empty and multiline drafts across repeated rerenders', async () => {
  const app = await openApp();
  app.editor('accessibility').value = '';
  app.editor('handoff').value = '\n\n';
  for (let i = 0; i < 3; i++) {
    app.click('approve', 'accessibility');
    assert.equal(app.editor('accessibility').value, '');
    assert.equal(app.editor('handoff').value, '\n\n');
    assert.equal(app.elements.get('ledger-count').textContent, '7 events');
  }
  assert.equal(app.alerts.length, 3);
});

test('a suggestion survives approval of a different checkpoint', async () => {
  const app = await openApp();
  app.click('suggest', 'accessibility');
  const expected = roles.evidenceMapper(FIXTURE.checkpoints.find(cp => cp.id === 'accessibility')).suggestedEvidence;
  app.editor('handoff').value = 'Reviewed handoff';
  app.click('approve', 'handoff');
  assert.equal(app.editor('accessibility').value, expected);
});

test('accepted evidence comes from its recorded event and its controls cannot edit approval', async () => {
  const app = await openApp();
  const recorded = replayFixture().events.find(event => event.type === 'checkpoint.approved').acceptedEvidence;
  assert.equal(app.editor('journey').value, recorded);
  assert.equal(app.editor('journey').readOnly, true);
  assert.equal(app.button('suggest', 'journey').disabled, true);
  assert.equal(app.button('approve', 'journey').disabled, true);
  app.editor('journey').value = 'Temporary programmatic value';
  app.click('suggest', 'journey');
  app.click('approve', 'journey');
  assert.equal(app.elements.get('ledger-count').textContent, '7 events');
  app.editor('accessibility').value = 'Second review';
  app.click('approve', 'accessibility');
  assert.equal(app.editor('journey').value, recorded);
});

test('literal textarea-like text is preserved without adding editors', async () => {
  const app = await openApp();
  const draft = '\nText </textarea> & <note> "quoted"\n';
  app.editor('handoff').value = draft;
  app.editor('accessibility').value = 'Review';
  app.click('approve', 'accessibility');
  assert.equal(app.editor('handoff').value, draft);
  assert.equal([...app.elements.keys()].filter(id => id.startsWith('evidence-')).length, 3);
});

test('successive approvals retain accepted evidence and count each approval once', async () => {
  const app = await openApp();
  app.editor('accessibility').value = 'Second accepted';
  app.editor('handoff').value = 'Third accepted';
  app.click('approve', 'accessibility');
  app.click('approve', 'handoff');
  assert.equal(app.editor('accessibility').value, 'Second accepted');
  assert.equal(app.editor('handoff').value, 'Third accepted');
  assert.equal(app.editor('handoff').readOnly, true);
  assert.equal(app.elements.get('approved').textContent, '3 / 3');
  assert.equal(app.elements.get('ledger-count').textContent, '9 events');
  assert.equal(app.elements.get('captured').textContent, '$400.00');
  assert.equal(app.elements.get('remaining').textContent, '$800.00');
});

test('fixture totals and explicit replay behavior remain intact', async () => {
  const app = await openApp();
  assert.equal(app.elements.get('total').textContent, '$1,200.00');
  assert.equal(app.elements.get('approved').textContent, '1 / 3');
  assert.equal(app.elements.get('captured').textContent, '$400.00');
  assert.equal(app.elements.get('remaining').textContent, '$800.00');
  assert.equal(app.elements.get('ledger-count').textContent, '7 events');
  app.replay();
  assert.equal(app.reloads(), 1);
});

// A recorded webhook does not itself prove this event counted a capture: the
// fixture deliberately keeps an unknown outcome until reconciliation.
test('webhook rows describe receipt without claiming an unknown capture was counted', async () => {
  const fixture = replayFixture();
  const received = fixture.events.findIndex(event => event.type === 'paypal.webhook.received');
  const prefix = reduce(fixture.events.slice(0, received + 1));
  assert.equal(prefix.checkpoints.journey.captureStatus, 'unknown');
  assert.equal(prefix.captured, 0);
  const app = await openApp();
  const rows = [...app.elements.get('ledger-body').innerHTML.matchAll(/<tr>(.*?)<\/tr>/g)].map(match => match[1]);
  assert.match(rows[received], /<td>webhook received<\/td>$/);
  assert.match(rows[received + 1], /<td>duplicate ignored<\/td>$/);
  assert.match(rows[received + 2], /<td>reconciled · counted once<\/td>$/);
  assert.equal(app.elements.get('captured').textContent, '$400.00');
});
