import { useEffect, useState } from 'react';

export interface CityWeather {
  city: string;
  temp: number;
  emoji: string;
  desc: string;
}

// WMO weather interpretation codes → emoji + description
function wmoToEmoji(code: number): { emoji: string; desc: string } {
  if (code === 0) return { emoji: '☀️', desc: 'Quang đãng' };
  if (code === 1) return { emoji: '🌤️', desc: 'Ít mây' };
  if (code === 2) return { emoji: '⛅', desc: 'Có mây' };
  if (code === 3) return { emoji: '☁️', desc: 'Nhiều mây' };
  if (code === 45 || code === 48) return { emoji: '🌫️', desc: 'Sương mù' };
  if (code >= 51 && code <= 55) return { emoji: '🌦️', desc: 'Mưa phùn' };
  if (code >= 61 && code <= 65) return { emoji: '🌧️', desc: 'Mưa' };
  if (code >= 71 && code <= 77) return { emoji: '🌨️', desc: 'Tuyết' };
  if (code >= 80 && code <= 82) return { emoji: '🌧️', desc: 'Mưa rào' };
  if (code >= 85 && code <= 86) return { emoji: '🌨️', desc: 'Tuyết rào' };
  if (code >= 95 && code <= 99) return { emoji: '⛈️', desc: 'Giông' };
  return { emoji: '🌡️', desc: '' };
}

const CITIES = [
  { name: 'Praha', lat: 50.0755, lon: 14.4378, tz: 'Europe%2FPrague' },
  { name: 'Hà Nội', lat: 21.0285, lon: 105.8542, tz: 'Asia%2FBangkok' },
];

async function fetchCity(city: typeof CITIES[0]): Promise<CityWeather> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${city.lat}&longitude=${city.lon}` +
    `&current=temperature_2m,weather_code` +
    `&timezone=${city.tz}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather fetch failed for ${city.name}`);
  const data = await res.json();
  const temp = Math.round(data.current.temperature_2m as number);
  const code = data.current.weather_code as number;
  const { emoji, desc } = wmoToEmoji(code);
  return { city: city.name, temp, emoji, desc };
}

export function useWeather(intervalMs = 10 * 60 * 1000) {
  const [weather, setWeather] = useState<CityWeather[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const results = await Promise.all(CITIES.map(fetchCity));
        if (!cancelled) setWeather(results);
      } catch {
        // silently fail — keep previous data or null
      }
    }

    load();
    const id = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return weather;
}
