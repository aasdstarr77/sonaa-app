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
  assert.match(app, /const serialized = JSON\.stringify\(merged\)/);
  assert.match(app, /SecureStore\.setItemAsync\(ratingStorageKey, serialized\)/);
});

test('rating prompt has no skip action and submits from a compact five-star row', () => {
  const modalStart = app.indexOf('function renderRatingModal(role)');
  const modalEnd = app.indexOf('\n  async function sendAdminBroadcast', modalStart);
  assert.notEqual(modalStart, -1, 'rating modal renderer should exist');
  const modalBody = app.slice(modalStart, modalEnd);
  assert.ok(modalBody.includes('renderRatingStars(order, stars, true)'), 'modal should use compact stars');
  assert.ok(modalBody.includes("submitting ? '...' : 'تقييم'"), 'modal should show the تقييم button');
  assert.ok(!modalBody.includes('تخطي'), 'rating modal must not have a skip button');
  assert.ok(!modalBody.includes('تعليق (اختياري)'), 'rating modal should only ask for stars');
  assert.ok(modalBody.includes('onRequestClose={() => {}}'), 'back action must not dismiss the rating prompt');
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

test('push token registration posts the Expo token for the active session and cleans up', () => {
  assert.ok(app.includes('Notifications.getExpoPushTokenAsync({ projectId })'));
  assert.ok(app.includes('pushTokenRef.current = result.data'));
  assert.ok(app.includes('body: { token: result.data, platform: Platform.OS }'));
  assert.ok(app.includes('return () => { cancelled = true; };'));
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

test('Sonaa splash caption changes while the spinning logo word remains unchanged', () => {
  assert.ok(app.includes('<Animated.Text style={[splashStyles.spinningWord, { transform: [{ rotate: spinRotation }] }]}>صُنّاع</Animated.Text>'), 'spinning logo word should remain unchanged');
  assert.ok(app.includes('<Text style={splashStyles.caption}>كل خدمة تبدأ بخطوة</Text>'), 'splash caption should use the agreed tagline');
  assert.ok(app.includes('<Text style={styles.homeTaglinePremium}>بنوصّل الخدمة بالفرصة</Text>'), 'home tagline should retain the premium home design');
  assert.ok(!app.includes('صُنّاع — كل خدمة تبدأ بخطوة'), 'login should not receive the splash-only tagline');
  assert.ok(!app.includes('<Text style={styles.subtitle}>كل خدمة تبدأ بخطوة</Text>'), 'technician screen should not receive the splash-only tagline');
});

test('rating prompt appears only when an order transitions to completed while its role is active', () => {
  assert.ok(app.includes('ratingStatusSnapshotRef'), 'previous order statuses should be tracked');
  assert.ok(app.includes('previousStatus && !isCompletedStatus(previousStatus) && isCompletedStatus(status)'), 'prompt should depend on a transition into completed');
  assert.ok(app.includes('if (candidate) setRatingPrompt(current => current || candidate)'), 'only one pending prompt should open at a time');
  assert.ok(app.includes('⭐ قيّم الفني'), 'client keeps a manual rating option in previous orders');
  assert.ok(app.includes('⭐ قيّم العميل'), 'technician keeps a manual rating option in completed jobs');
});

test('blue keyboard send action sends messages in client, technician, and support chats', () => {
  assert.ok(app.includes('returnKeyType="send" onSubmitEditing={() => sendOrderChat('), 'client chat should send from keyboard action');
  assert.ok(app.includes('returnKeyType="send" onSubmitEditing={() => sendOrderChat(item)}'), 'technician chat should send from keyboard action');
  assert.ok(app.includes('returnKeyType="send" onSubmitEditing={() => sendSupportMessage(false)}'), 'support chat should send from keyboard action');
  assert.ok(app.includes('returnKeyType="send" onSubmitEditing={sendRecoveryMessage}'), 'recovery chat should send from keyboard action');
});

test('pre-acceptance chat exposes the server-approved quick questions and replies', () => {
  for (const phrase of ['هل السعر شامل؟', 'متى تقدر تيجي؟', 'هل في تكلفة إضافية؟', 'نعم', 'لا', 'حسب الاتفاق']) assert.ok(app.includes(phrase), 'missing quick chat action: ' + phrase);
});

test('accepted technician jobs load private client details through the authorized API and show call action', () => {
  assert.ok(app.includes('/assigned-details'));
  assert.ok(app.includes('📞 اتصال بالعميل'));
  assert.ok(app.includes('العنوان بالتفصيل:'));
  assert.ok(app.includes('تفاصيل الشغل من العميل'));
});

test('accepted technician details request is not cancelled by its own loading-state update', () => {
  assert.ok(app.includes(".then(result => { setAssignedDetails(current => ({ ...current, [sn]: { loading: false, order: result.order || result.data || null, error: '' } })); })"));
  assert.ok(app.includes(".catch(error => { setAssignedDetails(current => ({ ...current, [sn]: { loading: false, order: null, error: error.message || 'تعذر تحميل تفاصيل العميل' } })); });"));
  assert.ok(!app.includes("if (active) setAssignedDetails(current => ({ ...current, [sn]: { loading: false, order: result.order"));
});

test('technician price increase and client approval controls are wired to existing backend routes', () => {
  assert.ok(app.includes('/price-change'));
  assert.ok(app.includes('إرسال طلب الزيادة'));
  assert.ok(app.includes('موافقة على الزيادة'));
  assert.ok(app.includes('رفض الزيادة'));
  assert.ok(app.includes('لازم السعر الجديد يكون أعلى من السعر الحالي'));
});

test('technician sees a pending price-increase status in the chat to prevent duplicate requests', () => {
  assert.ok(app.includes("تم تقديم طلبك، في انتظار رد العميل."));
  assert.ok(app.includes("لا ترسل طلبًا آخر قبل رد العميل."));
  assert.ok(app.includes("(orderChats[sn]?.priceChangeRequests||[]).map(request=>"));
  assert.ok(app.includes("request.status==='مقبول'?'وافق العميل على زيادة السعر.'"));
  assert.ok(app.includes("request.status==='مرفوض'?'رفض العميل الزيادة؛ السعر السابق ما زال ساريًا.'"));
});

test('client and technician notifications continue polling while their app screen is open', () => {
  assert.match(app, /setInterval\(\(\) => loadRoleNotifications\(false\), 5000\)/);
  assert.match(app, /setInterval\(pollOpenChats, 3000\)/);
});


test('technician order cards label area and client budget and invite technicians to submit an offer', () => {
  assert.ok(app.includes('المنطقة: {item.area || \'غير محددة\'} • ميزانية العميل:'));
  assert.ok(app.includes('`حوالي ${item.budget} جنيه`'));
  assert.ok(app.includes('يمكنك تقديم عرضك بالسعر المناسب لك.'));
});

test('client service description is prominent and readable on technician job cards and accepted job details', () => {
  assert.ok(app.includes('serviceDescriptionBox: { backgroundColor: \'#EFF6FF\''));
  assert.ok(app.includes('serviceDescriptionText: { color: \'#0F172A\', fontSize: 18, fontWeight: \'600\', lineHeight: 28'));
  assert.ok(app.includes('تفاصيل الخدمة من العميل</Text><Text style={styles.serviceDescriptionText}>{item.description'));
  assert.ok(app.includes('تفاصيل الشغل من العميل</Text><Text style={styles.serviceDescriptionText}>{assignedDetails[sn].order.description'));
});

test('client orders and technician offers are deduplicated by serial number on every refresh', () => {
  assert.ok(app.includes('function uniqueByOrderSN(items)'));
  assert.equal(app.split("orders: uniqueByOrderSN(toList(result, ['orders']))").length - 1, 2);
  assert.ok(app.includes("offers: results[1].status === 'fulfilled' ? uniqueByOrderSN(toList(results[1].value, ['offers'])) : current.offers"));
  assert.ok(app.includes("function uniqueByOrderSN(items)"));
  assert.ok(app.includes("const sn = getOrderSN(item)"));
  assert.ok(app.includes("indexBySN.set(sn, result.length)"));
});

test('client previous completed orders expose a manual technician rating button without showing it for canceled or already-rated orders', () => {
  assert.ok(app.includes("clientTab === 'previous' && ['تم الانتهاء','منتهي','مكتمل','مكتملة','completed','complete','finished']"));
  assert.ok(app.includes('⭐ قيّم الفني'));
  assert.ok(app.includes("setRatingPrompt({ role: 'client', order })"));
  assert.ok(app.includes("(order.ratings || []).some(r => r.reviewerRole === 'client')"));
});

test('technician completed orders expose a manual client rating button only when not already rated', () => {
  assert.ok(app.includes("tab === 'completed' && !alreadyRatedByTechnician"));
  assert.ok(app.includes('⭐ قيّم العميل'));
  assert.ok(app.includes("setRatingPrompt({ role: 'fanni', order: item })"));
  assert.ok(app.includes("(item.ratings || []).some(r => r.reviewerRole === 'fanni')"));
});

test('client current orders tab is labeled الطلبات الجارية', () => {
  assert.ok(app.includes("{key:'current',label:'الطلبات الجارية'"));
  assert.ok(!app.includes("{key:'current',label:'جارية'"));
});

test('client and technician notifications visually distinguish unread items and provide read all', () => {
  assert.equal(app.split('title="قراءة الكل" secondary onPress={markAllNotificationsRead}').length - 1, 2);
  assert.equal(app.split('(item.read || item.readAt) ? styles.notificationRead : styles.notificationUnread').length - 1, 2);
  assert.ok(app.includes("notificationRead: { backgroundColor: '#F8FAFC', opacity: 0.62 }"));
  assert.ok(app.includes("notificationReadText: { color: '#64748B' }"));
  assert.ok(app.includes("unread: 0 }));"));
});

test('mark all notifications read clears unread count and dims all notifications', () => {
  assert.ok(app.includes('items: current.items.map(n => ({ ...n, read: true, readAt: n.readAt || new Date().toISOString() })), unread: 0'));
});
