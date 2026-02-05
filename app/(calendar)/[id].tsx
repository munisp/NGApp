import { ScrollView, Text, View, Pressable, Alert } from "react-native";
import { useState, useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

interface CalendarEvent {
  id: string;
  type: "bill" | "loan" | "transfer" | "goal";
  title: string;
  amount: number;
  date: string;
  status: "upcoming" | "due" | "overdue" | "completed";
  description?: string;
}

export default function CalendarEventDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams();
  const [event, setEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    loadEvent();
  }, [id]);

  const loadEvent = async () => {
    try {
      const saved = await AsyncStorage.getItem("calendar_events");
      if (saved) {
        const events: CalendarEvent[] = JSON.parse(saved);
        const found = events.find((e) => e.id === id);
        if (found) {
          setEvent(found);
        }
      }
    } catch (error) {
      console.error("Failed to load event:", error);
    }
  };

  const markAsCompleted = async () => {
    if (!event) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    try {
      const saved = await AsyncStorage.getItem("calendar_events");
      if (saved) {
        const events: CalendarEvent[] = JSON.parse(saved);
        const updated = events.map((e) =>
          e.id === event.id ? { ...e, status: "completed" as const } : e
        );
        await AsyncStorage.setItem("calendar_events", JSON.stringify(updated));
        setEvent({ ...event, status: "completed" });
        Alert.alert("Success", "Event marked as completed!");
      }
    } catch (error) {
      console.error("Failed to update event:", error);
      Alert.alert("Error", "Failed to update event");
    }
  };

  const deleteEvent = async () => {
    if (!event) return;

    Alert.alert(
      "Delete Event",
      "Are you sure you want to delete this event?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            try {
              const saved = await AsyncStorage.getItem("calendar_events");
              if (saved) {
                const events: CalendarEvent[] = JSON.parse(saved);
                const filtered = events.filter((e) => e.id !== event.id);
                await AsyncStorage.setItem("calendar_events", JSON.stringify(filtered));
                router.back();
              }
            } catch (error) {
              console.error("Failed to delete event:", error);
              Alert.alert("Error", "Failed to delete event");
            }
          },
        },
      ]
    );
  };

  if (!event) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <Text className="text-lg text-muted">Event not found</Text>
        </View>
      </ScreenContainer>
    );
  }

  const getEventColor = (type: CalendarEvent["type"]) => {
    switch (type) {
      case "bill":
        return colors.warning;
      case "loan":
        return colors.error;
      case "transfer":
        return colors.primary;
      case "goal":
        return colors.success;
      default:
        return colors.muted;
    }
  };

  const getEventIcon = (type: CalendarEvent["type"]) => {
    switch (type) {
      case "bill":
        return "📄";
      case "loan":
        return "💰";
      case "transfer":
        return "↔️";
      case "goal":
        return "🎯";
      default:
        return "📅";
    }
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Event Icon */}
          <View className="items-center">
            <View
              style={{ backgroundColor: getEventColor(event.type) + "20" }}
              className="w-24 h-24 rounded-full items-center justify-center mb-4"
            >
              <Text className="text-5xl">{getEventIcon(event.type)}</Text>
            </View>
            <Text className="text-2xl font-bold text-foreground text-center mb-2">
              {event.title}
            </Text>
            <Text className="text-sm text-muted capitalize">{event.type} Event</Text>
          </View>

          {/* Event Details */}
          <View className="bg-surface rounded-2xl p-6 border border-border gap-4">
            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-muted">Amount</Text>
              <Text className="text-xl font-bold text-foreground">
                ${event.amount.toFixed(2)}
              </Text>
            </View>
            <View className="h-px bg-border" />
            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-muted">Date</Text>
              <Text className="text-base font-semibold text-foreground">
                {new Date(event.date).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </View>
            <View className="h-px bg-border" />
            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-muted">Status</Text>
              <View
                style={{ backgroundColor: getEventColor(event.type) + "20" }}
                className="px-4 py-2 rounded-full"
              >
                <Text
                  style={{ color: getEventColor(event.type) }}
                  className="text-sm font-semibold capitalize"
                >
                  {event.status}
                </Text>
              </View>
            </View>
            {event.description && (
              <>
                <View className="h-px bg-border" />
                <View>
                  <Text className="text-sm text-muted mb-2">Description</Text>
                  <Text className="text-base text-foreground">
                    {event.description}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Action Buttons */}
          {event.status !== "completed" && (
            <Pressable
              onPress={markAsCompleted}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.success,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              className="py-4 rounded-full items-center"
            >
              <Text className="text-background font-semibold text-base">
                Mark as Completed
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={deleteEvent}
            style={({ pressed }) => [
              {
                backgroundColor: colors.error + "20",
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            className="py-4 rounded-full items-center"
          >
            <Text
              style={{ color: colors.error }}
              className="font-semibold text-base"
            >
              Delete Event
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
