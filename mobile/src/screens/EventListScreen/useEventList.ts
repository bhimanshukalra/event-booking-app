import { useCallback, useEffect, useState } from "react";
import { type EventListItem, getEvents } from "../../api/events";

type LoadEventsMode = "initial" | "refresh";

export function useEventList() {
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadEvents = useCallback(
    async (mode: LoadEventsMode = "initial") => {
      if (mode === "refresh") {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        setEvents(await getEvents());
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load events.",
        );
      } finally {
        if (mode === "refresh") {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  const refreshEvents = useCallback(() => loadEvents("refresh"), [loadEvents]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  return {
    errorMessage,
    events,
    isLoading,
    isRefreshing,
    loadEvents,
    refreshEvents,
  };
}
