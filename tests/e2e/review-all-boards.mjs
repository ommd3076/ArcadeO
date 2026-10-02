import { chromium } from 'playwright';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
const creds = JSON.parse(fs.readFileSync('.local/accounts.json', 'utf8'));
const browser = await chromium.launch({ headless: true });
const review = [];
fs.mkdirSync('tests/e2e/evidence/final-boards', { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const login = await context.request.post('http://localhost:8787/api/v1/auth/login', { headers: { Origin: 'http://localhost:8787' }, data: { username: creds.playerAUser, password: creds.playerAPassword } });
  if (!login.ok()) throw new Error('Review login failed: ' + login.status() + ' ' + await login.text());
  const session = await (await context.request.get('http://localhost:8787/api/v1/auth/session')).json();
  const headers = { 'X-CSRF-Token': session.csrfToken, Origin: 'http://localhost:8787' };
  const page = await context.newPage();
  let errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const getView = async id => (await context.request.get('http://localhost:8787/api/v1/matches/' + id)).json();
  const action = async (view, name, payload = {}) => {
    const response = await context.request.post('http://localhost:8787/api/v1/matches/' + view.matchId + '/actions', { headers, data: { protocolVersion: 1, matchId: view.matchId, actionId: randomUUID(), action: name, payload, expectedVersion: view.deliveryVersion, ...(view.mode === 'together' ? { controllerGeneration: view.controller.controllerGeneration } : {}), ...(!name.startsWith('match.') ? { turnId: view.turnId } : {}) } });
    const reply = await response.json();
    if (reply.status !== 'accepted') throw new Error(name + ' rejected: ' + reply.code);
    return reply.view;
  };
  for (const game of ['connect-four', 'ludo', 'snakes-and-ladders', 'dots-boxes', 'sos', 'rock-paper-scissors', 'hand-cricket', 'sudoku']) {
    errors = [];
    const mode = game === 'sudoku' ? 'practice' : 'together';
    const creation = await context.request.post('http://localhost:8787/api/v1/matches', { headers, data: { creationId: randomUUID(), gameId: game, mode, gameOptions: game === 'sudoku' ? { puzzleId: 'easy-002' } : game === 'rock-paper-scissors' ? { format: 'best-of-3' } : {} } });
    const created = await creation.json();
    const owned = creation.ok();
    const id = created.matchId || created.existingMatchId;
    const row = { game, id, owned, screenshots: [], errors: [], checks: [] };
    review.push(row);
    if (!id) { row.errors.push('creation failed: ' + creation.status()); continue; }
    let view = await getView(id);
    if (owned && view.lifecycle === 'waiting' && view.legalActions.includes('match.ready')) view = await action(view, 'match.ready');
    await page.goto('http://localhost:8787/matches/' + id);
    await page.waitForTimeout(500);
    for (const [label, width, height] of [['phone-320', 320, 740], ['phone-390', 390, 844], ['laptop', 1366, 900]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(120);
      if (owned && ['rock-paper-scissors','hand-cricket'].includes(game)) {
        if (game === 'hand-cricket' && await page.getByTestId('cricket-choose-bat').count()) { await page.getByTestId('cricket-choose-bat').click(); await page.waitForTimeout(250); }
        const unmask = page.getByRole('button', { name: 'Resume & Unmask' });
        if (await unmask.count() && await unmask.isEnabled()) await unmask.click();
        const ready = page.getByRole('button', { name: /I am .*Ready/ });
        if (await ready.count() && await ready.isEnabled()) await ready.click();
        await page.waitForTimeout(120);
      }
      const file = 'tests/e2e/evidence/final-boards/' + game + '-' + label + '.png';
      await page.screenshot({ path: file, fullPage: true });
      row.screenshots.push(file);
      row.checks.push({ size: label, scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth), viewport: width });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    if (owned && game === 'hand-cricket' && await page.getByTestId('cricket-choose-bat').count()) {
      await page.getByTestId('cricket-choose-bat').click();
      await page.waitForTimeout(500);
      row.checks.push({ transition: 'ordinary UI toss choice', text: (await page.locator('body').innerText()).slice(0, 180) });
      await page.screenshot({ path: 'tests/e2e/evidence/final-boards/cricket-after-role.png', fullPage: true });
    }
    if (owned && ['connect-four', 'ludo', 'snakes-and-ladders'].includes(game)) {
      const locator = game === 'connect-four' ? page.getByRole('button', { name: 'Drop disc into column 1', exact: true }) : game === 'ludo' ? page.getByTestId('ludo-roll-button') : page.getByRole('button', { name: /Roll Dice/ });
      if (await locator.count() && await locator.isEnabled()) { await locator.click(); await page.waitForTimeout(450); row.checks.push({ transition: 'ordinary UI accepted move', savedVersion: (await getView(id)).deliveryVersion }); }
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(150);
    await page.screenshot({ path: 'tests/e2e/evidence/final-boards/' + game + '-reduced-motion.png', fullPage: true });
    row.checks.push({ reducedMotion: await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches) });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    if (!errors.length) {
      await page.getByRole('button', { name: 'Match Options', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor(); await page.keyboard.press('Tab');
      row.checks.push({ dialogFocusTrapped: await dialog.evaluate(el => el.contains(document.activeElement)) });
      await page.keyboard.press('Escape');
      row.checks.push({ escapeClosedDialog: await dialog.count() === 0 });
    }
    row.errors.push(...errors);
    if (owned) {
      view = await getView(id);
      if (view.lifecycle === 'active' && view.mode === 'together') { await action(view, 'match.agree-abandon'); row.cleanup = 'unscored abandonment'; }
      else if (view.lifecycle === 'active' && view.mode === 'practice' && owned) { await action(view, 'match.request-abandon'); row.cleanup = 'solo unscored discard'; }
      else row.cleanup = view.lifecycle;
    } else row.cleanup = 'preexisting match untouched';
    fs.writeFileSync('tests/e2e/evidence/final-boards/review.json', JSON.stringify(review, null, 2));
  }
  console.log(JSON.stringify(review.map(row => ({ game: row.game, owned: row.owned, errors: row.errors, cleanup: row.cleanup, checks: row.checks })), null, 2));
} finally { await browser.close(); fs.writeFileSync('tests/e2e/evidence/final-boards/review.json', JSON.stringify(review, null, 2)); }
