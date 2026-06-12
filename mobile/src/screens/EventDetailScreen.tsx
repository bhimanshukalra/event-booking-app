import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { type EventDetail, getEvent } from "../api/events";
import { createReservation } from "../api/reservations";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";

type EventDetailScreenProps = {
  eventId: string;
  onBack: () => void;
};

export function EventDetailScreen({ eventId, onBack }: EventDetailScreenProps) {
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadEvent = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      setEvent(await getEvent(eventId));
    } catch (error) {
      setEvent(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load this event.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  return (
    <SafeAreaView className="flex-1 bg-[#f5fbf8]">
      <ScrollView className="flex-1">
        <View className="px-5 pb-9 pt-5">
          <Pressable
            accessibilityRole="button"
            onPress={onBack}
            className="mb-6 self-start rounded-lg border border-[#a8c7bd] px-[14px] py-2.5"
          >
            <Text className="text-sm font-extrabold text-[#1f6f5b]">
              Back to events
            </Text>
          </Pressable>

          {isLoading ? (
            <LoadingState label="Loading event details" />
          ) : errorMessage ? (
            <ErrorState message={errorMessage} onRetry={loadEvent} />
          ) : event ? (
            <EventDetailContent
              event={event}
              onReservationSettled={loadEvent}
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function EventDetailContent({
  event,
  onReservationSettled,
}: {
  event: EventDetail;
  onReservationSettled: () => Promise<void>;
}) {
  const [selectedQuantities, setSelectedQuantities] = useState<
    Record<string, number>
  >({});
  const [isReserving, setIsReserving] = useState(false);
  const [reservationMessage, setReservationMessage] = useState<string | null>(
    null,
  );
  const [reservationError, setReservationError] = useState<string | null>(null);

  const selectedItems = event.ticketTypes
    .map((ticketType) => ({
      ticketTypeId: ticketType.id,
      quantity: selectedQuantities[ticketType.id] ?? 0,
    }))
    .filter((item) => item.quantity > 0);

  const selectedTicketCount = selectedItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const selectedTotalCents = event.ticketTypes.reduce(
    (sum, ticketType) =>
      sum + (selectedQuantities[ticketType.id] ?? 0) * ticketType.priceCents,
    0,
  );
  const currency = event.ticketTypes[0]?.currency ?? "USD";

  function updateTicketQuantity(ticketTypeId: string, nextQuantity: number) {
    setReservationError(null);
    setReservationMessage(null);
    setSelectedQuantities((current) => ({
      ...current,
      [ticketTypeId]: nextQuantity,
    }));
  }

  async function handleReserveTickets() {
    if (selectedItems.length === 0 || isReserving) {
      return;
    }

    setIsReserving(true);
    setReservationError(null);
    setReservationMessage(null);

    try {
      const reservation = await createReservation(selectedItems);
      setSelectedQuantities({});
      setReservationMessage(
        `Reserved ${selectedTicketCount} ticket${
          selectedTicketCount === 1 ? "" : "s"
        } until ${formatTime(reservation.expiresAt)}.`,
      );
    } catch (error) {
      setReservationError(
        error instanceof Error ? error.message : "Unable to reserve tickets.",
      );
    } finally {
      setIsReserving(false);
      await onReservationSettled();
    }
  }

  return (
    <View>
      <Text className="text-[13px] font-black uppercase text-[#1f6f5b]">
        {event.category}
      </Text>
      <Text className="mt-2.5 text-[36px] font-black leading-[41px] text-[#10231e]">
        {event.title}
      </Text>
      <Text className="mt-3 text-[15px] leading-[22px] text-[#557169]">
        {formatDateTime(event.startsAt)} - {event.venue.name}
      </Text>
      <Text className="mt-[18px] text-base leading-6 text-[#314d45]">
        {event.description}
      </Text>

      <View className="mt-6 rounded-lg bg-[#e7f3ef] p-[18px]">
        <Text className="text-xs font-black uppercase text-[#557169]">
          Venue
        </Text>
        <Text className="mt-2 text-lg font-extrabold text-[#10231e]">
          {event.venue.name}
        </Text>
        <Text className="mt-1.5 text-[15px] leading-[22px] text-[#557169]">
          {event.venue.address}, {event.venue.city}, {event.venue.state}
        </Text>
      </View>

      <View className="mt-7">
        <Text className="mb-[14px] text-[22px] font-black text-[#10231e]">
          Tickets
        </Text>
        {event.ticketTypes.map((ticketType) => (
          <View
            key={ticketType.id}
            className="mb-3 flex-row items-start justify-between rounded-lg border border-[#d7e4df] bg-white p-4"
          >
            <View className="flex-1 pr-[14px]">
              <Text className="text-[17px] font-extrabold text-[#10231e]">
                {ticketType.name}
              </Text>
              {ticketType.description ? (
                <Text className="mt-1.5 text-sm leading-5 text-[#557169]">
                  {ticketType.description}
                </Text>
              ) : null}
              <Text className="mt-1.5 text-[13px] text-[#6f8580]">
                {ticketType.availableQuantity} available of{" "}
                {ticketType.capacity} total
              </Text>
              {ticketType.reservedQuantity > 0 ? (
                <Text className="mt-1 text-[13px] font-bold text-[#9b5c18]">
                  {ticketType.reservedQuantity} temporarily held
                </Text>
              ) : null}
            </View>
            <View className="items-end">
              <Text className="text-right text-[17px] font-black text-[#10231e]">
                {formatPrice(ticketType.priceCents, ticketType.currency)}
              </Text>
              <View className="mt-3 flex-row items-center gap-2.5">
                <Pressable
                  accessibilityLabel={`Decrease ${ticketType.name} quantity`}
                  accessibilityRole="button"
                  disabled={
                    isReserving ||
                    (selectedQuantities[ticketType.id] ?? 0) === 0
                  }
                  onPress={() =>
                    updateTicketQuantity(
                      ticketType.id,
                      Math.max(0, (selectedQuantities[ticketType.id] ?? 0) - 1),
                    )
                  }
                  className={`h-[34px] w-[34px] items-center justify-center rounded-lg bg-[#1f6f5b] ${
                    isReserving ||
                    (selectedQuantities[ticketType.id] ?? 0) === 0
                      ? "opacity-35"
                      : ""
                  }`}
                >
                  <Text className="text-[20px] font-black leading-[22px] text-white">
                    -
                  </Text>
                </Pressable>
                <Text className="min-w-5 text-center text-[17px] font-black text-[#10231e]">
                  {selectedQuantities[ticketType.id] ?? 0}
                </Text>
                <Pressable
                  accessibilityLabel={`Increase ${ticketType.name} quantity`}
                  accessibilityRole="button"
                  disabled={
                    isReserving ||
                    (selectedQuantities[ticketType.id] ?? 0) >=
                      ticketType.availableQuantity
                  }
                  onPress={() =>
                    updateTicketQuantity(
                      ticketType.id,
                      Math.min(
                        ticketType.availableQuantity,
                        (selectedQuantities[ticketType.id] ?? 0) + 1,
                      ),
                    )
                  }
                  className={`h-[34px] w-[34px] items-center justify-center rounded-lg bg-[#1f6f5b] ${
                    isReserving ||
                    (selectedQuantities[ticketType.id] ?? 0) >=
                      ticketType.availableQuantity
                      ? "opacity-35"
                      : ""
                  }`}
                >
                  <Text className="text-[20px] font-black leading-[22px] text-white">
                    +
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
        <View className="mt-2 flex-row items-center justify-between rounded-lg bg-[#e7f3ef] p-4">
          <View>
            <Text className="text-xs font-black uppercase text-[#557169]">
              Selected
            </Text>
            <Text className="mt-1 text-base font-black text-[#10231e]">
              {selectedTicketCount} ticket{selectedTicketCount === 1 ? "" : "s"}{" "}
              - {formatPrice(selectedTotalCents, currency)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={isReserving || selectedItems.length === 0}
            onPress={handleReserveTickets}
            className={`rounded-lg px-4 py-3 ${
              isReserving || selectedItems.length === 0
                ? "bg-[#9fb7af]"
                : "bg-[#1f6f5b]"
            }`}
          >
            <Text className="text-sm font-black text-white">
              {isReserving ? "Reserving..." : "Reserve tickets"}
            </Text>
          </Pressable>
        </View>
        {reservationMessage ? (
          <Text className="mt-3 text-sm font-extrabold text-[#1f6f5b]">
            {reservationMessage}
          </Text>
        ) : null}
        {reservationError ? (
          <Text className="mt-3 text-sm font-bold text-[#9b1c1c]">
            {reservationError}
          </Text>
        ) : null}
      </View>
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

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
