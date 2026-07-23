import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3101';
const RESULTS = { passed: 0, failed: 0, errors: [] };
let browser, page;

function logResult(name, passed, detail = '') {
  const sym = passed ? '✓' : '✗';
  console.log(`${sym} ${name}${detail ? ' => ' + detail.slice(0, 120) : ''}`);
  if (passed) RESULTS.passed++;
  else { RESULTS.failed++; RESULTS.errors.push(`${name}: ${detail}`); }
}

async function collectConsoleErrors(page, route) {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning' && 
        !msg.text().includes('Synchronous XMLHttpRequest') &&
        !msg.text().includes('webkitdirectory') &&
        !msg.text().includes('getUserMedia')) {
      errors.push(`WARN: ${msg.text()}`);
    }
  });
  // Firefox/Chrome specific console errors
  page.on('crash', () => errors.push('Page crashed'));
  
  await page.goto(`${BASE_URL}${route}`, { timeout: 20000, waitUntil: 'networkidle' });
  await page.waitForTimeout(3000); // let client-side render/middleware redirects happen
  
  return errors;
}

async function checkAllLinks(page) {
  const links = await page.evaluate(() => 
    Array.from(document.querySelectorAll('a[href]'))
      .map(a => a.getAttribute('href'))
      .filter(h => h && !h.startsWith('#') && !h.startsWith('tel:') && !h.startsWith('mailto:') && !h.startsWith('data:'))
  );
  return [...new Set(links)];
}

async function check404s(page, baseUrl) {
  const responses = [];
  page.on('requestfailed', req => {
    responses.push({ url: req.url().replace(baseUrl, '').slice(0, 80), error: req.failure()?.errorText || 'FAILED' });
  });
  page.on('response', resp => {
    if (resp.status() >= 400) {
      const url = resp.url();
      // Only log non-Chrome extension URLs
      if (!url.startsWith('chrome-extension') && !url.startsWith('data:')) {
        responses.push({ url: url.replace(baseUrl, '').slice(0, 80), status: resp.status() });
      }
    }
  });
  return responses;
}

const routes = [
  { name: 'Landing', path: '/', auth: false },
  { name: 'Login', path: '/login', auth: false },
  { name: 'Register', path: '/register', auth: false },
  { name: 'About', path: '/about', auth: false },
  { name: 'Privacy', path: '/privacy', auth: false },
  { name: 'Terms', path: '/terms', auth: false },
  { name: 'Settings hub (redirect)', path: '/settings', auth: true },
  { name: 'Dashboard (redirect)', path: '/dashboard', auth: true },
  { name: 'Transactions (redirect)', path: '/transactions', auth: true },
  { name: 'Forecast (redirect)', path: '/forecast', auth: true },
  { name: 'Copilot (redirect)', path: '/copilot', auth: true },
  { name: 'Admin (redirect)', path: '/admin', auth: true },
];

const publicRoutes = routes.filter(r => !r.auth);
const authRoutes = routes.filter(r => r.auth);

