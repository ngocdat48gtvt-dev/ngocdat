import { useEffect, useState } from 'react'
import { fetchWeather, type WeatherState } from '@/lib/weatherUtils'

export function useWeather() {
  const [state, setState] = useState<WeatherState>({
    loading: true,
    weatherText: 'Đang tải thời tiết…',
  })

  useEffect(() => {
    let cancelled = false
    void fetchWeather().then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
