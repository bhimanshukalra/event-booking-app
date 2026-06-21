import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";

interface CountdownTimerProps {
  expiresAt: number | Date;
  startedAt?: number | Date;
  label?: string;
  onExpire?: () => void;
}

export function CountdownTimer({
  expiresAt,
  startedAt = Date.now(),
  label = "Time Remaining",
  onExpire,
}: CountdownTimerProps) {
  const hasExpired = useRef(false);

  const startTime = useMemo(
    () => (startedAt instanceof Date ? startedAt.getTime() : startedAt),
    [startedAt],
  );

  const endTime = useMemo(
    () => (expiresAt instanceof Date ? expiresAt.getTime() : expiresAt),
    [expiresAt],
  );

  const totalDuration = Math.max(1, endTime - startTime);

  const getRemaining = () => Math.max(0, endTime - Date.now());

  const [remaining, setRemaining] = useState(getRemaining);

  useEffect(() => {
    hasExpired.current = false;
    setRemaining(getRemaining());

    const interval = setInterval(() => {
      const value = getRemaining();

      setRemaining(value);

      if (value <= 0 && !hasExpired.current) {
        hasExpired.current = true;
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime, onExpire]);

  const totalSeconds = Math.ceil(remaining / 1000);

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  const progress = Math.max(0, Math.min(remaining / totalDuration, 1));

  return (
    <View className="rounded-lg border border-timer-border bg-white p-4">
      <View className="flex-row items-center justify-between gap-4">
        <View className="flex-1">
          <Text className="text-xs font-black uppercase text-muted">
            {label}
          </Text>
          <Text className="mt-1 text-[30px] font-black text-ink">
            {formattedTime}
          </Text>
        </View>
        <Text className="text-right text-xs font-bold text-muted">
          Hold expires soon
        </Text>
      </View>
      <View className="mt-3 h-2 overflow-hidden rounded-full bg-border-subtle">
        <View
          className="h-2 rounded-full bg-brand"
          style={{
            width: `${progress * 100}%`,
          }}
        />
      </View>
    </View>
  );
}
