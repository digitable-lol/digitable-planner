export interface PlannerCity {
  id: string
  name: string
  country: string
  latitude: number
  longitude: number
  timeZone: string
}

// A deliberately small offline catalogue. It is product data, not a network
// geocoder: choosing a city never sends a query or calendar payload anywhere.
export const CITIES = [
  ['moscow', 'Москва', 'Россия', 55.7558, 37.6173, 'Europe/Moscow'],
  ['saint-petersburg', 'Санкт-Петербург', 'Россия', 59.9343, 30.3351, 'Europe/Moscow'],
  ['nizhny-novgorod', 'Нижний Новгород', 'Россия', 56.2965, 43.9361, 'Europe/Moscow'],
  ['kazan', 'Казань', 'Россия', 55.7879, 49.1233, 'Europe/Moscow'],
  ['samara', 'Самара', 'Россия', 53.1959, 50.1008, 'Europe/Samara'],
  ['ufa', 'Уфа', 'Россия', 54.7388, 55.9721, 'Asia/Yekaterinburg'],
  ['perm', 'Пермь', 'Россия', 58.0105, 56.2502, 'Asia/Yekaterinburg'],
  ['yekaterinburg', 'Екатеринбург', 'Россия', 56.8389, 60.6057, 'Asia/Yekaterinburg'],
  ['chelyabinsk', 'Челябинск', 'Россия', 55.1644, 61.4368, 'Asia/Yekaterinburg'],
  ['tyumen', 'Тюмень', 'Россия', 57.153, 65.5343, 'Asia/Yekaterinburg'],
  ['omsk', 'Омск', 'Россия', 54.9885, 73.3242, 'Asia/Omsk'],
  ['novosibirsk', 'Новосибирск', 'Россия', 55.0084, 82.9357, 'Asia/Novosibirsk'],
  ['krasnoyarsk', 'Красноярск', 'Россия', 56.0153, 92.8932, 'Asia/Krasnoyarsk'],
  ['irkutsk', 'Иркутск', 'Россия', 52.2864, 104.2807, 'Asia/Irkutsk'],
  ['khabarovsk', 'Хабаровск', 'Россия', 48.4827, 135.0838, 'Asia/Vladivostok'],
  ['vladivostok', 'Владивосток', 'Россия', 43.1155, 131.8855, 'Asia/Vladivostok'],
  ['kaliningrad', 'Калининград', 'Россия', 54.7104, 20.4522, 'Europe/Kaliningrad'],
  ['sochi', 'Сочи', 'Россия', 43.6028, 39.7342, 'Europe/Moscow'],
  ['krasnodar', 'Краснодар', 'Россия', 45.0355, 38.9753, 'Europe/Moscow'],
  ['rostov-on-don', 'Ростов-на-Дону', 'Россия', 47.2357, 39.7015, 'Europe/Moscow'],
  ['volgograd', 'Волгоград', 'Россия', 48.708, 44.5133, 'Europe/Moscow'],
  ['voronezh', 'Воронеж', 'Россия', 51.6608, 39.2003, 'Europe/Moscow'],
  ['saratov', 'Саратов', 'Россия', 51.5336, 46.0343, 'Europe/Saratov'],
  ['tolyatti', 'Тольятти', 'Россия', 53.5078, 49.4204, 'Europe/Samara'],
  ['ulyanovsk', 'Ульяновск', 'Россия', 54.3142, 48.4031, 'Europe/Ulyanovsk'],
  ['izhevsk', 'Ижевск', 'Россия', 56.8527, 53.2115, 'Europe/Samara'],
  ['orenburg', 'Оренбург', 'Россия', 51.7682, 55.0969, 'Asia/Yekaterinburg'],
  ['penza', 'Пенза', 'Россия', 53.195, 45.0183, 'Europe/Moscow'],
  ['ryazan', 'Рязань', 'Россия', 54.6292, 39.7364, 'Europe/Moscow'],
  ['yaroslavl', 'Ярославль', 'Россия', 57.6261, 39.8845, 'Europe/Moscow'],
  ['ivanovo', 'Иваново', 'Россия', 56.9995, 40.9739, 'Europe/Moscow'],
  ['vladimir', 'Владимир', 'Россия', 56.1291, 40.407, 'Europe/Moscow'],
  ['tver', 'Тверь', 'Россия', 56.8587, 35.9176, 'Europe/Moscow'],
  ['smolensk', 'Смоленск', 'Россия', 54.7826, 32.0453, 'Europe/Moscow'],
  ['bryansk', 'Брянск', 'Россия', 53.2521, 34.3717, 'Europe/Moscow'],
  ['tula', 'Тула', 'Россия', 54.193, 37.6178, 'Europe/Moscow'],
  ['lipetsk', 'Липецк', 'Россия', 52.6102, 39.5947, 'Europe/Moscow'],
  ['kursk', 'Курск', 'Россия', 51.7304, 36.1926, 'Europe/Moscow'],
  ['belgorod', 'Белгород', 'Россия', 50.5954, 36.5873, 'Europe/Moscow'],
  ['oryol', 'Орёл', 'Россия', 52.9703, 36.0635, 'Europe/Moscow'],
  ['tambov', 'Тамбов', 'Россия', 52.7212, 41.4523, 'Europe/Moscow'],
  ['cheboksary', 'Чебоксары', 'Россия', 56.1439, 47.2489, 'Europe/Moscow'],
  ['saransk', 'Саранск', 'Россия', 54.1874, 45.1839, 'Europe/Moscow'],
  ['kirov', 'Киров', 'Россия', 58.6035, 49.6668, 'Europe/Kirov'],
  ['arkhangelsk', 'Архангельск', 'Россия', 64.5399, 40.5158, 'Europe/Moscow'],
  ['murmansk', 'Мурманск', 'Россия', 68.9585, 33.0827, 'Europe/Moscow'],
  ['petrozavodsk', 'Петрозаводск', 'Россия', 61.7891, 34.3596, 'Europe/Moscow'],
  ['vologda', 'Вологда', 'Россия', 59.2205, 39.8915, 'Europe/Moscow'],
  ['pskov', 'Псков', 'Россия', 57.8193, 28.3318, 'Europe/Moscow'],
  ['veliky-novgorod', 'Великий Новгород', 'Россия', 58.5256, 31.2742, 'Europe/Moscow'],
  ['stavropol', 'Ставрополь', 'Россия', 45.0428, 41.9734, 'Europe/Moscow'],
  ['astrakhan', 'Астрахань', 'Россия', 46.3479, 48.0336, 'Europe/Astrakhan'],
  ['makhachkala', 'Махачкала', 'Россия', 42.9849, 47.5047, 'Europe/Moscow'],
  ['grozny', 'Грозный', 'Россия', 43.318, 45.6982, 'Europe/Moscow'],
  ['vladikavkaz', 'Владикавказ', 'Россия', 43.0252, 44.6659, 'Europe/Moscow'],
  ['nalchik', 'Нальчик', 'Россия', 43.4846, 43.6071, 'Europe/Moscow'],
  ['elista', 'Элиста', 'Россия', 46.3083, 44.2702, 'Europe/Moscow'],
  ['maykop', 'Майкоп', 'Россия', 44.6098, 40.1007, 'Europe/Moscow'],
  ['tomsk', 'Томск', 'Россия', 56.4846, 84.9476, 'Asia/Tomsk'],
  ['barnaul', 'Барнаул', 'Россия', 53.3474, 83.7784, 'Asia/Barnaul'],
  ['kemerovo', 'Кемерово', 'Россия', 55.3547, 86.0884, 'Asia/Novokuznetsk'],
  ['novokuznetsk', 'Новокузнецк', 'Россия', 53.7557, 87.1099, 'Asia/Novokuznetsk'],
  ['abakan', 'Абакан', 'Россия', 53.7212, 91.4424, 'Asia/Krasnoyarsk'],
  ['gorno-altaysk', 'Горно-Алтайск', 'Россия', 51.9581, 85.9603, 'Asia/Barnaul'],
  ['surgut', 'Сургут', 'Россия', 61.254, 73.3962, 'Asia/Yekaterinburg'],
  ['nizhnevartovsk', 'Нижневартовск', 'Россия', 60.9397, 76.5696, 'Asia/Yekaterinburg'],
  ['ulan-ude', 'Улан-Удэ', 'Россия', 51.8335, 107.5841, 'Asia/Irkutsk'],
  ['chita', 'Чита', 'Россия', 52.034, 113.4994, 'Asia/Chita'],
  ['yakutsk', 'Якутск', 'Россия', 62.0355, 129.6755, 'Asia/Yakutsk'],
  ['blagoveshchensk', 'Благовещенск', 'Россия', 50.2907, 127.5272, 'Asia/Yakutsk'],
  ['yuzhno-sakhalinsk', 'Южно-Сахалинск', 'Россия', 46.9591, 142.738, 'Asia/Sakhalin'],
  ['petropavlovsk-kamchatsky', 'Петропавловск-Камчатский', 'Россия', 53.037, 158.6559, 'Asia/Kamchatka'],
  ['magadan', 'Магадан', 'Россия', 59.5612, 150.8301, 'Asia/Magadan'],
  ['anadyr', 'Анадырь', 'Россия', 64.7337, 177.5089, 'Asia/Anadyr'],
  ['tbilisi', 'Тбилиси', 'Грузия', 41.7151, 44.8271, 'Asia/Tbilisi'],
  ['yerevan', 'Ереван', 'Армения', 40.1872, 44.5152, 'Asia/Yerevan'],
  ['baku', 'Баку', 'Азербайджан', 40.4093, 49.8671, 'Asia/Baku'],
  ['istanbul', 'Стамбул', 'Турция', 41.0082, 28.9784, 'Europe/Istanbul'],
  ['dubai', 'Дубай', 'ОАЭ', 25.2048, 55.2708, 'Asia/Dubai'],
  ['tel-aviv', 'Тель-Авив', 'Израиль', 32.0853, 34.7818, 'Asia/Jerusalem'],
  ['helsinki', 'Хельсинки', 'Финляндия', 60.1699, 24.9384, 'Europe/Helsinki'],
  ['stockholm', 'Стокгольм', 'Швеция', 59.3293, 18.0686, 'Europe/Stockholm'],
  ['berlin', 'Берлин', 'Германия', 52.52, 13.405, 'Europe/Berlin'],
  ['warsaw', 'Варшава', 'Польша', 52.2297, 21.0122, 'Europe/Warsaw'],
  ['prague', 'Прага', 'Чехия', 50.0755, 14.4378, 'Europe/Prague'],
  ['vienna', 'Вена', 'Австрия', 48.2082, 16.3738, 'Europe/Vienna'],
  ['amsterdam', 'Амстердам', 'Нидерланды', 52.3676, 4.9041, 'Europe/Amsterdam'],
  ['paris', 'Париж', 'Франция', 48.8566, 2.3522, 'Europe/Paris'],
  ['london', 'Лондон', 'Великобритания', 51.5072, -0.1276, 'Europe/London'],
  ['lisbon', 'Лиссабон', 'Португалия', 38.7223, -9.1393, 'Europe/Lisbon'],
  ['madrid', 'Мадрид', 'Испания', 40.4168, -3.7038, 'Europe/Madrid'],
  ['rome', 'Рим', 'Италия', 41.9028, 12.4964, 'Europe/Rome'],
  ['new-york', 'Нью-Йорк', 'США', 40.7128, -74.006, 'America/New_York'],
  ['toronto', 'Торонто', 'Канада', 43.6532, -79.3832, 'America/Toronto'],
  ['mexico-city', 'Мехико', 'Мексика', 19.4326, -99.1332, 'America/Mexico_City'],
  ['sao-paulo', 'Сан-Паулу', 'Бразилия', -23.5505, -46.6333, 'America/Sao_Paulo'],
  ['buenos-aires', 'Буэнос-Айрес', 'Аргентина', -34.6037, -58.3816, 'America/Argentina/Buenos_Aires'],
  ['cape-town', 'Кейптаун', 'ЮАР', -33.9249, 18.4241, 'Africa/Johannesburg'],
  ['nairobi', 'Найроби', 'Кения', -1.2921, 36.8219, 'Africa/Nairobi'],
  ['delhi', 'Дели', 'Индия', 28.6139, 77.209, 'Asia/Kolkata'],
  ['bangkok', 'Бангкок', 'Таиланд', 13.7563, 100.5018, 'Asia/Bangkok'],
  ['singapore', 'Сингапур', 'Сингапур', 1.3521, 103.8198, 'Asia/Singapore'],
  ['seoul', 'Сеул', 'Южная Корея', 37.5665, 126.978, 'Asia/Seoul'],
  ['tokyo', 'Токио', 'Япония', 35.6762, 139.6503, 'Asia/Tokyo'],
  ['sydney', 'Сидней', 'Австралия', -33.8688, 151.2093, 'Australia/Sydney'],
  ['auckland', 'Окленд', 'Новая Зеландия', -36.8509, 174.7645, 'Pacific/Auckland'],
] as const satisfies readonly (readonly [string, string, string, number, number, string])[]

export const plannerCities: readonly PlannerCity[] = CITIES.map(([id, name, country, latitude, longitude, timeZone]) => ({
  id, name, country, latitude, longitude, timeZone,
}))

const cityIndex = new Map(plannerCities.map((city) => [city.id, city]))

export function getCity(id: string | undefined): PlannerCity | undefined {
  return id ? cityIndex.get(id) : undefined
}

export function projectCity(city: PlannerCity): { x: number; y: number } {
  return {
    x: ((city.longitude + 180) / 360) * 1000,
    y: ((90 - city.latitude) / 180) * 500,
  }
}
