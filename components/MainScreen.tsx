import { View } from "react-native";
import DailyCalendar from "./DailyCalendar";

export default function MainScreen() {
  return (
    <View className="flex-1 bg-background">
      <DailyCalendar />
    </View>
  );
}