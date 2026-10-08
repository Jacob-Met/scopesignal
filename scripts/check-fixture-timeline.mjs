// Optional real-browser receiving for the event timeline. Uses only a temporary
// local static server and fresh browser contexts; external requests are blocked.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.env.SCOPESIGNAL_SOURCE || '.');
const output = resolve(process.env.SCOPESIGNAL_EVIDENCE || 'out/timeline-receiving');
const modulePath = process.env.SCOPESIGNAL_PLAYWRIGHT;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const checks = [], failures = [], errors = [], externalRequests = [];
const served = new Map();
const fixtureFont = 'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&display=swap';
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const path = resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
    if (!path.startsWith(root + sep)) throw new Error('Outside source root');
    const bytes = await readFile(path);
    served.set(path.slice(root.length + 1), createHash('sha256').update(bytes).digest('hex'));
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
let browser;

async function check(name, run) {
  try { await run(); checks.push({ name, result: 'pass' }); return true; }
  catch (error) {
    const result = { name, result: 'fail', error: error.message };
    checks.push(result); failures.push(result); return false;
  }
}

async function contextFor(viewport) {
  const context = await browser.newContext({ viewport });
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    externalRequests.push(route.request().url());
    return route.abort();
  });
  return context;
}

async function workspaceState(page) {
  return page.evaluate(() => ({
    approved: document.querySelector('#approved').textContent,
    captured: document.querySelector('#captured').textContent,
    remaining: document.querySelector('#remaining').textContent,
    count: document.querySelector('#ledger-count').textContent,
    events: document.querySelector('#ledger-body').textContent,
    captureTitle: document.querySelector('#capture-title').textContent,
    evidence: [...document.querySelectorAll('#checkpoint-list textarea')].map(editor => ({
      id: editor.id, value: editor.value, readOnly: editor.readOnly,
    })),
  }));
}

async function prefix(page, index) {
  const states = ['Not started', 'Not started', 'Ready', 'Pending', 'Unknown', 'Unknown', 'Unknown', 'Captured'];
  const labels = [
    'Before human approval', 'Human approves the checkpoint', 'Fixture order created',
    'Capture requested', 'Capture response lost', 'Webhook received',
    'Duplicate webhook received', 'Capture reconciled',
  ];
  assert.equal(await page.locator('#timeline-position').innerText(), 'Event ' + index + ' of 7');
  assert.equal(await page.locator('#timeline-title').innerText(), labels[index]);
  assert.equal(await page.locator('#timeline-capture-state').innerText(), states[index]);
  assert.equal(await page.locator('#fixture-timeline').getAttribute('data-capture-state'), states[index].toLowerCase().replace(' ', '_'));
  assert.equal(await page.locator('#timeline-counted').innerText(), index === 7 ? '$400.00' : '$0.00');
  assert.equal(await page.locator('#timeline-remaining').innerText(), index === 7 ? '$800.00' : '$1,200.00');
  assert.equal(await page.locator('#timeline-approved').innerText(), index === 0 ? '0 / 3' : '1 / 3');
  assert.equal(await page.locator('#timeline-order').innerText(), index < 2 ? 'No order' : 'SANDBOX-JOURNEY');
  assert.equal(await page.locator('#timeline-capture-id').innerText(), index === 7 ? 'CAP-FIXTURE-001' : 'No confirmed capture');
  assert.match(await page.locator('#timeline-status').textContent(), new RegExp('Event ' + index + ' of 7'));
  if (index >= 4 && index <= 6) assert.match(await page.locator('#timeline-guidance').innerText(), /Do not retry blindly/);
}

