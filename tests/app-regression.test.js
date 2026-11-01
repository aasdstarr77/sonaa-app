const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
function collectJavaScript(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectJavaScript(fullPath) : /\.js$/.test(entry.name) ? [fs.readFileSync(fullPath, 'utf8')] : [];
  }).join('\n');
}
const app = fs.readFileSync(path.join(root, 'App.js'), 'utf8') + '\n' + collectJavaScript(path.join(root, 'src'));
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
  const clientScreen = fs.readFileSync(path.join(root, 'src/screens/client/ClientDashboard.js'), 'utf8');
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
  assert.match(app.slice(submitStart, submitEnd), /if \(!order \|\| typeof order !== 'object' \|\| !sn\) \{[\s\S]*?setRatingPrompt\(null\)/);
});

test('brand header keeps one straight word with the animated shimmer layered over it', () => {
  const appEntry = fs.readFileSync(path.join(root, 'App.js'), 'utf8');
  assert.ok(appEntry.includes('<Text style={styles.brandHeaderTitle}>صُنّاع</Text>'), 'brand word should be rendered once as native text');
  assert.ok(appEntry.includes('Animated.View pointerEvents="none" style={[styles.brandHeaderShimmer'), 'shimmer should be an overlay, not another text layer');
  assert.ok(appEntry.includes('<LinearGradient colors={['), 'the shine gradient should remain animated over the word');
  assert.ok(!appEntry.includes('react-native-svg'), 'the SVG mask that caused duplicate glyph rendering should not be used');
  assert.equal((appEntry.match(/brandHeaderTitle}>صُنّاع/g) || []).length, 1, 'header should contain exactly one brand word');
});

test('startup splash stays visible until saved account restoration finishes', () => {
  const appEntry = fs.readFileSync(path.join(root, 'App.js'), 'utf8');
  const screens = fs.readFileSync(path.join(root, 'src/screens/AppScreens.js'), 'utf8');
  assert.ok(appEntry.includes('authRestoring || !splashMinimumElapsed'), 'splash should cover the startup screen while session restoration is running');
  assert.ok(appEntry.includes('onAuthRestoringChange={setAuthRestoring}'), 'app shell should receive the session restoration state');
  assert.ok(screens.includes('onAuthRestoringChange?.(authRestoring)'), 'screen should report when saved account restoration completes');
});

test('Sonaa splash removes the spinning letter and swings the logo like a pendulum', () => {
  assert.ok(app.includes("const logoRotation = spin.interpolate({ inputRange: [0, 1], outputRange: ['-18deg', '18deg'] })"), 'logo should interpolate between left and right angles');
  assert.ok(app.includes('<Animated.Image source={require("./assets/LOGO_UPLOAD_HERE/logo.png")} style={[splashStyles.logo, { transform: [{ rotate: logoRotation }] }]} resizeMode="contain" />'), 'the logo image itself should rotate');
  assert.ok(!app.includes('spinningLetter'), 'the separate spinning letter should be removed');
  assert.ok(!app.includes('<Animated.Text'), 'the splash should not animate a separate text letter');
  assert.ok(app.includes('<Text style={splashStyles.title}>صُنّاع</Text>'), 'the main brand word should remain static');
  assert.ok(app.includes('<Text style={splashStyles.caption}>كل خدمة تبدأ بخطوة</Text>'), 'splash caption should use the agreed tagline');
  assert.ok(app.includes('<Text style={styles.homeTaglinePremium}>كُلُّ خِدْمَةٍ تَبْدَأُ بِخُطْوَةٍ</Text>'), 'home tagline should retain the premium home design');
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
  assert.ok(app.includes("getOrderChatTimeline(orderChats[sn]?.messages, orderChats[sn]?.priceChangeRequests)"));
  assert.ok(app.includes("entry.status==='مقبول'?'وافق العميل على زيادة السعر.'"));
  assert.ok(app.includes("entry.status==='مرفوض'?'رفض العميل الزيادة؛ السعر السابق ما زال ساريًا.'"));
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
  assert.ok(app.includes('serviceDescriptionBox: { backgroundColor: COLORS.indigo50'));
  assert.ok(app.includes('serviceDescriptionText: { color: COLORS.navy, fontSize: 18, fontWeight: \'600\', lineHeight: 28'));
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
  assert.ok(app.includes("notificationRead: { backgroundColor: COLORS.background, opacity: 0.62 }"));
  assert.ok(app.includes("notificationReadText: { color: COLORS.muted }"));
  assert.ok(app.includes("unread: 0 }));"));
});

