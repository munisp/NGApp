// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Partial<Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "creditcard.fill": "account-balance-wallet",
  "arrow.left.arrow.right.circle.fill": "swap-horiz",
  "checkmark.shield.fill": "verified-user",
  "person.fill": "person",
  "building.columns.fill": "account-balance",
  "chart.bar.fill": "bar-chart",
  "doc.badge.plus": "note-add",
  "checkmark.circle.fill": "check-circle",
  "chevron.left": "chevron-left",
  "code": "code",
  "bell.fill": "notifications",
  "link.circle.fill": "link",
  "cog.fill": "settings",
  "heart.circle.fill": "favorite",
  "slider.horizontal.3": "tune",
  "magnifyingglass": "search",
  "xmark.circle.fill": "cancel",
  "star.fill": "star",
  "lightbulb.fill": "lightbulb",
  "folder.fill": "folder",
  "cart.fill": "shopping-cart",
  "chart.line.uptrend.xyaxis": "trending-up",
  "doc.text.fill": "description",
  "gear": "settings",
  "calendar": "event",
  "sidebar.left": "menu-open",
  "sidebar.right": "menu",
  "xmark": "close",
  "arrow.right": "arrow-forward",
  "arrow.left": "arrow-back",
  "plus.circle.fill": "add-circle",
  "trash.fill": "delete",
  "pencil": "edit",
  "eye.fill": "visibility",
  "eye.slash.fill": "visibility-off",
  "lock.fill": "lock",
  "envelope.fill": "email",
  "phone.fill": "phone",
  "photo.fill": "photo",
  "dollarsign.circle.fill": "attach-money",
  "exclamationmark.triangle.fill": "warning",
  "info.circle.fill": "info",
  "questionmark.circle.fill": "help",
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
