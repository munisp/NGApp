import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch } from "react-native";

export function SettingsHomeScreen({ navigation }: { navigation: { navigate: (screen: string) => void } }) {
  const [biometric, setBiometric] = React.useState(true);
  const [pushNotif, setPushNotif] = React.useState(true);
  const [offlineMode, setOfflineMode] = React.useState(false);

  const sections = [
    { title: "Account", items: [
      { label: "Profile", onPress: () => navigation.navigate("Profile") },
      { label: "Security", onPress: () => navigation.navigate("Security") },
      { label: "Notifications", onPress: () => navigation.navigate("Notifications") },
    ]},
    { title: "Data", items: [
      { label: "Offline Data", onPress: () => navigation.navigate("OfflineData") },
    ]},
  ];

  return (
    <ScrollView style={s.container}>
      <View style={s.header}><Text style={s.title}>Settings</Text></View>
      {sections.map((section, si) => (
        <View key={si}>
          <Text style={s.sectionTitle}>{section.title}</Text>
          {section.items.map((item, ii) => (
            <TouchableOpacity key={ii} style={s.item} onPress={item.onPress}>
              <Text style={s.itemText}>{item.label}</Text>
              <Text style={s.arrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
      <Text style={s.sectionTitle}>Preferences</Text>
      <View style={s.toggleItem}><Text style={s.itemText}>Biometric Login</Text><Switch value={biometric} onValueChange={setBiometric} trackColor={{ true: "#10b981" }} /></View>
      <View style={s.toggleItem}><Text style={s.itemText}>Push Notifications</Text><Switch value={pushNotif} onValueChange={setPushNotif} trackColor={{ true: "#10b981" }} /></View>
      <View style={s.toggleItem}><Text style={s.itemText}>Offline Mode</Text><Switch value={offlineMode} onValueChange={setOfflineMode} trackColor={{ true: "#10b981" }} /></View>
      <View style={s.footer}><Text style={s.footerText}>NDSEP Mobile v1.0.0</Text><Text style={s.footerText}>National Data Sovereignty Enforcement Platform</Text></View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: { padding: 20, paddingTop: 10 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  sectionTitle: { color: "#6b7280", fontSize: 12, fontWeight: "600", textTransform: "uppercase", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  item: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#1f2937" },
  itemText: { color: "#e5e7eb", fontSize: 16 },
  arrow: { color: "#6b7280", fontSize: 20 },
  toggleItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1f2937" },
  footer: { padding: 20, marginTop: 30, alignItems: "center" },
  footerText: { color: "#4b5563", fontSize: 12 },
});
