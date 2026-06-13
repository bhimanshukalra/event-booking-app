import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";

interface CountdownTimerProps {
  /**
   * Timestamp in milliseconds or a Date object indicating when the countdown ends.
   */
  expiresAt: number | Date;

  /**
   * Called once when the countdown reaches zero.
   */
  onExpire?: () => void;

  /**
   * Optional text displayed below the timer.
   */
  label?: string;

  /**
   * Optional size of the outer circle.
   * Defaults to 224 (h-56/w-56).
   */
  size?: number;
}

export function CountdownTimer({
  expiresAt,
  onExpire,
  label = "Time Remaining",
}: CountdownTimerProps) {
  const endTime = useMemo(
    () => (expiresAt instanceof Date ? expiresAt.getTime() : expiresAt),
    [expiresAt],
  );

  const getRemaining = () => Math.max(0, endTime - Date.now());

  const [remaining, setRemaining] = useState(getRemaining);

  useEffect(() => {
    const interval = setInterval(() => {
      const value = getRemaining();

      setRemaining(value);

      if (value <= 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime, onExpire]);

  const totalSeconds = Math.ceil(remaining / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formattedTime =
    hours > 0
      ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
          .toString()
          .padStart(2, "0")}`
      : `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <View className="items-center justify-center">
      {/* Outer White Circle */}
      <View className="h-56 w-56 items-center justify-center rounded-full bg-white shadow-lg">
        {/* Middle Blue Circle */}
        <View className="h-44 w-44 items-center justify-center rounded-full bg-blue-600">
          {/* Inner White Circle */}
          <View className="h-32 w-32 items-center justify-center rounded-full bg-white px-3">
            <Text className="text-3xl font-bold text-gray-900">
              {formattedTime}
            </Text>

            <Text className="mt-1 text-center text-xs text-gray-500">
              {label}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
