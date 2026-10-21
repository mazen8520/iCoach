// Small shared inputs for the builders: rest-time picker, chip multi-select and a +/− stepper.
// Selected chips use the brand red with a check mark so the state never relies on color alone.
import { Check, Minus, Plus } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { REST_PRESETS, clampRest, formatRest, MAX_REST_SECONDS } from "@/lib/workout-sets";

export function ChipMultiSelect<T extends string>({
  options,
  value,
  onChange,
  label,
  labelFor,
  single = false,
}: {
  options: readonly T[];
  value: T[];
  onChange: (next: T[]) => void;
  label: string;
  labelFor: (option: T) => string;
  /** Behaves like a radio group (one value; clicking the selected chip clears it). */
  single?: boolean | undefined;
}) {
  const toggle = (option: T) => {
    const on = value.includes(option);
    if (single) onChange(on ? [] : [option]);
    else onChange(on ? value.filter((v) => v !== option) : [...value, option]);
  };
  return (
    <div className="chip-group" role="group" aria-label={label}>
      {options.map((option) => {
        const on = value.includes(option);
        return (
          <button
            type="button"
            key={option}
            className={`chip ${on ? "selected" : ""}`}
            aria-pressed={on}
            onClick={() => toggle(option)}
          >
            {on && <Check aria-hidden="true" />}
            {labelFor(option)}
          </button>
        );
      })}
    </div>
  );
}

export function NumberStepper({
  value,
  onChange,
  min,
  max,
  label,
  decrementLabel,
  incrementLabel,
}: {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  label: string;
  decrementLabel: string;
  incrementLabel: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = (raw: string) => {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n) || raw.trim() === "") {
      setText(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, n));
    setText(String(clamped));
    if (clamped !== value) onChange(clamped);
  };
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={decrementLabel}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
        }}
      />
      <button
        type="button"
        aria-label={incrementLabel}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus />
      </button>
    </div>
  );
}

/**
 * Rest time: preset chips (15s–5min), a custom minutes + seconds entry (0s–10min), optionally
 * "No rest" (0) and "inherit" (null, e.g. "same as between sets").
 */
export function RestPicker({
  value,
  onChange,
  label,
  allowNone = true,
  inheritLabel,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
  label: string;
  allowNone?: boolean | undefined;
  /** When given, offers a chip that sets the value to null. */
  inheritLabel?: string | undefined;
}) {
  const { t } = useI18n();
  const id = useId();
  const isPreset = value != null && (REST_PRESETS as readonly number[]).includes(value);
  const isCustom = value != null && value > 0 && !isPreset;
  const [showCustom, setShowCustom] = useState(isCustom);
  const [minutes, setMinutes] = useState(value != null ? String(Math.floor(value / 60)) : "0");
  const [seconds, setSeconds] = useState(value != null ? String(value % 60) : "0");

  useEffect(() => {
    if (value != null) {
      setMinutes(String(Math.floor(value / 60)));
      setSeconds(String(value % 60));
    }
    if (isCustom) setShowCustom(true);
  }, [value, isCustom]);

  const commitCustom = (m: string, s: string) => {
    const total = clampRest((Number(m) || 0) * 60 + (Number(s) || 0));
    setMinutes(String(Math.floor(total / 60)));
    setSeconds(String(total % 60));
    onChange(total);
  };

  return (
    <div className="rest-picker" role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="rest-picker-label">
        {label}
      </span>
      <div className="chip-group">
        {inheritLabel && (
          <button
            type="button"
            className={`chip ${value == null ? "selected" : ""}`}
            aria-pressed={value == null}
            onClick={() => {
              setShowCustom(false);
              onChange(null);
            }}
          >
            {value == null && <Check aria-hidden="true" />}
            {inheritLabel}
          </button>
        )}
        {allowNone && (
          <button
            type="button"
            className={`chip ${value === 0 ? "selected" : ""}`}
            aria-pressed={value === 0}
            onClick={() => {
              setShowCustom(false);
              onChange(0);
            }}
          >
            {value === 0 && <Check aria-hidden="true" />}
            {t("rest.none")}
          </button>
        )}
        {REST_PRESETS.map((preset) => (
          <button
            type="button"
            key={preset}
            className={`chip ${value === preset && !showCustom ? "selected" : ""}`}
            aria-pressed={value === preset && !showCustom}
            onClick={() => {
              setShowCustom(false);
              onChange(preset);
            }}
          >
            {value === preset && !showCustom && <Check aria-hidden="true" />}
            <span dir="ltr">{formatRest(preset)}</span>
          </button>
        ))}
        <button
          type="button"
          className={`chip ${showCustom ? "selected" : ""}`}
          aria-pressed={showCustom}
          aria-expanded={showCustom}
          onClick={() => setShowCustom((v) => !v)}
        >
          {showCustom && <Check aria-hidden="true" />}
          {t("rest.custom")}
        </button>
      </div>
      {showCustom && (
        <div className="rest-custom" dir="ltr">
          <label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={Math.floor(MAX_REST_SECONDS / 60)}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              onBlur={() => commitCustom(minutes, seconds)}
            />
            <span>{t("rest.min")}</span>
          </label>
          <label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
              onBlur={() => commitCustom(minutes, seconds)}
            />
            <span>{t("rest.sec")}</span>
          </label>
          <small>{t("rest.range")}</small>
        </div>
      )}
    </div>
  );
}
