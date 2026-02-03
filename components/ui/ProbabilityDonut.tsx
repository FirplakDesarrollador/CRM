import React from 'react';

interface ProbabilityDonutProps {
    percentage: number;
    size?: number;
    strokeWidth?: number;
    color?: string;
}

export function ProbabilityDonut({
    percentage,
    size = 80,
    strokeWidth = 8,
    color = "#2563eb" // blue-600
}: ProbabilityDonutProps) {
    const radius = size / 2;
    const normalizedRadius = radius - strokeWidth;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg
                height={size}
                width={size}
                className="transform -rotate-90"
            >
                <circle
                    stroke="#e2e8f0"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                />
                <circle
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference + ' ' + circumference}
                    style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                    strokeLinecap="round"
                    fill="transparent"
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                />
            </svg>
            <div className="absolute text-sm font-bold text-slate-700">
                {percentage}%
            </div>
        </div>
    );
}
