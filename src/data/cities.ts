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
  ['kazan', 'Казань', 'Россия', 55.7879, 49.1233, 'Europe/Moscow'],
  ['yekaterinburg', 'Екатеринбург', 'Россия', 56.8389, 60.6057, 'Asia/Yekaterinburg'],
  ['novosibirsk', 'Новосибирск', 'Россия', 55.0084, 82.9357, 'Asia/Novosibirsk'],
  ['vladivostok', 'Владивосток', 'Россия', 43.1155, 131.8855, 'Asia/Vladivostok'],
  ['kaliningrad', 'Калининград', 'Россия', 54.7104, 20.4522, 'Europe/Kaliningrad'],
  ['sochi', 'Сочи', 'Россия', 43.6028, 39.7342, 'Europe/Moscow'],
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
