import React, { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Clock, ChevronLeft, ChevronRight, Check } from "lucide-react";

/**
 * Modern, identical-everywhere date+time picker.
 * - Calendar grid + scrollable time list
 * - Disables anything < (now + minOffsetMinutes)
 * - Returns ISO local string compatible with `new Date(value)`
 *
 * Props:
 *   value: string (ISO local "YYYY-MM-DDTHH:mm") | ""
 *   onChange: (next: string) => void
 *   minOffsetMinutes?: number = 10
 *   stepMinutes?: number = 15
 *   placeholder?: string
 */
export default function DateTimePicker({
  value,
  onChange,
  minOffsetMinutes = 10,
  stepMinutes = 15,
  placeholder = "Pick date & time",
  testId = "datetime-picker",
}) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);

  const now = useMemo(() => new Date(), []);
  const minDt = useMemo(
    () => new Date(now.getTime() + minOffsetMinutes * 60 * 1000),
    [now, minOffsetMinutes]
  );

  const parsed = value ? new Date(value) : null;
  const [viewMonth, setViewMonth] = useState(() => {
    const d = parsed || minDt;
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = parsed || minDt;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });
  const [selectedTime, setSelectedTime] = useState(() => {
    const d = parsed || roundUpTo(minDt, stepMinutes);
    return { h: d.getHours(), m: d.getMinutes() };
  });

  // Close on outside click
  useEffect(() => {
    const onDown = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function roundUpTo(d, step) {
    const x = new Date(d);
    const minutes = x.getMinutes();
    const rounded = Math.ceil(minutes / step) * step;
    x.setMinutes(rounded, 0, 0);
    return x;
  }

  const fmtISOLocal = (date, h, m) => {
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:${pad(m)}`;
  };

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  // Build calendar grid (6 rows × 7 cols)
  const grid = useMemo(() => {
    const first = new Date(viewMonth);
    const startWeekday = first.getDay(); // 0..6, Sun=0
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewMonth]);

  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const minDay0 = new Date(minDt.getFullYear(), minDt.getMonth(), minDt.getDate());

  const isDateDisabled = (d) => {
    if (!d) return true;
    return d < minDay0;
  };

  // Time options for selected day
  const timeOptions = useMemo(() => {
    const opts = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += stepMinutes) {
        const candidate = new Date(selectedDate);
        candidate.setHours(h, m, 0, 0);
        const disabled = candidate < minDt;
        opts.push({ h, m, disabled });
      }
    }
    return opts;
  }, [selectedDate, stepMinutes, minDt]);

  // If selected time becomes disabled when date changes, auto-bump to first valid
  useEffect(() => {
    const cur = new Date(selectedDate);
    cur.setHours(selectedTime.h, selectedTime.m, 0, 0);
    if (cur < minDt) {
      const firstValid = timeOptions.find((o) => !o.disabled);
      if (firstValid) setSelectedTime({ h: firstValid.h, m: firstValid.m });
    }
  }, [selectedDate, minDt, timeOptions]); // eslint-disable-line

  const commit = (date, time) => {
    onChange(fmtISOLocal(date, time.h, time.m));
  };

  const pickDate = (d) => {
    setSelectedDate(d);
    commit(d, selectedTime);
  };
  const pickTime = (h, m) => {
    setSelectedTime({ h, m });
    commit(selectedDate, { h, m });
  };

  const fmtPretty = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const fmtTimeLabel = (h, m) => {
    const date = new Date();
    date.setHours(h, m, 0, 0);
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
  };

  const monthLabel = viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const prevMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  const nextMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
  const canPrev = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1) >=
    new Date(minDay0.getFullYear(), minDay0.getMonth(), 1);

  return (
    <div ref={wrapRef} className="relative w-full" data-testid={testId}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid={`${testId}-trigger`}
        className={`w-full flex items-center justify-between gap-3 border-2 rounded-xl px-4 py-3 text-left transition-colors
                    ${open ? "border-orange-500 ring-2 ring-orange-200" : "border-slate-200 hover:border-slate-300"}
                    ${value ? "text-secondary" : "text-slate-400"}`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Calendar className="h-4 w-4 flex-shrink-0 text-slate-500" />
          <span className="truncate font-medium">{value ? fmtPretty(value) : placeholder}</span>
        </span>
        <Clock className="h-4 w-4 text-slate-400 flex-shrink-0" />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-2 w-[min(94vw,560px)] bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 right-0 sm:left-0 sm:right-auto"
          data-testid={`${testId}-popup`}
        >
          <div className="grid sm:grid-cols-[1fr_180px] gap-4">
            {/* Calendar */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={prevMonth}
                  disabled={!canPrev}
                  className="h-8 w-8 grid place-items-center rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  data-testid={`${testId}-prev-month`}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="font-display font-bold text-secondary text-sm">{monthLabel}</div>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="h-8 w-8 grid place-items-center rounded-lg hover:bg-slate-100"
                  data-testid={`${testId}-next-month`}
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div key={i} className="text-center">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {grid.map((d, i) => {
                  if (!d) return <div key={i} />;
                  const disabled = isDateDisabled(d);
                  const isSelected = isSameDay(d, selectedDate);
                  const isToday = isSameDay(d, today0);
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={disabled}
                      onClick={() => pickDate(d)}
                      data-testid={`${testId}-day-${d.getDate()}`}
                      className={`h-9 rounded-lg text-sm font-medium transition-colors
                                  ${disabled ? "text-slate-300 cursor-not-allowed" : "hover:bg-orange-50 text-slate-700"}
                                  ${isSelected ? "bg-orange-600 text-white hover:bg-orange-700" : ""}
                                  ${!isSelected && isToday ? "ring-1 ring-orange-300" : ""}`}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time list */}
            <div className="flex flex-col min-h-0">
              <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Time
              </div>
              <div
                className="flex-1 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 thin-scroll p-1 max-h-[260px]"
                data-testid={`${testId}-time-list`}
              >
                {timeOptions.map((o) => {
                  const isSel = o.h === selectedTime.h && o.m === selectedTime.m;
                  return (
                    <button
                      key={`${o.h}-${o.m}`}
                      type="button"
                      disabled={o.disabled}
                      onClick={() => pickTime(o.h, o.m)}
                      data-testid={`${testId}-time-${o.h}-${o.m}`}
                      className={`w-full text-left text-sm rounded-lg px-3 py-2 my-0.5 flex items-center justify-between transition-colors
                                  ${o.disabled ? "text-slate-300 cursor-not-allowed" : "hover:bg-orange-50 text-slate-700"}
                                  ${isSel ? "bg-orange-600 text-white hover:bg-orange-700" : ""}`}
                    >
                      <span>{fmtTimeLabel(o.h, o.m)}</span>
                      {isSel && <Check className="h-4 w-4" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              {value ? <>Selected: <span className="font-semibold text-secondary">{fmtPretty(value)}</span></> : "Pick a date & time"}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              data-testid={`${testId}-done`}
              className="text-xs px-4 py-1.5 rounded-full bg-secondary text-white font-bold hover:bg-secondary/90"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
