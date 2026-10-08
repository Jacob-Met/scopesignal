import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const source = resolve(process.argv[2]);
const output = resolve(process.argv[3]);
const { chromium } = await import('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const receipt = { source, at: new Date().toISOString(), checks: [], pageErrors: [], externalRequests: [], sourceSha256: {} };
const mime = { '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const path = resolve(source, '.' + pathname);
    assert(path.startsWith(source + sep));
    const data = await readFile(path);
    receipt.sourceSha256[path.slice(source.length + 1)] = createHash('sha256').update(data).digest('hex');
    res.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/workspace/scratch/3e50c5ad22c5/production/browser/chromium' });
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
await context.route('**/*', route => {
  if (new URL(route.request().url()).origin === origin) return route.continue();
  receipt.externalRequests.push(route.request().url());
  return route.abort();
});
const page = await context.newPage();
page.setDefaultTimeout(5000);
page.on('pageerror', error => receipt.pageErrors.push(error.message));

async function check(name, run) {
  try {
    const result = await run();
    receipt.checks.push({ name, pass: true, result });
  } catch (error) {
    receipt.checks.push({ name, pass: false, error: error.message });
  }
}

try {
  for (const [input, expected] of [
    ['90071992547409.91', '$90,071,992,547,409.91'],
    ['70368744177664.01', '$70,368,744,177,664.01'],
    ['0.01', '$0.01'],
  ]) {
    await check(`Entered cents remain exact in review and capture: ${input}`, async () => {
      await page.goto(origin + '/scope.html', { waitUntil: 'networkidle' });
      await page.locator('#draft-0-title').waitFor();
      await page.locator('button[data-remove="2"]').click();
      await page.locator('button[data-remove="1"]').click();
      await page.locator('#scope-cap').fill(input);
      await page.locator('#draft-0-amount').fill(input);
      const budget = await page.locator('#scope-budget').textContent();
      await page.locator('button[type="submit"]').click();
      assert.equal(await page.locator('#scope-review').isVisible(), true);
      const displayedCap = await page.locator('#scope-total').textContent();
      const displayedMilestone = await page.locator('.scope-review-heading strong').textContent();
      for (const action of ['approve', 'order', 'request', 'receipt']) {
        await page.locator(`button[data-checkpoint="scope-1"][data-action="${action}"]`).click();
      }
      const captured = await page.locator('#scope-captured').textContent();
      const details = { input, expected, displayedCap, displayedMilestone, captured, budget };
      await writeFile(resolve(output, `amount-${input}.json`), JSON.stringify(details, null, 2) + '\n');
      if (input === '90071992547409.91') await page.screenshot({ path: resolve(output, 'accepted-amount.png'), fullPage: true });
      assert.deepEqual([displayedCap, displayedMilestone, captured], [expected, expected, expected]);
      assert(budget.startsWith(expected + ' allocated'));
      return details;
    });
  }
  await check('The first approval locks the scope while retaining other evidence edits after a refused approval', async () => {
    await page.goto(origin + '/scope.html', { waitUntil: 'networkidle' });
    await page.locator('button[type="submit"]').click();
    const other = 'Retained local evidence with literal </textarea><script>globalThis.changed = true</script>\nSecond line';
    await page.locator('#review-evidence-scope-2').fill(other);
    await page.locator('#review-evidence-scope-1').fill(' \n ');
    await page.locator('[data-checkpoint="scope-1"][data-action="approve"]').click();
    assert.equal(await page.locator('#scope-event-count').textContent(), '0 events');
    assert.equal(await page.locator('#scope-edit').isDisabled(), false);
    await page.locator('#review-evidence-scope-1').fill('  Accepted revision one  ');
    await page.locator('[data-checkpoint="scope-1"][data-action="approve"]').click();
    assert.equal(await page.locator('#scope-edit').isDisabled(), true);
    assert.equal(await page.locator('#review-evidence-scope-1').inputValue(), 'Accepted revision one');
    assert.equal(await page.locator('#review-evidence-scope-1').getAttribute('readonly'), '');
    assert.equal(await page.locator('#review-evidence-scope-2').inputValue(), other);
    assert.equal(await page.evaluate(() => globalThis.changed), undefined);
    assert.equal(await page.locator('#scope-event-body tr').count(), 1);
  });
  assert.deepEqual(receipt.pageErrors, []);
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
  await writeFile(resolve(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
}
console.log(JSON.stringify(receipt.checks, null, 2));
if (receipt.checks.some(check => !check.pass)) process.exitCode = 1;
