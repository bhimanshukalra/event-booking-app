import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { EventDetail } from "../api/events";
import type { Reservation } from "../api/reservations";
import { CountdownTimer, ReservationExpiredState } from "../components";

type PaymentStatus = "ready" | "processing" | "succeeded" | "failed";

type MockPaymentScreenProps = {
  event: EventDetail;
  onBackToReservation: () => void;
  onPaymentSucceeded: () => void;
  onSelectTicketsAgain: () => void;
  reservation: Reservation;
};

export function MockPaymentScreen({
  event,
  onBackToReservation,
  onPaymentSucceeded,
  onSelectTicketsAgain,
  reservation,
}: MockPaymentScreenProps) {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("ready");
  const [isExpired, setIsExpired] = useState(
    new Date(reservation.expiresAt).getTime() <= Date.now(),
  );
  const paymentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reservationItems = useMemo(
    () =>
      reservation.items.map((item) => {
        const ticketType = event.ticketTypes.find(
          (candidate) => candidate.id === item.ticketTypeId,
        );

        return {
          ...item,
          currency: ticketType?.currency ?? "USD",
          priceCents: ticketType?.priceCents ?? 0,
          ticketTypeName: ticketType?.name ?? item.ticketTypeName,
        };
      }),
    [event.ticketTypes, reservation.items],
  );
  const currency = reservationItems[0]?.currency ?? "USD";
  const totalQuantity = reservationItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const totalCents = reservationItems.reduce(
    (sum, item) => sum + item.quantity * item.priceCents,
    0,
  );
  const canPay =
    !isExpired && (paymentStatus === "ready" || paymentStatus === "failed");

  useEffect(
    () => () => {
      if (paymentTimeoutRef.current) {
        clearTimeout(paymentTimeoutRef.current);
      }
    },
    [],
  );

  function handlePayNow() {
    if (!canPay) {
      return;
    }

    setPaymentStatus("processing");

    paymentTimeoutRef.current = setTimeout(() => {
      setPaymentStatus("succeeded");
      onPaymentSucceeded();
      paymentTimeoutRef.current = null;
    }, 800);
  }

  function handleFailPayment() {
    if (!canPay) {
      return;
    }

    setPaymentStatus("failed");
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f5fbf8]">
      <ScrollView className="flex-1">
        <View className="px-5 pb-9 pt-5">
          <Pressable
            accessibilityRole="button"
            onPress={onBackToReservation}
            className="mb-6 self-start rounded-lg border border-[#a8c7bd] px-[14px] py-2.5"
          >
            <Text className="text-sm font-extrabold text-[#1f6f5b]">
              Back to reservation
            </Text>
          </Pressable>

          <Text className="text-[13px] font-black uppercase text-[#1f6f5b]">
            Payment
          </Text>
          <Text className="mt-2.5 text-[34px] font-black leading-[39px] text-[#10231e]">
            {event.title}
          </Text>
          <Text className="mt-3 text-[15px] leading-[22px] text-[#557169]">
            {formatDateTime(event.startsAt)} - {event.venue.name}
          </Text>

          <View className="mt-6 rounded-lg bg-[#10231e] p-4">
            <View className="flex-row items-center justify-between gap-4">
              <View>
                <Text className="text-xs font-black uppercase text-[#a8c7bd]">
                  Amount due
                </Text>
                <Text className="mt-1 text-base font-black text-white">
                  {totalQuantity} ticket{totalQuantity === 1 ? "" : "s"}
                </Text>
              </View>
              <Text className="text-2xl font-black text-white">
                {formatPrice(totalCents, currency)}
              </Text>
            </View>
          </View>

          <View className="mt-4">
            {isExpired ? (
              <ReservationExpiredState
                description="This ticket hold expired before payment could be completed. Select tickets again to continue."
                onAction={onSelectTicketsAgain}
              />
            ) : (
              <CountdownTimer
                expiresAt={new Date(reservation.expiresAt)}
                label="Payment window"
                onExpire={() => setIsExpired(true)}
              />
            )}
          </View>

          <View className="mt-7">
            <Text className="mb-[14px] text-[22px] font-black text-[#10231e]">
              Order
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

          {!isExpired ? <PaymentStatusBanner status={paymentStatus} /> : null}

          <View className="mt-4 flex-row gap-3">
            <Pressable
              accessibilityRole="button"
              disabled={!canPay}
              onPress={handlePayNow}
              className={`flex-1 rounded-lg px-4 py-3 ${
                canPay ? "bg-[#1f6f5b]" : "bg-[#9fb7af]"
              }`}
            >
              <Text className="text-center text-sm font-black text-white">
                {paymentStatus === "processing"
                  ? "Processing..."
                  : paymentStatus === "failed"
                    ? "Try again"
                    : paymentStatus === "succeeded"
                      ? "Paid"
                      : "Pay now"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!canPay}
              onPress={handleFailPayment}
              className={`rounded-lg px-4 py-3 ${
                canPay ? "bg-[#10231e]" : "bg-[#9fb7af]"
              }`}
            >
              <Text className="text-center text-sm font-black text-white">
                Decline
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PaymentStatusBanner({ status }: { status: PaymentStatus }) {
  if (status === "ready") {
    return null;
  }

  const isSuccess = status === "succeeded";
  const isProcessing = status === "processing";

  return (
    <View
      className={`mt-4 rounded-lg border p-4 ${
        isSuccess
          ? "border-[#bdd8ce] bg-[#e7f3ef]"
          : "border-[#f3cfb4] bg-[#fff8f2]"
      }`}
    >
      <Text
        className={`text-base font-black ${
          isSuccess ? "text-[#1f6f5b]" : "text-[#4a2013]"
        }`}
      >
        {isProcessing
          ? "Payment processing"
          : isSuccess
            ? "Payment succeeded"
            : "Payment failed"}
      </Text>
      <Text
        className={`mt-1.5 text-sm leading-5 ${
          isSuccess ? "text-[#314d45]" : "text-[#7f5542]"
        }`}
      >
        {isProcessing
          ? "Keep this screen open while the demo payment completes."
          : isSuccess
            ? "Your reservation is ready for the booking confirmation step."
            : "No payment was captured. You can try again while the hold is active."}
      </Text>
    </View>
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
