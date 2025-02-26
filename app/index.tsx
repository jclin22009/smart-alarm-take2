import * as React from "react";
import { View, ScrollView } from "react-native";
import Animated, {
  FadeInUp,
  FadeOutDown,
  LayoutAnimationConfig,
} from "react-native-reanimated";
import { Info } from "~/lib/icons/Info";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { Text } from "~/components/ui/text";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import CalendarFetcher from "~/components/CalendarFetcher";
import PodcastPlayer from "~/components/PodcastPlayer";
import StartMyDay from "~/components/StartMyDay";
import Alarm from "~/components/Alarm";

const GITHUB_AVATAR_URI =
  "https://i.pinimg.com/originals/ef/a2/8d/efa28d18a04e7fa40ed49eeb0ab660db.jpg";

export default function Screen() {
  const [progress, setProgress] = React.useState(78);
  const startMyDayRef = React.useRef<import("~/components/StartMyDay").StartMyDayRef>(null);

  function updateProgressValue() {
    setProgress(Math.floor(Math.random() * 100));
  }

  const handleAlarmTrigger = () => {
    // Trigger the StartMyDay component
    if (startMyDayRef.current) {
      startMyDayRef.current.startMyDay();
    }
  };

  return (
    <ScrollView className="flex-1">
      <View className="w-full p-3">
        {/* Alarm component */}
        <Alarm onTrigger={handleAlarmTrigger} />
        
        {/* StartMyDay component with ref */}
        <StartMyDay ref={startMyDayRef} />
      </View>
    </ScrollView>
  );
}
