import { ScrollView, Text, View, Pressable, Alert, Switch } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  getWidgetEvents,
  getWidgetSettings,
  getWidgetSummary,
  updateWidgetSettings,
  refreshWidgetData,
  markEventCompleted,
  getEventsGroupedByDate,
  formatWidgetEvent,
  type CalendarWidgetEvent,
  type WidgetSettings,
} from "@/utils/calendar-widget";

export default function CalendarWidgetScreen() {
  const colors = useColors();
  const [events, setEvents] = useState<CalendarWidgetEvent[]>([]);
  const [groupedEvents, setGroupedEvents] = useState<Record<string, CalendarWidgetEvent[]>>({});
  const [settings, setSettings] = useState<WidgetSettings | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [eventsData, settingsData, summaryData, grouped] = await Promise.all([
      getWidgetEvents(),
      getWidgetSettings(),
      getWidgetSummary(),
      getEventsGroupedByDate(),
    ]);
    
    setEvents(eventsData);
    setSettings(settingsData);
    setSummary(summaryData);
    setGroupedEvents(grouped);
  };

  const handleRefresh = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const success = await refreshWidgetData();
      
      if (success) {
        await loadData();
        Alert.alert("Success", "Widget data refreshed");
      } else {
        Alert.alert("Error", "Failed to refresh widget data");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to refresh");
    }
  };

  const handleMarkCompleted = async (eventId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const success = await markEventCompleted(eventId);
      
      if (success) {
        await loadData();
      } else {
        Alert.alert("Error", "Failed to mark as completed");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to mark as completed");
    }
  };

  const handleUpdateSetting = async (key: keyof WidgetSettings, value: any) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const success = await updateWidgetSettings({ [key]: value });
      
      if (success) {
        await loadData();
      } else {
        Alert.alert("Error", "Failed to update setting");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update setting");
    }
  };

  if (showSettings && settings) {
    return (
      <ScreenContainer className="p-6">
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="gap-6">
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-foreground">Widget Settings</Text>
              <Pressable onPress={() => setShowSettings(false)}>
                <Text className="text-base text-muted">Done</Text>
              </Pressable>
            </View>

            <View className="gap-4">
              <View
                style={{ backgroundColor: colors.surface }}
                className="rounded-xl p-4 border border-border"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground">Show Bills</Text>
                    <Text className="text-sm text-muted">Display upcoming bill payments</Text>
                  </View>
                  <Switch
                    value={settings.show_bills}
                    onValueChange={(value) => handleUpdateSetting("show_bills", value)}
                    trackColor={{
                      false: colors.border,
                      true: colors.primary,
                    }}
                    thumbColor={colors.background}
                  />
                </View>
              </View>

              <View
                style={{ backgroundColor: colors.surface }}
                className="rounded-xl p-4 border border-border"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground">Show Loans</Text>
                    <Text className="text-sm text-muted">Display loan payment dates</Text>
                  </View>
                  <Switch
                    value={settings.show_loans}
                    onValueChange={(value) => handleUpdateSetting("show_loans", value)}
                    trackColor={{
                      false: colors.border,
                      true: colors.primary,
                    }}
                    thumbColor={colors.background}
                  />
                </View>
              </View>

              <View
                style={{ backgroundColor: colors.surface }}
                className="rounded-xl p-4 border border-border"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground">Show Goals</Text>
                    <Text className="text-sm text-muted">Display goal milestones</Text>
                  </View>
                  <Switch
                    value={settings.show_goals}
                    onValueChange={(value) => handleUpdateSetting("show_goals", value)}
                    trackColor={{
                      false: colors.border,
                      true: colors.primary,
                    }}
                    thumbColor={colors.background}
                  />
                </View>
              </View>

              <View
                style={{ backgroundColor: colors.surface }}
                className="rounded-xl p-4 border border-border"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground">Show Payments</Text>
                    <Text className="text-sm text-muted">Display scheduled payments</Text>
                  </View>
                  <Switch
                    value={settings.show_payments}
                    onValueChange={(value) => handleUpdateSetting("show_payments", value)}
                    trackColor={{
                      false: colors.border,
                      true: colors.primary,
                    }}
                    thumbColor={colors.background}
                  />
                </View>
              </View>

              <View
                style={{ backgroundColor: colors.surface }}
                className="rounded-xl p-4 border border-border gap-3"
              >
                <Text className="text-base font-semibold text-foreground">Days Ahead</Text>
                <Text className="text-sm text-muted">
                  Show events for the next {settings.days_ahead} days
                </Text>
                <View className="flex-row gap-2">
                  {[3, 7, 14, 30].map((days) => (
                    <Pressable
                      key={days}
                      onPress={() => handleUpdateSetting("days_ahead", days)}
                      style={({ pressed }) => [
                        {
                          backgroundColor:
                            settings.days_ahead === days ? colors.primary : colors.background,
                          borderColor: colors.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                      className="flex-1 rounded-lg py-2 border"
                    >
                      <Text
                        style={{
                          color:
                            settings.days_ahead === days ? colors.background : colors.foreground,
                        }}
                        className="text-center font-semibold text-sm"
                      >
                        {days}d
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          <View className="flex-row items-center justify-between">
            <View className="gap-1">
              <Text className="text-2xl font-bold text-foreground">Financial Calendar</Text>
              <Text className="text-sm text-muted">Upcoming bills, loans, and goals</Text>
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={handleRefresh}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                className="px-3 py-2 rounded-full border"
              >
                <Text className="text-sm font-semibold text-foreground">🔄</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowSettings(true);
                }}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                className="px-3 py-2 rounded-full border"
              >
                <Text className="text-sm font-semibold text-foreground">⚙️</Text>
              </Pressable>
            </View>
          </View>

          {/* Summary */}
          {summary && (
            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Due Today</Text>
                <Text
                  style={{ color: summary.due_today > 0 ? colors.warning : colors.success }}
                  className="text-2xl font-bold"
                >
                  {summary.due_today}
                </Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Total Due</Text>
                <Text className="text-2xl font-bold text-foreground">
                  ${summary.total_amount_due.toFixed(0)}
                </Text>
              </View>
            </View>
          )}

          {/* Events by Date */}
          {Object.keys(groupedEvents).length > 0 ? (
            <View className="gap-6">
              {Object.entries(groupedEvents).map(([date, dateEvents]) => (
                <View key={date} className="gap-3">
                  <Text className="text-lg font-semibold text-foreground">{date}</Text>
                  
                  {dateEvents.map((event) => {
                    const formatted = formatWidgetEvent(event);
                    
                    return (
                      <View
                        key={event.id}
                        style={{ backgroundColor: colors.surface }}
                        className="rounded-xl p-4 border border-border"
                      >
                        <View className="flex-row items-center gap-3 mb-3">
                          <View
                            style={{ backgroundColor: event.color + "20" }}
                            className="w-12 h-12 rounded-full items-center justify-center"
                          >
                            <Text className="text-2xl">{event.icon}</Text>
                          </View>
                          
                          <View className="flex-1">
                            <Text className="text-base font-semibold text-foreground">
                              {formatted.title}
                            </Text>
                            <Text className="text-sm text-muted">{formatted.subtitle}</Text>
                          </View>
                          
                          <View className="items-end">
                            <Text className="text-lg font-bold text-foreground">
                              {formatted.amount_text}
                            </Text>
                            <View
                              style={{ backgroundColor: formatted.status_color + "20" }}
                              className="px-2 py-0.5 rounded-full"
                            >
                              <Text
                                style={{ color: formatted.status_color }}
                                className="text-xs font-semibold"
                              >
                                {formatted.status_text}
                              </Text>
                            </View>
                          </View>
                        </View>
                        
                        <View className="flex-row items-center justify-between">
                          <Text className="text-sm text-muted">{formatted.date_text}</Text>
                          
                          {event.status !== "completed" && (
                            <Pressable
                              onPress={() => handleMarkCompleted(event.id)}
                              style={({ pressed }) => [
                                {
                                  backgroundColor: colors.success + "20",
                                  opacity: pressed ? 0.7 : 1,
                                },
                              ]}
                              className="px-3 py-1 rounded-full"
                            >
                              <Text
                                style={{ color: colors.success }}
                                className="text-xs font-semibold"
                              >
                                Mark Paid
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          ) : (
            <View className="items-center py-12">
              <Text className="text-6xl mb-4">📅</Text>
              <Text className="text-lg font-semibold text-foreground mb-2">
                No Upcoming Events
              </Text>
              <Text className="text-sm text-muted text-center">
                Your financial calendar is clear for the next {settings?.days_ahead || 7} days
              </Text>
            </View>
          )}

          {/* Info */}
          <View
            style={{ backgroundColor: colors.surface }}
            className="rounded-2xl p-4 border border-border"
          >
            <Text className="text-sm text-foreground leading-relaxed">
              <Text className="font-semibold">Widget Preview:</Text> This screen shows what
              would appear in your home screen widget. Configure which events to display in
              settings and refresh to see the latest data.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
