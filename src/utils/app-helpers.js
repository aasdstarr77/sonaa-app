function getOrderChatTimeline(messages, priceChangeRequests) {
  const chatMessages = Array.isArray(messages) ? messages : [];
  const priceRequests = Array.isArray(priceChangeRequests) ? priceChangeRequests : [];
  const timeline = [
    ...chatMessages.map((item, index) => ({
      ...item,
      _chatItemType: 'message',
      _chatSortTime: new Date(item?.createdAt || 0).getTime(),
      _chatStableOrder: index,
    })),
    ...priceRequests.map((item, index) => ({
      ...item,
      _chatItemType: 'priceChangeRequest',
      _chatSortTime: new Date(item?.requestedAt || item?.createdAt || 0).getTime(),
      _chatStableOrder: chatMessages.length + index,
    })),
  ];
  return timeline.sort((a, b) => {
    const aTime = Number.isFinite(a._chatSortTime) ? a._chatSortTime : 0;
    const bTime = Number.isFinite(b._chatSortTime) ? b._chatSortTime : 0;
    return aTime - bTime || a._chatStableOrder - b._chatStableOrder;
  });
}
function toList(result, keys) {
  for (const key of keys) if (Array.isArray(result?.[key])) return result[key];
  return Array.isArray(result?.data) ? result.data : [];
}
function dateLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return date.toLocaleDateString('ar-EG');
  } catch {
    try {
      return date.toLocaleDateString();
    } catch {
      return date.toISOString().slice(0, 10);
    }
  }
}
function getServiceEmoji(service) {
  const value = String(service || '');
  if (/تسريب|حنفي|صنبور|مياه|صرف|بالوعة|سيفون|سخان|خلاط/.test(value)) return '🚰';
  if (/كهرب|لمبة|نجفة|مفتاح|فيشة|كهرباء|إنارة|كشاف/.test(value)) return '💡';
  if (/تكييف|تبريد|فريون/.test(value)) return '❄️';
  if (/غسالة|ثلاجة|بوتاجاز|فرن|ميكروويف/.test(value)) return '🧰';
  if (/دهان|نقاشة|طلاء|لون/.test(value)) return '🖌️';
  if (/نجارة|باب|دولاب|مطبخ|خشب|مفصلات/.test(value)) return '🪚';
  if (/قفل|مفتاح|كالون/.test(value)) return '🔑';
  if (/شاشة|كاميرا|دش|ريسيفر|تلفزيون/.test(value)) return '📺';
  if (/تنظيف|تطهير|مكافحة/.test(value)) return '🧹';
  if (/تركيب|فك|تثبيت|صيانة|إصلاح|تصليح/.test(value)) return '🔧';
  if (/بناء|محارة|طوب|سيراميك|بلاط|رخام/.test(value)) return '🧱';
  return '🛠️';
}

export { getOrderChatTimeline, toList, dateLabel, getServiceEmoji };
