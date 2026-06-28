export function mainMenuKeyboard() {
  return {
    reply_markup: {
      resize_keyboard: true,
      keyboard: [
        ['🌙 Мой мини-профиль'],
        ['🌙 Узнать свою Луну'],
        ['❤️ Совместимость', '🧘 Медитация дня'],
        ['🌌 Полный астропортрет'],
        ['🌙 Канал проекта'],
        ['💳 Оплата и поддержка']
      ]
    }
  };
}

export function moonStartKeyboard() {
  return {
    reply_markup: {
      resize_keyboard: true,
      one_time_keyboard: true,
      keyboard: [['Начать расчёт'], ['🏠 В главное меню']]
    }
  };
}

export function moonTimeKeyboard() {
  return {
    reply_markup: {
      resize_keyboard: true,
      one_time_keyboard: true,
      keyboard: [['Не знаю время'], ['🏠 В главное меню']]
    }
  };
}

export function moonResultKeyboard() {
  return {
    reply_markup: {
      resize_keyboard: true,
      keyboard: [
        ['🔁 Рассчитать заново'],
        ['🪐 Что значит Луна в карте?'],
        ['🏠 В главное меню']
      ]
    }
  };
}

export function timeKnowledgeKeyboard() {
  return {
    reply_markup: {
      resize_keyboard: true,
      one_time_keyboard: true,
      keyboard: [['Да, знаю время'], ['Не знаю время']]
    }
  };
}

export function profileActionsKeyboard() {
  return {
    reply_markup: {
      resize_keyboard: true,
      keyboard: [
        ['Исправить данные'],
        ['Пройти анкету заново'],
        ['Удалить мои данные'],
        ['Вернуться в меню']
      ]
    }
  };
}

export function editProfileKeyboard() {
  return {
    reply_markup: {
      resize_keyboard: true,
      keyboard: [['Дату рождения'], ['Время рождения'], ['Город рождения'], ['Вернуться в меню']]
    }
  };
}

export function productKeyboard(productId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Оплатить Stars ⭐', callback_data: `buy:${productId}` }],
        [{ text: 'Как купить Stars картой?', callback_data: 'stars_help' }]
      ]
    }
  };
}

export function paymentConsentKeyboard(productId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Согласна, перейти к оплате', callback_data: `confirm_buy:${productId}` }],
        [
          { text: 'Открыть условия', callback_data: 'terms_info' },
          { text: 'Приватность', callback_data: 'privacy_info' }
        ],
        [{ text: 'Вернуться в меню', callback_data: 'main_menu' }]
      ]
    }
  };
}