async function run() {
  console.log('\n=== FinFlow Runtime Validation ===\n');
  console.log(`Server: ${BASE_URL}\n`);

  // Test auth redirects first
  browser = await chromium.launch({ headless: true });
  
  // Create a separate context for auth tests
  const ctx = await browser.newContext({ 
    ignoreHTTPSErrors: true,
    bypassCSP: true,
  });
  page = await ctx.newPage();

  /*** AUTH REDIRECT TESTS ***/
  console.log('--- Auth Redirects ---');
  for (const route of authRoutes) {
    const start = Date.now();
    const errors = await collectConsoleErrors(page, route.path);
    await page.waitForTimeout(1000);
    const finalUrl = page.url();

    // Should have been redirected to /login
    if (finalUrl.includes('/login')) {
      logResult(`${route.name} (${route.path}) → redirected to login (${finalUrl.slice(0, 50)})`, true);
    } else {
      // Check if no redirect == homepage
      logResult(`${route.name} (${route.path}) → ${finalUrl.slice(0, 60)}`, false, 'Expected redirect to /login');
    }
    
    // Check for errors
    const msgs = errors.filter(e => !e.includes('favicon') && !e.includes('Failed to load data'));
    if (msgs.length > 0) {
      msgs.forEach(m => logResult(`${route.name} console error`, false, m.slice(0, 150)));
    }
    const dur = Date.now() - start;
    logResult(`${route.name} load time`, dur < 10000, `${dur}ms`);
  }

  /*** PUBLIC ROUTE RENDERING ***/
  console.log('\n--- Public Route Rendering ---');
  for (const route of publicRoutes) {
    const errors = await collectConsoleErrors(page, route.path);
    const statusCode = await page.evaluate(() => document.title !== undefined);
    
    // Check for 404s and errors
    const msgs = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('Failed to load data') &&
      !e.includes('Failed to load resource') &&
      e !== 'undefined'
    );
    
    if (msgs.length > 0) {
      msgs.forEach(m => logResult(`${route.name} console`, false, String(m).slice(0, 200)));
    } else {
      logResult(`${route.name} no console errors`, true);
    }
    
    // Check content actually rendered
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 100));
    const hasContent = bodyText.length > 20;
    logResult(`${route.name} content rendered`, hasContent, bodyText.slice(0, 80));
  }

  /*** VERIFY ALL PAGES LOAD ***/
  console.log('\n--- Verify all distinct routes return 200 ---');
  const visitedRoutes = [];

  // Check all public routes render OK
  for (const route of publicRoutes) {
    const resp = await page.goto(`${BASE_URL}${route.path}`, { timeout: 20000, waitUntil: 'networkidle' });
    const status = resp ? resp.status() : 0;
    visitedRoutes.push({ path: route.path, status });
    logResult(`${route.path} HTTP ${status}`, status < 400);
  }

  // Also verify auth-protected pages redirect (HTTP would be 200 from server, client JS handles it)
  // actually playwrgiht will see the final SPA page
  for (const route of authRoutes) {
    await page.goto(`${BASE_URL}${route.path}`, { timeout: 20000, waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const finalUrl = page.url();
    // The page should have tried to redirect to /login
    // might stay on the page due to client-rendering, but no 404
    visitedRoutes.push({ path: route.path, status: finalUrl.includes('/login') ? 302 : 200 });
  }

  // Check all APIs are reachable
  const apis = [
    { name: 'AI Chat', path: '/api/ai/chat' },
  ];
  console.log('\n--- API endpoints ---');
  for (const api of apis) {
    try {
      const resp = await page.request.get(`${BASE_URL}${api.path}`);
      // Bug: POST-only endpoint returning 405 is OK
      for (const [key, value] of resp.headers()) {
        if (key === 'content-type' && value.includes('text/html')) {
          if (resp.status() >= 500) {
            logResult(`${api.name} ${api.path}`, false, `${resp.status()} - HTML returned`);
          } else {
            logResult(`${api.name} ${api.path} (expected error - POST only)`, true);
          }
        }
      }
      if (!visitedRoutes.find(v => v.path === api.path)) {
        visitedRoutes.push({ path: api.path, status: resp.status() });
      }
    } catch (e) {
      logResult(`${api.name} ${api.path}`, false, e.message);
    }
  }

  /*** ROUTE MAP COMPLETENESS ***/
  console.log('\n--- Route map (all paths) ---');
  visitedRoutes.forEach(r => {
    const status = r.status < 400 ? 'OK' : `HTTP ${r.status}`;
    console.log(`  ${status === 'OK' ? '✓' : '✗'} ${r.path} [${r.status}]`);
  });

  /*** METRICS ***/
  console.log(`\n--- RESULTS: ${RESULTS.passed} passed, ${RESULTS.failed} failed ---\n`);
  
  if (RESULTS.errors.length > 0) {
    console.log('Errors:');
    RESULTS.errors.forEach(e => console.log(`  ${e.slice(0, 200)}`));
  }

  await ctx.close();
  await browser.close();
  
  process.exit(RESULTS.failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
