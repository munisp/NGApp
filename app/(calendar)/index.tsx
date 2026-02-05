import { ScrollView, Text, View, Pressable } from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { TutorialOverlay, TutorialStep } from "@/components/tutorial-overlay";

interface CalendarEvent {
  id: string;
  type: "bill" | "loan" | "transfer" | "goal";
  title: string;
  amount: number;
  date: string;
  status: "upcoming" | "due" | "overdue" | "completed";
  description?: string;
}

export default function FinancialCalendarScreen() {
  const colors = useColors();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [selectedDate, setSelectedDate] = useState(new Date());

  const tutorialSteps: TutorialStep[] = [
    {
      id: 'calendar_intro',
      title: 'Financial Calendar',
      description: 'View all your financial events in one place: bills, loans, transfers, and savings goals.',
      position: 'top',
    },
    {
      id: 'calendar_views',
      title: 'Multiple Views',
      description: 'Switch between month, week, and day views to see your events at different levels of detail.',
      position: 'center',
    },
    {
      id: 'calendar_actions',
      title: 'Quick Actions',
      description: 'Tap any event to see details and take quick actions like paying bills or viewing receipts.',
      position: 'bottom',
    },
  ];

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const saved = await AsyncStorage.getItem("calendar_events");
      if (saved) {
        setEvents(JSON.parse(saved));
      } else {
        // Sample events for demo
        const sampleEvents: CalendarEvent[] = [
          {
            id: "1",
            type: "bill",
            title: "Electricity Bill",
            amount: 75,
            date: new Date(Date.now() + 86400000).toISOString(),
            status: "upcoming",
            description: "Monthly electricity payment",
          },
          {
            id: "2",
            type: "loan",
            title: "Personal Loan Payment",
            amount: 250,
            date: new Date(Date.now() + 172800000).toISOString(),
            status: "upcoming",
            description: "Monthly loan installment",
          },
          {
            id: "3",
            type: "transfer",
            title: "Savings Transfer",
            amount: 100,
            date: new Date(Date.now() + 259200000).toISOString(),
            status: "upcoming",
            description: "Automatic savings transfer",
          },
          {
            id: "4",
            type: "goal",
            title: "Vacation Goal Milestone",
            amount: 500,
            date: new Date(Date.now() + 604800000).toISOString(),
            status: "upcoming",
            description: "Target milestone for vacation savings",
          },
        ];
        setEvents(sampleEvents);
        await AsyncStorage.setItem("calendar_events", JSON.stringify(sampleEvents));
      }
    } catch (error) {
      console.error("Failed to load events:", error);
    }
  };

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

  const getStatusBadge = (status: CalendarEvent["status"]) => {
    const statusConfig = {
      upcoming: { label: "Upcoming", color: colors.primary },
      due: { label: "Due Today", color: colors.warning },
      overdue: { label: "Overdue", color: colors.error },
      completed: { label: "Completed", color: colors.success },
    };
    return statusConfig[status];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  };

  const groupedEvents = events.reduce((acc, event) => {
    const dateKey = formatDate(event.date);
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  return (
    <>
      <TutorialOverlay
        tutorialKey="financial_calendar"
        steps={tutorialSteps}
        autoStart={true}
      />
      <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">
              Financial Calendar
            </Text>
            <Text className="text-sm text-muted">
              All your upcoming financial events
            </Text>
          </View>

          {/* View Mode Toggle */}
          <View className="flex-row gap-2">
            {(["month", "week", "day"] as const).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setViewMode(mode);
                }}
                style={({ pressed }) => [
                  {
                    backgroundColor: viewMode === mode ? colors.primary : colors.surface,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                className="flex-1 py-3 rounded-full items-center"
              >
                <Text
                  style={{
                    color: viewMode === mode ? colors.background : colors.foreground,
                  }}
                  className="font-semibold capitalize"
                >
                  {mode}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Summary Cards */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-sm text-muted mb-1">Total Due</Text>
              <Text className="text-xl font-bold text-foreground">
                ${events.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
              </Text>
            </View>
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-sm text-muted mb-1">Events</Text>
              <Text className="text-xl font-bold text-foreground">
                {events.length}
              </Text>
            </View>
          </View>

          {/* Events by Date */}
          <View className="gap-4">
            {Object.entries(groupedEvents).map(([date, dateEvents]) => (
              <View key={date} className="gap-3">
                <Text className="text-lg font-semibold text-foreground">
                  {date}
                </Text>
                {dateEvents.map((event) => (
                  <Pressable
                    key={event.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push(`/(calendar)/${event.id}`);
                    }}
                    style={({ pressed }) => [
                      {
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <View className="bg-surface rounded-2xl p-4 border border-border">
                      <View className="flex-row items-start gap-3">
                        <View
                          style={{ backgroundColor: getEventColor(event.type) + "20" }}
                          className="w-12 h-12 rounded-full items-center justify-center"
                        >
                          <Text className="text-2xl">{getEventIcon(event.type)}</Text>
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center justify-between mb-1">
                            <Text className="text-base font-semibold text-foreground">
                              {event.title}
                            </Text>
                            <View
                              style={{ backgroundColor: getStatusBadge(event.status).color + "20" }}
                              className="px-3 py-1 rounded-full"
                            >
                              <Text
                                style={{ color: getStatusBadge(event.status).color }}
                                className="text-xs font-semibold"
                              >
                                {getStatusBadge(event.status).label}
                              </Text>
                            </View>
                          </View>
                          {event.description && (
                            <Text className="text-sm text-muted mb-2">
                              {event.description}
                            </Text>
                          )}
                          <Text className="text-lg font-bold text-foreground">
                            ${event.amount.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>

          {/* Empty State */}
          {events.length === 0 && (
            <View className="items-center justify-center py-12">
              <Text className="text-6xl mb-4">📅</Text>
              <Text className="text-lg font-semibold text-foreground mb-2">
                No events scheduled
              </Text>
              <Text className="text-sm text-muted text-center">
                Your financial calendar is empty
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
    </>
  );
}
