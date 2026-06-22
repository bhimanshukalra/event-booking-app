import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { EventDetail } from "../api/events";
import type { Reservation } from "../api/reservations";
import { CountdownTimer, ReservationExpiredState } from "../components";
import { cn } from "../utils";

type ReservationDetailScreenProps = {
  event: EventDetail;
  onBackToEvent: () => void;
  onBackToEvents: () => void;
  onContinueToPayment: () => void;
  reservation: Reservation;
};

export function ReservationDetailScreen({
  event,
  onBackToEvent,
  onBackToEvents,
  onContinueToPayment,
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
    <SafeAreaView className="flex-1 bg-app">
      <ScrollView className="flex-1">
        <View className="px-5 pb-9 pt-5">
          <View className="mb-6 flex-row flex-wrap gap-3">
            <Pressable
              accessibilityRole="button"
              onPress={onBackToEvent}
              className="rounded-lg border border-border-muted px-[14px] py-2.5"
            >
              <Text className="text-sm font-extrabold text-brand">
                Back to event
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onBackToEvents}
              className="rounded-lg border border-border-muted px-[14px] py-2.5"
            >
              <Text className="text-sm font-extrabold text-brand">
                All events
              </Text>
            </Pressable>
          </View>

          <Text className="text-[13px] font-black uppercase text-brand">
            Reservation
          </Text>
          <Text className="mt-2.5 text-[34px] font-black leading-[39px] text-ink">
            {event.title}
          </Text>
          <Text className="mt-3 text-[15px] leading-[22px] text-muted">
            {formatDateTime(event.startsAt)} - {event.venue.name}
          </Text>

          <View className="mt-6 rounded-lg bg-brand-soft p-[18px]">
            <View className="flex-row items-center justify-between gap-4">
              <View className="flex-1">
                <Text className="text-xs font-black uppercase text-muted">
                  Status
                </Text>
                <Text className="mt-2 text-lg font-extrabold capitalize text-ink">
                  {isExpired ? "expired" : reservation.status}
                </Text>
              </View>
              <View className="rounded-md bg-white px-3 py-2">
                <Text className="text-xs font-black uppercase text-muted">
                  Hold expires
                </Text>
                <Text className="mt-1 text-sm font-black text-brand">
                  {formatTime(reservation.expiresAt)}
                </Text>
              </View>
            </View>
            <Text className="mt-4 text-xs font-black uppercase text-muted">
              Reservation ID
            </Text>
            <Text className="mt-1 text-sm font-bold text-body">
              {reservation.id}
            </Text>
          </View>

          <View className="mt-4">
            {isExpired ? (
              <ReservationExpiredState
                description="This ticket hold is no longer active. Select tickets again to create a fresh reservation with current availability."
                onAction={onBackToEvent}
              />
            ) : (
              <CountdownTimer
                expiresAt={new Date(reservation.expiresAt)}
                label="Time remaining"
                onExpire={() => setIsExpired(true)}
              />
            )}
          </View>

          <View className="mt-7">
            <Text className="mb-[14px] text-[22px] font-black text-ink">
              Tickets
            </Text>
            {reservationItems.map((item) => (
              <View
                key={item.id}
                className="mb-3 rounded-lg border border-border-subtle bg-white p-4"
              >
                <View className="flex-row items-start justify-between gap-4">
                  <View className="flex-1">
                    <Text className="text-[17px] font-extrabold text-ink">
                      {item.ticketTypeName}
                    </Text>
                    <Text className="mt-1.5 text-[13px] text-secondary">
                      Quantity {item.quantity}
                    </Text>
                  </View>
                  <Text className="text-right text-[16px] font-black text-ink">
                    {formatPrice(item.quantity * item.priceCents, item.currency)}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View className="mt-2 rounded-lg bg-ink p-4">
            <View className="flex-row items-center justify-between gap-4">
              <View>
                <Text className="text-xs font-black uppercase text-border-muted">
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
            onPress={onContinueToPayment}
            className={cn(
              "mt-4 rounded-lg px-4 py-3",
              isExpired ? "bg-disabled" : "bg-brand",
            )}
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
