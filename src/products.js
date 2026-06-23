export const PRODUCTS = {
  astro_full: {
    id: 'astro_full',
    title: 'Полный астропортрет',
    stars: 99,
    description: 'Мягкий разбор по дате рождения: внутренний ритм, отношения, ресурс, напряжение и маленькая практика.'
  },
  compatibility_full: {
    id: 'compatibility_full',
    title: 'Полная совместимость',
    stars: 149,
    description: 'Бережный разбор пары по двум датам: общение, близость, разные темпы, точки напряжения и практика.'
  },
  meditation_personal: {
    id: 'meditation_personal',
    title: 'Персональная медитация',
    stars: 49,
    description: 'Короткая практика под твою дату рождения: чтобы замедлиться, почувствовать тело и вернуться к себе.'
  }
};

export function getProduct(productId) {
  return PRODUCTS[productId] || null;
}

export function listProducts() {
  return Object.values(PRODUCTS);
}
