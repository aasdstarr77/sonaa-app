const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'App.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('app points to the production Sonaa API', () => {
  assert.match(app, /const API_BASE = 'https:\/\/sonaa-backend-v2\.vercel\.app\/api';/);
});

test('rating dismissal uses versioned encrypted storage and keeps migration keys', () => {
  assert.match(app, /sonaa\.rating\.dismissed\.v3:/);
  assert.match(app, /sonaa\.rating\.dismissed\.v1:/);
  assert.match(app, /sonaa\.rating\.dismissed\.v2:/);
  assert.match(app, /SecureStore\.getItemAsync\(ratingStorageKey\)/);
  assert.match(app, /SecureStore\.setItemAsync\(ratingStorageKey, JSON\.stringify\(merged\)\)/);
});

test('skipping a rating persists the order dismissal before closing the prompt', () => {
  const start = app.indexOf('async function skipRatingPrompt()');
  assert.notEqual(start, -1, 'skipRatingPrompt function should exist');
  const end = app.indexOf('\n  function renderRatingModal', start);
  assert.notEqual(end, -1, 'rating modal renderer should follow skip function');
  const body = app.slice(start, end);
  assert.match(body, /await saveRatingDismissal\(sn\)/);
  assert.match(body, /setRatingPrompt\(current => current && getOrderSN\(current\.order\) === sn \? null : current\)/);
});

test('rating dismissal state is loaded before being considered ready for the active account', () => {
  assert.match(app, /ratingDismissalsLoadedFor/);
  assert.match(app, /setRatingDismissalsLoaded\(false\)/);
  assert.match(app, /setRatingDismissalsLoadedFor\(ratingStorageKey\)/);
  assert.match(app, /setRatingDismissalsLoaded\(true\)/);
});

test('client and technician sessions are restored from SecureStore and validated', () => {
  assert.match(app, /sonaa\.auth\.session\.v1/);
  assert.match(app, /SecureStore\.getItemAsync\('sonaa\.auth\.session\.v1'\)/);
  assert.match(app, /!saved\?\.token \|\| !\['client', 'fanni'\]\.includes\(saved\.role\)/);
  assert.match(app, /SecureStore\.deleteItemAsync\('sonaa\.auth\.session\.v1'\)/);
});

test('foreground notifications are configured to show alerts and play sound', () => {
  assert.match(app, /Notifications\.setNotificationHandler\(/);
  assert.match(app, /shouldShowAlert: true/);
  assert.match(app, /shouldPlaySound: true/);
});

test('required runtime packages are declared', () => {
  for (const name of ['expo', 'react', 'react-native', 'expo-notifications', 'expo-secure-store']) {
    assert.ok(packageJson.dependencies[name], 'missing dependency: ' + name);
  }
});

test('client order cards define order inside the client orders map callback', () => {
  const clientScreenStart = app.indexOf("if (screen === 'client' && session?.role === 'client')");
  assert.notEqual(clientScreenStart, -1, 'client screen renderer should exist');
  const clientScreenEnd = app.indexOf("\n  if (screen === '", clientScreenStart + 10);
  const clientScreen = app.slice(clientScreenStart, clientScreenEnd === -1 ? undefined : clientScreenEnd);
  assert.match(
    clientScreen,
    /clientData\.orders\.filter\([\s\S]*?\)\.map\(\(order, i\) => \{[\s\S]*?const sn = getOrderSN\(order\)/,
    'client order rendering must declare order in the map callback before reading it'
  );
});

test('technician offer flow rejects missing order data before opening or submitting an offer', () => {
  const sendStart = app.indexOf('function sendOffer(order)');
  const submitStart = app.indexOf('async function submitOffer()', sendStart);
  assert.notEqual(sendStart, -1, 'technician sendOffer handler should exist');
  assert.notEqual(submitStart, -1, 'technician submitOffer handler should exist');
  const sendBody = app.slice(sendStart, submitStart);
  const submitEnd = app.indexOf('\n  async function cancelClientOrder', submitStart);
  assert.notEqual(submitEnd, -1, 'submitOffer should end before client order handlers');
  const submitBody = app.slice(submitStart, submitEnd);
  assert.match(sendBody, /!order \|\| typeof order !== 'object' \|\| !getOrderSN\(order\)/);
  assert.match(submitBody, /const orderSN = getOrderSN\(offerDraft\?\.order\)/);
  assert.match(submitBody, /if \(!orderSN \|\| !session\?\.token\)/);
  assert.match(submitBody, /encodeURIComponent\(orderSN\)/);
});

test('rating modal and rating submission safely handle missing technician order data', () => {
  const modalStart = app.indexOf('function renderRatingModal(role)');
  const modalEnd = app.indexOf('\n  async function sendAdminBroadcast', modalStart);
  assert.notEqual(modalStart, -1, 'rating modal renderer should exist');
  assert.notEqual(modalEnd, -1, 'rating modal renderer boundary should exist');
  const modalBody = app.slice(modalStart, modalEnd);
  assert.match(modalBody, /if \(!order \|\| typeof order !== 'object' \|\| !sn\) return null/);
  const submitStart = app.indexOf('async function submitOrderRating(order)');
  const submitEnd = app.indexOf('\n  async function ', submitStart + 10);
  assert.notEqual(submitStart, -1, 'rating submit handler should exist');
  assert.match(app.slice(submitStart, submitEnd), /!order \|\| typeof order !== 'object' \|\| !sn/);
  assert.match(app, /if \(!sn\) \{ setRatingPrompt\(null\); return; \}/);
});

test('Sonaa agreed tagline appears on login, opening splash, home, and technician screen', () => {
  const tagline = 'كل خدمة تبدأ بخطوة';
  assert.ok(app.includes('صُنّاع — كل خدمة تبدأ بخطوة'), 'login screen should show the full brand tagline');
  assert.ok(app.includes('<Text style={splashStyles.caption}>كل خدمة تبدأ بخطوة</Text>'), 'opening splash should show the agreed tagline');
  assert.ok(app.includes('<Text style={styles.homeTagline}>كل خدمة تبدأ بخطوة</Text>'), 'home screen should show the agreed tagline');
  assert.ok(app.includes('<Text style={styles.subtitle}>كل خدمة تبدأ بخطوة</Text>'), 'technician screen should show the agreed tagline');
});
