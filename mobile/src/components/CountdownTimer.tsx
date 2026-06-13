import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";

interface CountdownProgressRingProps {
  size?: number;
  strokeWidth?: number;
  progress: number; // 0 -> 1
  children: React.ReactNode;
}

function CountdownProgressRing({
  size = 224,
  strokeWidth = 18,
  progress,
  children,
}: CountdownProgressRingProps) {
  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View
      className="items-center justify-center rounded-full bg-white shadow-lg"
      style={{
        width: size,
        height: size,
      }}
    >
      <Svg
        width={size}
        height={size}
        style={{
          position: "absolute",
        }}
      >
        {/* Background Ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#DBEAFE"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress Ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#2563EB"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>

      <View className="h-32 w-32 items-center justify-center rounded-full bg-white">
        {children}
      </View>
    </View>
  );
}

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

  const progress = remaining / totalDuration;

  return (
    <CountdownProgressRing progress={progress}>
      <Text className="text-3xl font-bold text-gray-900">{formattedTime}</Text>

      <Text className="mt-1 text-center text-xs text-gray-500">{label}</Text>
    </CountdownProgressRing>
  );
}
