export const PERMISSION_KEYS = ['dashboard','fannis','orders','publishOrders','voiceReview','passwordRecovery','complaints','services','clients','topups','wallet','pricing','settings','content','support','regions','offers','notifications','clientsData'];
const ALL = Object.fromEntries(PERMISSION_KEYS.map(k => [k, { read: true, write: true }]));
const READ_ALL = Object.fromEntries(PERMISSION_KEYS.map(k => [k, { read: true, write: false }]));
const roleDefaults = {
  'قراءة فقط': READ_ALL,
  'مشرف': Object.fromEntries(PERMISSION_KEYS.map(k => [k, { read: ['dashboard','fannis','orders','voiceReview','passwordRecovery','complaints','services','clients','topups','wallet','pricing','content','support','regions','offers','notifications','clientsData'].includes(k), write: ['orders','complaints','support','offers'].includes(k) }])),
  'مشرف أول': Object.fromEntries(PERMISSION_KEYS.map(k => [k, { read: true, write: ['fannis','orders','complaints','services','clients','topups','wallet','support','regions','offers','notifications','clientsData'].includes(k) }])),
  'مدير': ALL
};
export function getPermissions(profile) {
  if (profile?.adminRoleLabel === 'أدمن رئيسي' || (profile?.role === 'admin' && !profile?.adminRole)) return ALL;
  const role = profile?.adminRole || (profile?.role === 'admin' ? 'مشرف' : '');
  const base = roleDefaults[role] || {};
  const stored = profile?.adminPermissions || {};
  if (stored.__customOverrides !== true) return base;
  const merged = { ...base };
  for (const key of PERMISSION_KEYS) if (stored[key]) merged[key] = { ...(base[key] || { read: false, write: false }), ...stored[key] };
  return merged;
}
export function canRead(perms, key) { return perms?.[key]?.read === true || perms?.[key]?.write === true; }
export function canWrite(perms, key) { return perms?.[key]?.write === true; }
export function isRoot(profile) { return profile?.adminRoleLabel === 'أدمن رئيسي'; }