test('mark all notifications read clears unread count and dims all notifications', () => {
  assert.ok(app.includes('items: current.items.map(n => ({ ...n, read: true, readAt: n.readAt || new Date().toISOString() })), unread: 0'));
});

test('client and technician chats render price-change requests in the same chronological timeline as messages', () => {
  assert.ok(app.includes('function getOrderChatTimeline(messages, priceChangeRequests)'));
  assert.ok(app.includes("item?.createdAt || 0"));
  assert.ok(app.includes("item?.requestedAt || item?.createdAt || 0"));
  assert.ok(app.includes('return aTime - bTime || a._chatStableOrder - b._chatStableOrder'));
  assert.equal(app.split("getOrderChatTimeline(orderChats[sn]?.messages, orderChats[sn]?.priceChangeRequests).map((entry,j)=>entry._chatItemType").length - 1, 2);
  assert.ok(!app.includes('(orderChats[sn]?.priceChangeRequests||[]).map(request=>'), 'price-change requests must not render in a separate fixed section');
  assert.ok(app.includes('onPress={()=>decideOrderPrice(order,entry,true)}'), 'client approval remains connected to each pending request');
  assert.ok(app.includes('onPress={()=>decideOrderPrice(order,entry,false)}'), 'client rejection remains connected to each pending request');
  assert.ok(app.includes("entry.status==='مقبول'?'وافق العميل على زيادة السعر.'"));
  assert.ok(app.includes("entry.status==='مرفوض'?'رفض العميل الزيادة؛ السعر السابق ما زال ساريًا.'"));
});

test('client and technician support buttons keep their positions and use the new premium support color', () => {
  assert.equal(app.split('onPress={openWhatsAppSupport} style={[styles.floatingButton,styles.whatsappButton]}').length - 1, 2, 'client and technician support buttons should both remain in place');
  assert.ok(app.includes("whatsappButton: { backgroundColor: COLORS.indigo900, borderColor: COLORS.cyan400, borderWidth: 1.5"), 'support button should use the new indigo/cyan styling');
  assert.ok(app.includes("floatingWhatsApp: { color: COLORS.white, fontSize: 21"), 'support icon should remain clearly visible');
});

test('technician available orders and offers are deduplicated on initial load and refresh', () => {
  assert.ok(app.includes("orders: results[1].status === 'fulfilled' ? uniqueByOrderSN(toList(results[1].value, ['orders'])) : []"));
  assert.ok(app.includes("offers: results[2].status === 'fulfilled' ? uniqueByOrderSN(toList(results[2].value, ['offers'])) : []"));
  assert.ok(app.includes("orders: results[0].status === 'fulfilled' ? uniqueByOrderSN(toList(results[0].value, ['orders'])) : current.orders"));
  assert.ok(app.includes("offers: results[1].status === 'fulfilled' ? uniqueByOrderSN(toList(results[1].value, ['offers'])) : current.offers"));
});

test('wallet transfer notice is limited to technician wallet and explains accepted transfer routes', () => {
  const walletStart = app.indexOf("{tab === 'wallet' && <ScrollView");
  const walletEnd = app.indexOf("</ScrollView>}", walletStart);
  assert.notEqual(walletStart, -1);
  const walletBody = app.slice(walletStart, walletEnd);
  assert.ok(walletBody.includes('تنويه بخصوص التحويلات'));
  assert.ok(walletBody.includes('من محفظة إلكترونية إلى محفظة إلكترونية'));
  assert.ok(walletBody.includes('من إنستا باي إلى محفظة إلكترونية فقط'));
  assert.ok(walletBody.includes('لا نقبل التحويل من إنستا باي إلى إنستا باي'));
  assert.ok(app.includes('walletNotice:'));
});


