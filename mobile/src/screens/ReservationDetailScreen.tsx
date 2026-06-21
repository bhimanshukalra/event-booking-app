import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { EventDetail } from "../api/events";
import type { Reservation } from "../api/reservations";
import { CountdownTimer } from "../components/CountdownTimer";

type ReservationDetailScreenProps = {
  event: EventDetail;
  onBackToEvent: () => void;
  onBackToEvents: () => void;
  reservation: Reservation;
};

export function ReservationDetailScreen({
  event,
  onBackToEvent,
  onBackToEvents,
  reservation,
}: ReservationDetailScreenProps) {
  const [isExpired, setIsExpired] = useState(
    new Date(reservation.expiresAt).getTime() <= Date.now(),
  );
  const reservationItems = reservation.items.map((item) => {
    const ticketType = event.ticketTypes.find(
      (candidate) => candidate.id === item.ticketTypeId,
    );

    return {
      ...item,
      currency: ticketType?.currency ?? "USD",
      priceCents: ticketType?.priceCents ?? 0,
      ticketTypeName: ticketType?.name ?? item.ticketTypeName,
    };
  });
  const currency = reservationItems[0]?.currency ?? "USD";
  const totalQuantity = reservationItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const totalCents = reservationItems.reduce(
    (sum, item) => sum + item.quantity * item.priceCents,
    0,
  );

  return (
    <SafeAreaView className="flex-1 bg-[#f5fbf8]">
      <ScrollView className="flex-1">
        <View className="px-5 pb-9 pt-5">
          <View className="mb-6 flex-row flex-wrap gap-3">
            <Pressable
              accessibilityRole="button"
              onPress={onBackToEvent}
              className="rounded-lg border border-[#a8c7bd] px-[14px] py-2.5"
            >
              <Text className="text-sm font-extrabold text-[#1f6f5b]">
                Back to event
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onBackToEvents}
              className="rounded-lg border border-[#a8c7bd] px-[14px] py-2.5"
            >
              <Text className="text-sm font-extrabold text-[#1f6f5b]">
                All events
              </Text>
            </Pressable>
          </View>

          <Text className="text-[13px] font-black uppercase text-[#1f6f5b]">
            Reservation
          </Text>
          <Text className="mt-2.5 text-[34px] font-black leading-[39px] text-[#10231e]">
            {event.title}
          </Text>
          <Text className="mt-3 text-[15px] leading-[22px] text-[#557169]">
            {formatDateTime(event.startsAt)} - {event.venue.name}
          </Text>

          <View className="mt-6 rounded-lg bg-[#e7f3ef] p-[18px]">
            <View className="flex-row items-center justify-between gap-4">
              <View className="flex-1">
                <Text className="text-xs font-black uppercase text-[#557169]">
                  Status
                </Text>
                <Text className="mt-2 text-lg font-extrabold capitalize text-[#10231e]">
                  {isExpired ? "expired" : reservation.status}
                </Text>
              </View>
              <View className="rounded-md bg-white px-3 py-2">
                <Text className="text-xs font-black uppercase text-[#557169]">
                  Hold expires
                </Text>
                <Text className="mt-1 text-sm font-black text-[#1f6f5b]">
                  {formatTime(reservation.expiresAt)}
                </Text>
              </View>
            </View>
            <Text className="mt-4 text-xs font-black uppercase text-[#557169]">
              Reservation ID
            </Text>
            <Text className="mt-1 text-sm font-bold text-[#314d45]">
              {reservation.id}
            </Text>
          </View>

          <View className="mt-4">
            {isExpired ? (
              <View className="rounded-lg border border-[#f3cfb4] bg-[#fff8f2] p-4">
                <Text className="text-base font-black text-[#4a2013]">
                  This hold has expired
                </Text>
                <Text className="mt-1.5 text-sm leading-5 text-[#7f5542]">
                  Select tickets again to create a fresh reservation.
                </Text>
              </View>
            ) : (
              <CountdownTimer
                expiresAt={new Date(reservation.expiresAt)}
                label="Time remaining"
                onExpire={() => setIsExpired(true)}
              />
            )}
          </View>

          <View className="mt-7">
            <Text className="mb-[14px] text-[22px] font-black text-[#10231e]">
              Tickets
            </Text>
            {reservationItems.map((item) => (
              <View
                key={item.id}
                className="mb-3 rounded-lg border border-[#d7e4df] bg-white p-4"
              >
                <View className="flex-row items-start justify-between gap-4">
                  <View className="flex-1">
                    <Text className="text-[17px] font-extrabold text-[#10231e]">
                      {item.ticketTypeName}
                    </Text>
                    <Text className="mt-1.5 text-[13px] text-[#6f8580]">
                      Quantity {item.quantity}
                    </Text>
                  </View>
                  <Text className="text-right text-[16px] font-black text-[#10231e]">
                    {formatPrice(item.quantity * item.priceCents, item.currency)}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View className="mt-2 rounded-lg bg-[#10231e] p-4">
            <View className="flex-row items-center justify-between gap-4">
              <View>
                <Text className="text-xs font-black uppercase text-[#a8c7bd]">
                  Selected
                </Text>
                <Text className="mt-1 text-base font-black text-white">
                  {totalQuantity} ticket{totalQuantity === 1 ? "" : "s"}
                </Text>
              </View>
              <Text className="text-xl font-black text-white">
                {formatPrice(totalCents, currency)}
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={isExpired}
            className={`mt-4 rounded-lg px-4 py-3 ${
              isExpired ? "bg-[#9fb7af]" : "bg-[#1f6f5b]"
            }`}
          >
            <Text className="text-center text-sm font-black text-white">
              Continue to payment
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    weekday: "short",
  }).format(new Date(value));
}

function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    currency,
    style: "currency",
  }).format(priceCents / 100);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
