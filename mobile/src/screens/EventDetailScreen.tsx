import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { type EventDetail, getEvent } from "../api/events";
import {
  createReservation,
  type Reservation,
  ReservationApiError,
} from "../api/reservations";
import { ErrorState, LoadingState } from "../components";

type EventDetailScreenProps = {
  eventId: string;
  onBack: () => void;
  onReservationCreated: (reservation: Reservation, event: EventDetail) => void;
};

export function EventDetailScreen({
  eventId,
  onBack,
  onReservationCreated,
}: EventDetailScreenProps) {
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
              onReservationCreated={onReservationCreated}
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
  onReservationCreated,
  onReservationSettled,
}: {
  event: EventDetail;
  onReservationCreated: (reservation: Reservation, event: EventDetail) => void;
  onReservationSettled: () => Promise<void>;
}) {
  const [selectedQuantities, setSelectedQuantities] = useState<
    Record<string, number>
  >({});
  const [isReserving, setIsReserving] = useState(false);
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
  const hasUnavailableSelection = event.ticketTypes.some(
    (ticketType) =>
      (selectedQuantities[ticketType.id] ?? 0) > ticketType.availableQuantity,
  );
  const canReserve =
    !isReserving && selectedItems.length > 0 && !hasUnavailableSelection;

  useEffect(() => {
    setSelectedQuantities((current) => {
      let didChange = false;
      const next: Record<string, number> = {};

      for (const ticketType of event.ticketTypes) {
        const currentQuantity = current[ticketType.id] ?? 0;
        const clampedQuantity = Math.min(
          Math.max(currentQuantity, 0),
          ticketType.availableQuantity,
        );

        if (clampedQuantity !== currentQuantity) {
          didChange = true;
        }

        if (clampedQuantity > 0) {
          next[ticketType.id] = clampedQuantity;
        }
      }

      if (Object.keys(current).length !== Object.keys(next).length) {
        didChange = true;
      }

      return didChange ? next : current;
    });
  }, [event.ticketTypes]);

  function updateTicketQuantity(ticketTypeId: string, nextQuantity: number) {
    const ticketType = event.ticketTypes.find(
      (candidate) => candidate.id === ticketTypeId,
    );

    if (!ticketType || isReserving) {
      return;
    }

    const clampedQuantity = Math.min(
      Math.max(nextQuantity, 0),
      ticketType.availableQuantity,
    );

    setReservationError(null);
    setSelectedQuantities((current) => {
      const next = { ...current };

      if (clampedQuantity === 0) {
        delete next[ticketTypeId];
      } else {
        next[ticketTypeId] = clampedQuantity;
      }

      return next;
    });
  }

  async function handleReserveTickets() {
    if (!canReserve) {
      if (selectedItems.length > 0 && hasUnavailableSelection) {
        setReservationError(
          "Your selection is no longer available. Review the updated ticket counts and try again.",
        );
      }
      return;
    }

    setIsReserving(true);
    setReservationError(null);

    try {
      const reservation = await createReservation(selectedItems);
      setSelectedQuantities({});
      onReservationCreated(reservation, event);
      void onReservationSettled();
    } catch (error) {
      setReservationError(getReservationErrorCopy(error));
      await onReservationSettled().catch(() => undefined);
    } finally {
      setIsReserving(false);
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
        {event.ticketTypes.map((ticketType) => {
          const selectedQuantity = selectedQuantities[ticketType.id] ?? 0;
          const isSoldOut = ticketType.availableQuantity === 0;
          const canDecrease = !isReserving && selectedQuantity > 0;
          const canIncrease =
            !isReserving &&
            !isSoldOut &&
            selectedQuantity < ticketType.availableQuantity;

          return (
            <View
              key={ticketType.id}
              className={`mb-3 flex-row items-start justify-between rounded-lg border p-4 ${
                isSoldOut
                  ? "border-[#ead4d4] bg-[#fff7f7]"
                  : "border-[#d7e4df] bg-white"
              }`}
            >
              <View className="flex-1 pr-[14px]">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="text-[17px] font-extrabold text-[#10231e]">
                    {ticketType.name}
                  </Text>
                  {isSoldOut ? (
                    <Text className="rounded-md bg-[#f0dada] px-2 py-1 text-[11px] font-black uppercase text-[#8a1f1f]">
                      Sold out
                    </Text>
                  ) : null}
                </View>
                {ticketType.description ? (
                  <Text className="mt-1.5 text-sm leading-5 text-[#557169]">
                    {ticketType.description}
                  </Text>
                ) : null}
                <Text
                  className={`mt-1.5 text-[13px] ${
                    isSoldOut ? "font-bold text-[#8a1f1f]" : "text-[#6f8580]"
                  }`}
                >
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
                    disabled={!canDecrease}
                    onPress={() =>
                      updateTicketQuantity(ticketType.id, selectedQuantity - 1)
                    }
                    className={`h-[34px] w-[34px] items-center justify-center rounded-lg bg-[#1f6f5b] ${
                      canDecrease ? "" : "opacity-35"
                    }`}
                  >
                    <Text className="text-[20px] font-black leading-[22px] text-white">
                      -
                    </Text>
                  </Pressable>
                  <Text className="min-w-5 text-center text-[17px] font-black text-[#10231e]">
                    {selectedQuantity}
                  </Text>
                  <Pressable
                    accessibilityLabel={`Increase ${ticketType.name} quantity`}
                    accessibilityRole="button"
                    disabled={!canIncrease}
                    onPress={() =>
                      updateTicketQuantity(ticketType.id, selectedQuantity + 1)
                    }
                    className={`h-[34px] w-[34px] items-center justify-center rounded-lg bg-[#1f6f5b] ${
                      canIncrease ? "" : "opacity-35"
                    }`}
                  >
                    <Text className="text-[20px] font-black leading-[22px] text-white">
                      +
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
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
            disabled={!canReserve}
            onPress={handleReserveTickets}
            className={`rounded-lg px-4 py-3 ${
              canReserve ? "bg-[#1f6f5b]" : "bg-[#9fb7af]"
            }`}
          >
            <Text className="text-sm font-black text-white">
              {isReserving ? "Reserving..." : "Reserve tickets"}
            </Text>
          </Pressable>
        </View>
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

function getReservationErrorCopy(error: unknown) {
  if (error instanceof ReservationApiError && error.statusCode === 409) {
    return "Those tickets were just taken or held by someone else. Availability has been refreshed, so adjust your selection and try again.";
  }

  return error instanceof Error ? error.message : "Unable to reserve tickets.";
}
