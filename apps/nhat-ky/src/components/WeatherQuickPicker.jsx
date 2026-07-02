import { useState, useRef, useEffect } from "react";
import {
  WEATHER_OPTIONS,
  TEMP_OPTIONS,
  formatDayWeather,
  parseDayWeather,
  displayDayWeather
} from "../utils/nhatKyFormat";

function applyWeatherValue(weather, temp) {
  return formatDayWeather(weather, temp);
}

export default function WeatherQuickPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [draftWeather, setDraftWeather] = useState("");
  const [draftTemp, setDraftTemp] = useState("");
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const parsed = parseDayWeather(value);
    setDraftWeather(parsed.weather);
    setDraftTemp(parsed.temp);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function apply(weather, temp) {
    onChange(applyWeatherValue(weather, temp));
    setOpen(false);
  }

  const display = value ? displayDayWeather(value) : "Chọn thời tiết, nhiệt độ…";

  return (
    <div className="weather-picker" ref={wrapRef}>
      <button
        type="button"
        className={`weather-picker-trigger${value ? " has-value" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        {display}
      </button>
      {open && (
        <div className="weather-picker-panel">
          <div className="weather-picker-section">
            <span className="weather-picker-label">Thời tiết</span>
            <div className="weather-picker-chips">
              {WEATHER_OPTIONS.map((w) => (
                <button
                  key={w}
                  type="button"
                  className={`weather-chip${draftWeather === w ? " active" : ""}`}
                  onClick={() => {
                    const next = draftWeather === w ? "" : w;
                    setDraftWeather(next);
                    apply(next, draftTemp);
                  }}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
          <div className="weather-picker-section">
            <span className="weather-picker-label">Nhiệt độ</span>
            <div className="weather-picker-chips">
              {TEMP_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`weather-chip${draftTemp === t ? " active" : ""}`}
                  onClick={() => {
                    const next = draftTemp === t ? "" : t;
                    setDraftTemp(next);
                    apply(draftWeather, next);
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <input
            type="text"
            className="weather-picker-custom"
            placeholder="Hoặc gõ tùy chỉnh…"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
