"use client";

import { useState, useEffect, useRef } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/components/ui/utils";
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameDay,
    isSameMonth,
    isToday,
    isBefore,
    startOfDay
} from "date-fns";
import { es } from "date-fns/locale";

interface DateTimePickerProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    required?: boolean;
    minDate?: Date;
    showTime?: boolean;
    className?: string;
}

export function DateTimePicker({
    value,
    onChange,
    label,
    required = false,
    minDate,
    showTime = true,
    className
}: DateTimePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [hours, setHours] = useState(9);
    const [minutes, setMinutes] = useState(0);
    const [isPM, setIsPM] = useState(false);
    const [clockMode, setClockMode] = useState<'hours' | 'minutes'>('hours');
    const [step, setStep] = useState<'date' | 'time'>('date');
    const containerRef = useRef<HTMLDivElement>(null);
    const clockRef = useRef<HTMLDivElement>(null);

    // Parse initial value
    useEffect(() => {
        if (value) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                setSelectedDate(date);
                setCurrentMonth(date);
                const h = date.getHours();
                setIsPM(h >= 12);
                setHours(h % 12 || 12);
                setMinutes(date.getMinutes());
            }
        }
    }, [value]);

    // Close on outside click - only when open
    useEffect(() => {
        if (!isOpen) return;

        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    // Generate calendar days
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    const weekDays = ["D", "L", "M", "M", "J", "V", "S"];

    const handleDateSelect = (day: Date) => {
        if (minDate && isBefore(day, startOfDay(minDate))) return;
        setSelectedDate(day);
        if (showTime) {
            setStep('time');
            setClockMode('hours');
        }
    };

    const get24Hour = () => {
        if (hours === 12) {
            return isPM ? 12 : 0;
        }
        return isPM ? hours + 12 : hours;
    };

    const updateValue = (date: Date, h24: number, m: number) => {
        if (!date) return;
        const newDate = new Date(date);
        newDate.setHours(h24, m, 0, 0);
        const formatted = format(newDate, "yyyy-MM-dd'T'HH:mm");
        onChange(formatted);
    };

    const handleConfirm = () => {
        if (selectedDate) {
            updateValue(selectedDate, get24Hour(), minutes);
        }
        setIsOpen(false);
        setStep('date');
    };

    // Clock interaction
    const handleClockClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = clockRef.current?.getBoundingClientRect();
        if (!rect) return;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const x = e.clientX - rect.left - centerX;
        const y = e.clientY - rect.top - centerY;

        let angle = Math.atan2(x, -y) * (180 / Math.PI);
        if (angle < 0) angle += 360;

        if (clockMode === 'hours') {
            let hour = Math.round(angle / 30);
            if (hour === 0) hour = 12;
            setHours(hour);
            setTimeout(() => setClockMode('minutes'), 200);
        } else {
            let minute = Math.round(angle / 6);
            if (minute === 60) minute = 0;
            // Snap to 5-minute intervals
            minute = Math.round(minute / 5) * 5;
            if (minute === 60) minute = 0;
            setMinutes(minute);
        }
    };

    // Calculate hand angle
    const getHandAngle = () => {
        if (clockMode === 'hours') {
            return (hours % 12) * 30;
        } else {
            return minutes * 6;
        }
    };

    const displayValue = selectedDate
        ? format(
            new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), get24Hour(), minutes),
            showTime ? "dd MMM, HH:mm" : "dd MMM yyyy",
            { locale: es }
        )
        : "";

    const hourNumbers = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const minuteNumbers = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

    return (
        <div className={cn("relative", className)} ref={containerRef}>
            {label && (
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}

            {/* Input Button */}
            <button
                type="button"
                onClick={() => {
                    setIsOpen(!isOpen);
                    setStep('date');
                }}
                className={cn(
                    "w-full bg-gradient-to-br from-slate-50 to-white",
                    "border-2 border-slate-200 rounded-xl px-3 py-2.5",
                    "flex items-center gap-2",
                    "focus:outline-none focus:border-blue-400",
                    "transition-all duration-200 text-left",
                    "hover:border-blue-300",
                    isOpen && "border-blue-400"
                )}
            >
                <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
                )}>
                    <Calendar className="w-3.5 h-3.5" />
                </div>
                <span className={cn(
                    "text-sm font-semibold truncate",
                    displayValue ? "text-slate-800" : "text-slate-400"
                )}>
                    {displayValue || "Seleccionar..."}
                </span>
            </button>

            {/* Modal Overlay */}
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-150">
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-[320px] overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 text-white flex items-center justify-between">
                            <div className="text-base font-semibold">
                                {step === 'date' ? 'Seleccionar fecha' : 'Seleccionar hora'}
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsOpen(false);
                                    setStep('date');
                                }}
                                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Date Step */}
                        {step === 'date' && (
                            <div className="p-4">
                                {/* Month Navigation */}
                                <div className="flex items-center justify-between mb-3">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                                        className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center transition-colors"
                                    >
                                        <ChevronLeft className="w-5 h-5 text-slate-600" />
                                    </button>
                                    <span className="font-bold text-slate-800 capitalize">
                                        {format(currentMonth, "MMMM yyyy", { locale: es })}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                                        className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center transition-colors"
                                    >
                                        <ChevronRight className="w-5 h-5 text-slate-600" />
                                    </button>
                                </div>

                                {/* Week Days */}
                                <div className="grid grid-cols-7 gap-1 mb-2">
                                    {weekDays.map((day, i) => (
                                        <div key={i} className="text-center text-xs font-bold text-slate-400 py-1">
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                {/* Days Grid */}
                                <div className="grid grid-cols-7 gap-1">
                                    {calendarDays.map((day) => {
                                        const isSelected = selectedDate && isSameDay(day, selectedDate);
                                        const isCurrentMonth = isSameMonth(day, currentMonth);
                                        const isTodayDate = isToday(day);
                                        const isDisabled = minDate && isBefore(day, startOfDay(minDate));

                                        return (
                                            <button
                                                key={day.toISOString()}
                                                type="button"
                                                onClick={() => handleDateSelect(day)}
                                                disabled={isDisabled}
                                                className={cn(
                                                    "aspect-square rounded-xl text-sm font-semibold transition-all",
                                                    isSelected
                                                        ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg"
                                                        : isTodayDate
                                                            ? "bg-blue-100 text-blue-700 font-bold"
                                                            : isCurrentMonth
                                                                ? "text-slate-700 hover:bg-slate-100"
                                                                : "text-slate-300",
                                                    isDisabled && "opacity-30 cursor-not-allowed"
                                                )}
                                            >
                                                {format(day, "d")}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Quick Buttons */}
                                <div className="flex gap-2 mt-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const today = new Date();
                                            setCurrentMonth(today);
                                            handleDateSelect(today);
                                        }}
                                        className="flex-1 py-2.5 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
                                    >
                                        Hoy
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const tomorrow = new Date();
                                            tomorrow.setDate(tomorrow.getDate() + 1);
                                            setCurrentMonth(tomorrow);
                                            handleDateSelect(tomorrow);
                                        }}
                                        className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                                    >
                                        Mañana
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Time Step */}
                        {step === 'time' && showTime && (
                            <div className="p-4">
                                {/* Time Display with AM/PM */}
                                <div className="flex items-center justify-center gap-2 mb-5">
                                    <button
                                        type="button"
                                        onClick={() => setClockMode('hours')}
                                        className={cn(
                                            "text-5xl font-bold w-20 h-20 rounded-2xl transition-all flex items-center justify-center",
                                            clockMode === 'hours'
                                                ? "bg-green-100 text-green-700"
                                                : "text-slate-700 hover:bg-slate-100"
                                        )}
                                    >
                                        {String(hours).padStart(2, '0')}
                                    </button>
                                    <span className="text-5xl font-bold text-slate-300">:</span>
                                    <button
                                        type="button"
                                        onClick={() => setClockMode('minutes')}
                                        className={cn(
                                            "text-5xl font-bold w-20 h-20 rounded-2xl transition-all flex items-center justify-center",
                                            clockMode === 'minutes'
                                                ? "bg-blue-100 text-blue-700"
                                                : "text-slate-700 hover:bg-slate-100"
                                        )}
                                    >
                                        {String(minutes).padStart(2, '0')}
                                    </button>

                                    {/* AM/PM Toggle */}
                                    <div className="flex flex-col gap-1 ml-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsPM(false)}
                                            className={cn(
                                                "px-3 py-1.5 text-sm font-bold rounded-lg transition-all",
                                                !isPM
                                                    ? "bg-blue-500 text-white"
                                                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                            )}
                                        >
                                            AM
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsPM(true)}
                                            className={cn(
                                                "px-3 py-1.5 text-sm font-bold rounded-lg transition-all",
                                                isPM
                                                    ? "bg-blue-500 text-white"
                                                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                            )}
                                        >
                                            PM
                                        </button>
                                    </div>
                                </div>

                                {/* Circular Clock */}
                                <div
                                    ref={clockRef}
                                    onClick={handleClockClick}
                                    className="relative w-56 h-56 mx-auto bg-slate-50 rounded-full cursor-pointer select-none border-4 border-slate-100"
                                >
                                    {/* Clock Hand */}
                                    <div
                                        className="absolute left-1/2 top-1/2 origin-bottom transition-transform duration-200 ease-out"
                                        style={{
                                            width: '3px',
                                            height: '75px',
                                            backgroundColor: clockMode === 'hours' ? '#22c55e' : '#3b82f6',
                                            transform: `translateX(-50%) translateY(-100%) rotate(${getHandAngle()}deg)`,
                                            borderRadius: '2px',
                                        }}
                                    >
                                        {/* Hand Tip Circle */}
                                        <div
                                            className={cn(
                                                "absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm",
                                                clockMode === 'hours' ? "bg-green-500" : "bg-blue-500"
                                            )}
                                        >
                                            {clockMode === 'hours' ? hours : String(minutes).padStart(2, '0')}
                                        </div>
                                    </div>

                                    {/* Center Dot */}
                                    <div className={cn(
                                        "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full",
                                        clockMode === 'hours' ? "bg-green-500" : "bg-blue-500"
                                    )} />

                                    {/* Numbers */}
                                    {(clockMode === 'hours' ? hourNumbers : minuteNumbers).map((num, i) => {
                                        const angle = (i * 30 - 90) * (Math.PI / 180);
                                        const radius = 90;
                                        const x = Math.cos(angle) * radius;
                                        const y = Math.sin(angle) * radius;
                                        const isSelected = clockMode === 'hours' ? hours === num : minutes === num;

                                        return (
                                            <div
                                                key={num}
                                                className={cn(
                                                    "absolute w-9 h-9 flex items-center justify-center text-base font-bold rounded-full transition-all",
                                                    isSelected
                                                        ? "" // Hidden when selected (shown in hand tip)
                                                        : "text-slate-600 hover:bg-slate-200"
                                                )}
                                                style={{
                                                    left: `calc(50% + ${x}px - 18px)`,
                                                    top: `calc(50% + ${y}px - 18px)`,
                                                    opacity: isSelected ? 0 : 1,
                                                }}
                                            >
                                                {clockMode === 'hours' ? num : String(num).padStart(2, '0')}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Back to date */}
                                <button
                                    type="button"
                                    onClick={() => setStep('date')}
                                    className="w-full mt-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                    ← Cambiar fecha
                                </button>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="p-4 pt-0 flex gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsOpen(false);
                                    setStep('date');
                                }}
                                className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={!selectedDate}
                                className={cn(
                                    "flex-1 py-3 text-sm font-bold text-white rounded-xl transition-all",
                                    selectedDate
                                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-200"
                                        : "bg-slate-300 cursor-not-allowed"
                                )}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
