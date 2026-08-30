"use client";

interface LocalTimeProps {
  value: string;
  className?: string;
  format?: "time" | "datetime";
}

export default function LocalTime({ value, className, format = "time" }: LocalTimeProps) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return <span suppressHydrationWarning className={className}>--:--:--</span>;
  }

  const display =
    format === "datetime"
      ? parsed.toLocaleString("en-GB", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: "Asia/Bangkok",
        })
      : parsed.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: "Asia/Bangkok",
        });

  return (
    <span suppressHydrationWarning className={className}>
      {display}
    </span>
  );
}
