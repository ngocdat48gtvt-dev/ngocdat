/** Khớp WeatherHelper.describeWeatherCode (app Kotlin). */
export function describeWeatherCode(code: number): string {
  switch (code) {
    case 0:
      return 'Trời quang'
    case 1:
    case 2:
    case 3:
      return 'Ít mây / Có mây'
    case 45:
    case 48:
      return 'Sương mù'
    case 51:
    case 53:
    case 55:
      return 'Mưa phùn'
    case 56:
    case 57:
      return 'Mưa phùn đóng băng'
    case 61:
    case 63:
    case 65:
      return 'Mưa'
    case 66:
    case 67:
      return 'Mưa đá'
    case 71:
    case 73:
    case 75:
      return 'Tuyết'
    case 77:
      return 'Hạt tuyết'
    case 80:
    case 81:
    case 82:
      return 'Mưa rào'
    case 85:
    case 86:
      return 'Mưa tuyết'
    case 95:
      return 'Dông'
    case 96:
    case 99:
      return 'Dông kèm mưa đá'
    default:
      return 'Thời tiết hiện tại'
  }
}

export interface WeatherState {
  loading: boolean
  weatherText: string
  place?: string
}

function parsePlaceName(item: Record<string, string>): string | null {
  const parts = [
    item.name,
    item.admin3,
    item.admin2,
    item.admin1,
    item.country,
  ].filter((p) => p?.trim())
  if (parts.length === 0) return null
  return parts.slice(0, 3).join(', ')
}

const DEFAULT_LAT = 21.0285
const DEFAULT_LON = 105.8542

export async function fetchWeather(): Promise<WeatherState> {
  if (!navigator.onLine) {
    return { loading: false, weatherText: 'Không có mạng' }
  }

  let lat = DEFAULT_LAT
  let lon = DEFAULT_LON
  let usedDefault = true

  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 8000,
        maximumAge: 300_000,
      })
    })
    lat = pos.coords.latitude
    lon = pos.coords.longitude
    usedDefault = false
  } catch {
    /* dùng Hà Nội mặc định */
  }

  try {
    const forecastUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      '&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto'
    const forecastRes = await fetch(forecastUrl)
    if (!forecastRes.ok) throw new Error('forecast failed')
    const forecast = (await forecastRes.json()) as {
      current?: {
        temperature_2m?: number
        relative_humidity_2m?: number
        weather_code?: number
      }
    }
    const current = forecast.current
    const temp = current?.temperature_2m
    if (temp == null || Number.isNaN(temp)) throw new Error('no temp')

    const humidity = Math.max(0, current?.relative_humidity_2m ?? 0)
    const description = describeWeatherCode(current?.weather_code ?? -1)
    const weatherText = `${Math.round(temp)}°C · ${description} · Độ ẩm ${humidity}%`

    let place: string | undefined
    try {
      const geoUrl =
        `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}` +
        '&language=vi&count=1'
      const geoRes = await fetch(geoUrl)
      if (geoRes.ok) {
        const geo = (await geoRes.json()) as {
          results?: Array<Record<string, string>>
        }
        const item = geo.results?.[0]
        place = item ? (parsePlaceName(item) ?? undefined) : undefined
      }
    } catch {
      /* bỏ qua */
    }
    if (!place && usedDefault) place = 'Hà Nội'

    return { loading: false, weatherText, place }
  } catch {
    return { loading: false, weatherText: 'Không tải được thời tiết' }
  }
}
