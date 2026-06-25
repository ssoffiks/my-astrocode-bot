export const CHANNEL_URL = 'https://t.me/myinner_cosmos';

export function channelText() {
  return `🌙 Канал проекта

В канале я делюсь мягкими заметками про wellness, астрологию, самопонимание, отношения, ресурс и маленькие практики для себя.

Можно заглянуть сюда:
${CHANNEL_URL}`;
}

export function miniProfileChannelCtaText() {
  return 'Если откликнулось, в канале проекта я делюсь мягкими заметками, практиками и обновлениями бота 🌙';
}

export function meditationChannelCtaText() {
  return 'Больше спокойных заметок и практик можно найти в канале проекта 🌿';
}

export function compatibilityChannelCtaText() {
  return 'Если хочется больше про отношения, ресурс и самопонимание — можно заглянуть в канал проекта ❤️';
}

export function paidContentChannelCtaText() {
  return `Спасибо, что заглянула глубже 🌙
Обновления проекта и новые практики я буду постепенно выкладывать в канале.`;
}

export function channelKeyboard(label = 'Перейти в канал 🌙') {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: label, url: CHANNEL_URL }]
      ]
    }
  };
}