try {
  browser = await chromium.launch({ headless: true, ...(process.env.SCOPESIGNAL_CHROME ? { executablePath: process.env.SCOPESIGNAL_CHROME } : {}) });
  await mkdir(output, { recursive: true });
  let foundTimeline = false;
  for (const [label, viewport] of [
    ['desktop', { width: 1280, height: 1000 }],
    ['phone', { width: 390, height: 844 }],
    ['narrow-phone', { width: 320, height: 568 }],
  ]) {
    const context = await contextFor(viewport);
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(3000);
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin, { waitUntil: 'networkidle' });
      await page.locator('#evidence-handoff').waitFor();
      const available = await check(label + ': recovery timeline is discoverable and keyboard operable', async () => {
        assert.equal(await page.locator('#fixture-timeline').count(), 1, 'Original source has no event-by-event recovery timeline');
        await page.locator('#fixture-timeline summary').focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('#fixture-timeline').getAttribute('open'), '');
        assert.equal(await page.locator('#timeline-event').isEnabled(), true);
        assert.equal(await page.locator('#timeline-event option').count(), 8);
        assert.equal(await page.locator('#timeline-previous').isDisabled(), true);
        assert.equal(await page.locator('#timeline-next').isEnabled(), true);
        assert.equal(await page.locator('#timeline-status').getAttribute('role'), 'status');
        assert.equal(await page.locator('#timeline-status').getAttribute('aria-atomic'), 'true');
        await prefix(page, 0);
      });
      if (!available) continue;
      foundTimeline = true;

      await check(label + ': all eight rendered prefixes show exact capture and counting transitions', async () => {
        for (let index = 0; index <= 7; index += 1) {
          if (index) await page.locator('#timeline-next').click();
          await prefix(page, index);
          assert.equal(await page.locator('#captured').innerText(), '$400.00');
          assert.equal(await page.locator('#ledger-count').innerText(), '7 events');
        }
        assert.equal(await page.locator('#timeline-next').isDisabled(), true);
      });

      await check(label + ': native keyboard navigation can revisit uncertain and completed outcomes', async () => {
        await page.locator('#timeline-event').focus();
        await page.keyboard.press('Home');
        await prefix(page, 0);
        await page.keyboard.press('End');
        await prefix(page, 7);
        await page.keyboard.press('ArrowUp');
        await prefix(page, 6);
        await page.locator('#timeline-previous').focus();
        await page.keyboard.press('Space');
        await prefix(page, 5);
        await page.locator('#timeline-next').focus();
        await page.keyboard.press('Enter');
        await prefix(page, 6);
      });

      await check(label + ': inspection preserves current approvals, literal evidence drafts and ledger events', async () => {
        await page.locator('#evidence-accessibility').fill('Human reviewed the accessibility evidence before timeline navigation.');
        await page.locator('.approve[data-id="accessibility"]').click();
        const draft = '\nPending </textarea><img id="timeline-injected" src=x onerror="globalThis.injected=true"> & “quoted” 😀\n';
        await page.locator('#evidence-handoff').fill(draft);
        const before = await workspaceState(page);
        assert.equal(before.approved, '2 / 3');
        assert.equal(before.count, '8 events');
        for (const index of [0, 4, 6, 7, 3, 0, 7]) {
          await page.locator('#timeline-event').selectOption(String(index));
          await prefix(page, index);
        }
        assert.deepEqual(await workspaceState(page), before);
        assert.equal(await page.locator('#evidence-handoff').inputValue(), draft);
        assert.equal(await page.locator('#timeline-injected').count(), 0);
      });

      await check(label + ': invalid and endpoint navigation leaves the current step intact', async () => {
        await page.locator('#timeline-event').selectOption('4');
        const before = await workspaceState(page);
        await page.locator('#timeline-event').evaluate(select => {
          const option = document.createElement('option');
          option.value = '999';
          option.textContent = 'Invalid receiving input';
          select.add(option);
          select.value = '999';
          select.dispatchEvent(new Event('change', { bubbles: true }));
          option.remove();
        });
        await prefix(page, 4);
        assert.equal(await page.locator('#timeline-event').inputValue(), '4');
        await page.locator('#timeline-event').selectOption('0');
        await page.locator('#timeline-previous').dispatchEvent('click');
        await prefix(page, 0);
        await page.locator('#timeline-event').selectOption('7');
        await page.locator('#timeline-next').dispatchEvent('click');
        await prefix(page, 7);
        assert.deepEqual(await workspaceState(page), before);
      });

      await check(label + ': expanded timeline fits the viewport and retains touch-sized controls', async () => {
        const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
        assert(dimensions.document <= dimensions.viewport + 1, JSON.stringify(dimensions));
        for (const id of ['timeline-event', 'timeline-previous', 'timeline-next']) {
          const box = await page.locator('#' + id).boundingBox();
          assert(box.height >= 44, id + ' is shorter than 44 CSS pixels');
          assert(box.x >= 0 && box.x + box.width <= viewport.width + 1, id + ' overflows the viewport');
        }
      });
      await page.locator('#timeline-event').selectOption('4');
      await page.locator('#fixture-timeline').screenshot({ path: resolve(output, label + '-unknown.png') });
      await page.locator('#timeline-event').selectOption('7');
      await page.locator('#fixture-timeline').screenshot({ path: resolve(output, label + '-reconciled.png') });
    } finally { await context.close(); }
  }

  if (foundTimeline) {
    const context = await contextFor({ width: 1280, height: 1000 });
    try {
      await context.route(origin + '/src/fixture-timeline.mjs', route => route.fulfill({
        contentType: 'text/javascript',
        body: 'export function createFixtureTimeline() { throw new Error("Injected receiving failure"); }',
      }));
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin, { waitUntil: 'networkidle' });
      await page.locator('#evidence-handoff').waitFor();
      await check('timeline startup failure remains visible and does not disable the existing workspace', async () => {
        await page.locator('#fixture-timeline summary').click();
        assert.equal(await page.locator('#timeline-status').isVisible(), true);
        assert.match(await page.locator('#timeline-status').innerText(), /could not load/);
        assert.equal(await page.locator('#timeline-event').isDisabled(), true);
        assert.equal(await page.locator('#timeline-next').isDisabled(), true);
        assert.equal(await page.locator('#timeline-display').isHidden(), true);
        await page.locator('#evidence-handoff').fill('Human reviewed handoff during unavailable timeline.');
        await page.locator('.approve[data-id="handoff"]').click();
        assert.equal(await page.locator('#approved').innerText(), '2 / 3');
        assert.equal(await page.locator('#captured').innerText(), '$400.00');
        assert.equal(await page.locator('#ledger-count').innerText(), '8 events');
      });
    } finally { await context.close(); }
  }
  await check('no browser script errors or unexpected external request attempts', async () => {
    assert.deepEqual(errors, []);
    assert.deepEqual(externalRequests.filter(url => url !== fixtureFont), []);
  });
} catch (error) {
  failures.push({ name: 'browser setup or execution', result: 'fail', error: error.stack });
} finally {
  const receipt = {
    schema: 'scopesignal.fixture-timeline-receiving.v1',
    at: new Date().toISOString(),
    node: process.version,
    browser: browser?.version() || null,
    source: root,
    sourceCommit: process.env.SCOPESIGNAL_SOURCE_COMMIT || null,
    origin,
    servedSha256: Object.fromEntries([...served].sort()),
    checks, failures, pageErrors: errors, externalRequests,
    passed: failures.length === 0,
  };
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt, null, 2));
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
if (failures.length) process.exitCode = 1;