test('client request form Enter advances from detailed description to budget and submits from budget', () => {
  const descriptionField = app.match(/<Field inputRef=\{clientDescriptionInputRef\}[^\n]+/);
  const budgetField = app.match(/<Field inputRef=\{clientBudgetInputRef\}[^\n]+/);
  assert.ok(descriptionField, 'detailed description field should exist');
  assert.ok(descriptionField[0].includes('returnKeyType="next"'), 'description should show the next keyboard action');
  assert.ok(descriptionField[0].includes('onSubmitEditing={() => clientBudgetInputRef.current?.focus()}'), 'Enter should focus the budget field');
  assert.ok(descriptionField[0].includes('blurOnSubmit'), 'Enter should submit the multiline field rather than insert a newline');
  assert.ok(budgetField, 'budget field should exist');
  assert.ok(budgetField[0].includes('returnKeyType="go"'), 'budget should show the submit keyboard action');
  assert.ok(budgetField[0].includes('onSubmitEditing={createOrder}'), 'Enter in the final field should submit the order');
});

test('mobile client can record, preview, delete, and submit voice order descriptions', () => {
  assert.ok(app.includes("import { Audio } from 'expo-av'"));
  assert.ok(app.includes("import * as FileSystem from 'expo-file-system'"));
  assert.ok(app.includes('function VoiceRecorder({ value, onChange, disabled })'));
  assert.ok(app.includes('Audio.RecordingOptionsPresets.HIGH_QUALITY'));
  assert.ok(app.includes("onChange('data:audio/mp4;base64,' + base64)"));
  assert.ok(app.includes("voiceRecordingData: ''"));
  assert.ok(app.includes("...(form.voiceRecordingData ? { voiceRecordingData: form.voiceRecordingData } : {})"));
  assert.ok(app.includes('description.length < 10 && !form.voiceRecordingData'));
  assert.ok(app.includes('🔴 بدء التسجيل'));
  assert.ok(app.includes('▶️ سماع التسجيل'));
  assert.ok(app.includes('🗑 حذف'));
});
test('technician can play voice descriptions in available and accepted jobs through authenticated backend endpoint', () => {
  assert.equal(app.split('function VoicePlayback({ orderSN, token, hasVoiceRecording })').length - 1, 1);
  assert.ok(app.includes("API_BASE + '/orders/' + encodeURIComponent(String(orderSN)) + '/voice'"));
  assert.ok(app.includes("headers: { Authorization: 'Bearer ' + token }"));
  assert.ok(app.includes('<VoicePlayback orderSN={sn} token={session?.token} hasVoiceRecording={Boolean(item.hasVoiceRecording)} />'));
  assert.ok(app.includes('assignedDetails[sn].order.hasVoiceRecording || item.hasVoiceRecording'));
});
test('voice recording dependencies match Expo SDK 51 and backend voice size validation', () => {
  assert.equal(packageJson.dependencies['expo-av'], '~14.0.7');
  assert.equal(packageJson.dependencies['expo-file-system'], '~17.0.1');
  assert.ok(app.includes('info.size > 360000'));
});

test('voice recorder auto-stop uses a stable recording reference after React state updates', () => {
  const start = app.indexOf('function VoiceRecorder(');
  const end = app.indexOf('function VoicePlayback(', start);
  const recorder = app.slice(start, end);
  assert.ok(recorder.includes('const recordingRef = useRef(null)'));
  assert.ok(recorder.includes('recordingRef.current = created.recording'));
  assert.ok(recorder.includes('const active = recordingRef.current'));
  assert.ok(recorder.includes('finishRecording(); return 30;'));
});

test('Expo native config requests microphone permission for voice recording', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  assert.ok(config.expo.plugins.some(plugin => Array.isArray(plugin) && plugin[0] === 'expo-av' && plugin[1].microphonePermission));
});


