"use client";

interface LocalTimeProps {
  value: string;
  className?: string;
}

export default function LocalTime({ value, className }: LocalTimeProps) {
  const parsed = new Date(value);
  const displayTime = Number.isNaN(parsed.getTime())
    ? "--:--:--"
    : parsed.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "Asia/Bangkok",
      });

  return <span className={className}>{displayTime}</span>;
}
