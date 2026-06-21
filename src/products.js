export const PRODUCTS = {
  astro_full: {
    id: 'astro_full',
    title: 'Полный астропортрет',
    stars: 199,
    description: 'Глубокий мягкий разбор по дате рождения: эмоции, отношения, ресурс, внутренние сценарии и практика.'
  },
  compatibility_full: {
    id: 'compatibility_full',
    title: 'Полная совместимость',
    stars: 249,
    description: 'Разбор пары по двум датам рождения: динамика, общение, близость, точки напряжения и практика.'
  },
  meditation_personal: {
    id: 'meditation_personal',
    title: 'Персональная медитация',
    stars: 99,
    description: 'Короткая практика под твою дату рождения и внутренний ритм: чтобы замедлиться и вернуться к себе.'
  }
};

export function getProduct(productId) {
  return PRODUCTS[productId] || null;
}

export function listProducts() {
  return Object.values(PRODUCTS);
}