test('technician account tab exposes Edit My Details and specialty edits are optional', () => {
  assert.ok(app.includes(`{tab === 'profile' && <ScrollView`), 'technician account tab should exist');
  assert.ok(app.includes('Button title="✏️ تعديل بياناتي" onPress={beginProfileEdit}'), 'technician account tab should open profile editing');
  assert.ok(app.includes('التخصصات والخدمات (اختياري)'), 'specialty selection should be labelled optional');
  assert.ok(!app.includes("اختار تخصصًا واحدًا على الأقل."), 'saving profile edits should not require selecting a specialty');
});

test('technician profile edit loads the shared service categories before rendering specialty choices', () => {
  assert.match(app, /\['client', 'clientRegister', 'technicianRegister', 'profileEdit'\]\.includes\(screen\)/);
  assert.ok(app.includes('categories.map(category => { const chosenCount = (category.services || []).filter(service => profileEditForm.specialties.includes(service)).length;'));
});


test('modular screen files are connected and app assets resolve from their new locations', () => {
  const screen = fs.readFileSync(path.join(root, 'src/screens/AppScreens.js'), 'utf8');
  const appEntry = fs.readFileSync(path.join(root, 'App.js'), 'utf8');
  assert.match(screen, /import \{ API_BASE, api \} from '\.\.\/services\/api';/);
  assert.match(screen, /from '\.\/auth\/AuthScreens'/);
  assert.match(screen, /from '\.\/account\/AccountScreens'/);
  assert.ok(!screen.includes('require("./assets/'), 'screen assets must use the path relative to src/screens');
  assert.match(screen, /require\('\.\.\/\.\.\/assets\/LOGO_UPLOAD_HERE\/logo\.png'\)/);
  assert.match(appEntry, /from '\.\/src\/screens\/AppScreens'/);
});

test('authentication and account screens are extracted from the main screen controller', () => {
  const authScreens = fs.readFileSync(path.join(root, 'src/screens/auth/AuthScreens.js'), 'utf8');
  const accountScreens = fs.readFileSync(path.join(root, 'src/screens/account/AccountScreens.js'), 'utf8');
  for (const name of ['LoginScreen', 'ChangePasswordScreen', 'PasswordRecoveryScreen']) assert.match(authScreens, new RegExp('export function ' + name));
  for (const name of ['AccountScreen', 'ProfileEditScreen']) assert.match(accountScreens, new RegExp('export function ' + name));
});


test('extracted screen modules contain component bodies, not the old screen condition wrappers', () => {
  const authScreens = fs.readFileSync(path.join(root, 'src/screens/auth/AuthScreens.js'), 'utf8');
  const accountScreens = fs.readFileSync(path.join(root, 'src/screens/account/AccountScreens.js'), 'utf8');
  assert.ok(!authScreens.includes("if (screen === 'login')"));
  assert.ok(!accountScreens.includes("if (screen === 'account')"));
  assert.ok(!accountScreens.includes("if (screen === 'profileEdit')"));
  assert.match(authScreens, /return <SafeAreaView style=\{styles\.loginSafe\}>/);
  assert.match(accountScreens, /return <SafeAreaView style=\{styles\.safe\}>/);
  assert.match(authScreens, /require\('\.\.\/\.\.\/\.\.\/assets\/LOGO_UPLOAD_HERE\/logo\.png'\)/);
});


test('support and admin dashboards are separate feature modules and wired to screen navigation', () => {
  const screen = fs.readFileSync(path.join(root, 'src/screens/AppScreens.js'), 'utf8');
  const support = fs.readFileSync(path.join(root, 'src/screens/support/SupportScreen.js'), 'utf8');
  const admin = fs.readFileSync(path.join(root, 'src/screens/admin/AdminDashboard.js'), 'utf8');
  assert.match(screen, /from '\.\/support\/SupportScreen'/);
  assert.match(screen, /from '\.\/admin\/AdminDashboard'/);
  assert.match(screen, /<SupportScreen session=\{session\}/);
  assert.match(screen, /<AdminDashboard session=\{session\}/);
  assert.match(support, /export function SupportScreen/);
  assert.match(admin, /export function AdminDashboard/);
  assert.ok(!support.includes("if (screen === 'support'"));
  assert.ok(!admin.includes("if (screen === 'admin'"));
});


test('client and technician dashboards are split into dedicated feature modules', () => {
  const screen = fs.readFileSync(path.join(root, 'src/screens/AppScreens.js'), 'utf8');
  const client = fs.readFileSync(path.join(root, 'src/screens/client/ClientDashboard.js'), 'utf8');
  const technician = fs.readFileSync(path.join(root, 'src/screens/technician/TechnicianDashboard.js'), 'utf8');
  assert.match(screen, /from '\.\/client\/ClientDashboard'/);
  assert.match(screen, /from '\.\/technician\/TechnicianDashboard'/);
  assert.match(screen, /<ClientDashboard context=\{screenContext\}/);
  assert.match(screen, /<TechnicianDashboard context=\{screenContext\}/);
  assert.match(client, /export function ClientDashboard/);
  assert.match(technician, /export function TechnicianDashboard/);
  assert.match(client, /const \{ screen, setScreen/);
  assert.match(technician, /const \{ screen, setScreen/);
});


test('application state is grouped in a dedicated hook without changing state ownership', () => {
  const screen = fs.readFileSync(path.join(root, 'src/screens/AppScreens.js'), 'utf8');
  const hook = fs.readFileSync(path.join(root, 'src/hooks/useAppState.js'), 'utf8');
  assert.match(screen, /import \{ useAppState \} from '\.\.\/hooks\/useAppState';/);
  assert.match(screen, /const appState = useAppState\(\)/);
  assert.match(hook, /export function useAppState\(\)/);
  assert.match(hook, /const \[session, setSession\] = useState\(null\)/);
  assert.match(hook, /const \[clientData, setClientData\] = useState/);
  assert.match(hook, /const \[techData, setTechData\] = useState/);
  assert.match(hook, /const services = useMemo/);
  assert.match(hook, /return \{[\s\S]*?session[\s\S]*?clientData[\s\S]*?techData/);
});


test('navigation and push registration are isolated in dedicated hooks', () => {
  const screen = fs.readFileSync(path.join(root, 'src/screens/AppScreens.js'), 'utf8');
  const navigation = fs.readFileSync(path.join(root, 'src/hooks/useScreenNavigation.js'), 'utf8');
  const push = fs.readFileSync(path.join(root, 'src/hooks/usePushNotifications.js'), 'utf8');
  assert.match(screen, /useScreenNavigation\(onScreenChange\)/);
  assert.match(screen, /usePushNotifications\(session\)/);
  assert.match(navigation, /export function useScreenNavigation/);
  assert.match(push, /export function usePushNotifications/);
  assert.match(push, /getExpoPushTokenAsync/);
  assert.match(push, /push-token/);
  assert.match(push, /Notifications\.setNotificationHandler/);
});


test('client, technician, admin, and support use separate page palette surfaces', () => {
  const styles = fs.readFileSync(path.join(root, 'src/theme/styles.js'), 'utf8');
  const colors = fs.readFileSync(path.join(root, 'src/theme/colors.js'), 'utf8');
  const technician = fs.readFileSync(path.join(root, 'src/screens/technician/TechnicianDashboard.js'), 'utf8');
  const admin = fs.readFileSync(path.join(root, 'src/screens/admin/AdminDashboard.js'), 'utf8');
  const support = fs.readFileSync(path.join(root, 'src/screens/support/SupportScreen.js'), 'utf8');
  for (const page of ['home', 'login', 'client', 'technician', 'admin', 'support', 'splash']) assert.match(colors, new RegExp('^  ' + page + ':', 'm'));
  assert.match(styles, /technicianSafe: \{ flex: 1, backgroundColor: PAGE_COLORS\.technician\.background \}/);
  assert.match(styles, /adminSafe: \{ flex: 1, backgroundColor: PAGE_COLORS\.admin\.background \}/);
  assert.match(styles, /supportSafe: \{ flex: 1, backgroundColor: PAGE_COLORS\.support\.background \}/);
  assert.match(technician, /styles\.technicianSafe/);
  assert.match(admin, /styles\.adminSafe/);
  assert.match(support, /styles\.supportSafe/);
});
