import React, { useState, useEffect, useRef } from "react";
import { View, Switch, Platform, Pressable, Alert } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { cn } from "~/lib/utils";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

// Configure notifications to show alerts and play sounds
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

interface AlarmProps {
  onTrigger: () => void;
}

const Alarm = ({ onTrigger }: AlarmProps) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const isInitialMount = useRef(true);

  // Format time to display in a readable format
  const formattedTime = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  // Request notification permissions on mount
  useEffect(() => {
    registerForPushNotificationsAsync().then((status) => {
      setHasPermission(status === "granted");
      if (status !== "granted") {
        setDebugInfo("Notification permissions not granted");
      }
    });

    // Listen for notifications
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("Notification received:", notification);
        if (notification.request.content.data?.action === "startMyDay") {
          console.log("StartMyDay notification received");
          onTrigger();
        }
      });

    // Listen for user interactions with notifications
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("Notification response received:", response);
        if (
          response.notification.request.content.data?.action === "startMyDay"
        ) {
          console.log("StartMyDay notification response received");
          onTrigger();
        }
      });

    // Clean up listeners when the component unmounts
    return () => {
      Notifications.removeNotificationSubscription(
        notificationListener.current!
      );
      Notifications.removeNotificationSubscription(responseListener.current!);
      cancelAlarm();
    };
  }, []);

  // Schedule a test notification for debugging
  const scheduleTestNotification = async () => {
    try {
      // Schedule a notification 10 seconds from now
      const testIdentifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Test Notification",
          body: "This is a test notification (10 seconds after)",
          data: { action: "startMyDay" },
        },
        trigger: {
          seconds: 10, // this is right. it automatically infers. don't give the type!!
        },
      });
      setDebugInfo(`Test notification scheduled: ${testIdentifier}`);
      console.log(
        "Test notification scheduled for 10 seconds from now:",
        testIdentifier
      );
    } catch (error) {
      console.error("Error scheduling test notification:", error);
      setDebugInfo(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  // Update notification when alarm status changes
  useEffect(() => {
    // Skip this effect on the initial mount to prevent immediate triggering
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (isEnabled && hasPermission) {
      scheduleAlarm();
    } else if (!isEnabled) {
      cancelAlarm();
    } else if (isEnabled && !hasPermission) {
      // If alarm is enabled but no permissions, try to request them
      registerForPushNotificationsAsync().then((status) => {
        setHasPermission(status === "granted");
        if (status === "granted") {
          scheduleAlarm();
        } else {
          setDebugInfo(
            "Please grant notification permissions to use the alarm"
          );
          setIsEnabled(false);
        }
      });
    }
  }, [isEnabled, date, hasPermission]);

  const scheduleAlarm = async () => {
    try {
      // Cancel any existing notifications
      await cancelAlarm();

      // Calculate time until alarm
      const now = new Date();
      let triggerTime = new Date(date);

      console.log("Current time:", now.toLocaleString());
      console.log("Initial trigger time:", triggerTime.toLocaleString());
      console.log(
        "Times match?",
        now.getTime() === triggerTime.getTime() ? "Yes" : "No"
      );

      // If the selected time is earlier today, schedule for tomorrow
      if (triggerTime.getTime() <= now.getTime()) {
        console.log("Trigger time is in the past, scheduling for tomorrow");
        triggerTime.setDate(triggerTime.getDate() + 1);
        console.log("Updated trigger time:", triggerTime.toLocaleString());
      }

      // For debugging, log the time difference
      const diff = (triggerTime.getTime() - now.getTime()) / 1000;
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = Math.floor(diff % 60);

      console.log(`Scheduling alarm for ${triggerTime.toLocaleString()}`);
      console.log(
        `Time until alarm: ${hours}h ${minutes}m ${seconds}s (${diff} seconds total)`
      );
      console.log(
        `Date object details: ${JSON.stringify({
          year: triggerTime.getFullYear(),
          monthIndex: triggerTime.getMonth() + 1,
          day: triggerTime.getDate(),
          hours: triggerTime.getHours(),
          minutes: triggerTime.getMinutes(),
          seconds: triggerTime.getSeconds(),
        })}`
      );

      // Schedule the notification
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Smart Alarm",
          body: "Time to start your day right!",
          data: { action: "startMyDay" },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerTime,
        },
      });

      console.log("Scheduled alarm notification:", identifier);
      setNotification(identifier);
      setDebugInfo(
        `Alarm scheduled: ${identifier} for ${triggerTime.toLocaleTimeString()}`
      );

      // Also check if the notification was actually scheduled
      const scheduledNotifications =
        await Notifications.getAllScheduledNotificationsAsync();
      console.log("All scheduled notifications:", scheduledNotifications);
      console.log(
        "Number of scheduled notifications:",
        scheduledNotifications.length
      );

      if (scheduledNotifications.length > 0) {
        console.log(
          "First notification details:",
          JSON.stringify({
            id: scheduledNotifications[0].identifier,
            title: scheduledNotifications[0].content.title,
            body: scheduledNotifications[0].content.body,
            trigger: scheduledNotifications[0].trigger,
          })
        );
      } else {
        console.log("No scheduled notifications found after scheduling");
      }
    } catch (error) {
      console.error("Error scheduling alarm:", error);
      setDebugInfo(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  const cancelAlarm = async () => {
    try {
      if (notification) {
        await Notifications.cancelScheduledNotificationAsync(notification);
        console.log("Canceled notification:", notification);
        setNotification(null);
        setDebugInfo("Alarm canceled");
      }
    } catch (error) {
      console.error("Error canceling alarm:", error);
      setDebugInfo(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  // Toggle time picker
  const toggleTimePicker = () => {
    setShowPicker(!showPicker);
  };

  // Request permissions for notifications
  async function registerForPushNotificationsAsync() {
    let status;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    // Check if we're running on a physical device
    if (Device.isDevice) {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status: newStatus } =
          await Notifications.requestPermissionsAsync();
        finalStatus = newStatus;
      }

      status = finalStatus;
    } else {
      // For simulator/emulator, permissions are automatically granted
      status = "granted";
      console.log(
        "Using simulator, notifications may not appear. Permissions auto-granted."
      );
    }

    return status;
  }

  // Handle time change
  const onChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
    }

    if (selectedDate) {
      // Only update the time (hour, minute) and preserve the current date
      const currentDate = new Date();
      currentDate.setHours(selectedDate.getHours());
      currentDate.setMinutes(selectedDate.getMinutes());
      currentDate.setSeconds(0);
      setDate(currentDate);
    }
  };

  return (
    <Card className="p-6 mb-4">
      <Text className="text-2xl font-bold mb-4 text-center">Smart Alarm</Text>

      <View className="flex-row justify-between items-center mb-6">
        <Pressable onPress={toggleTimePicker}>
          <Text className="text-3xl font-bold">{formattedTime}</Text>
        </Pressable>

        <Switch
          trackColor={{ false: "#767577", true: "#b4d1ec" }}
          thumbColor={isEnabled ? "#0284c7" : "#f4f3f4"}
          onValueChange={setIsEnabled}
          value={isEnabled}
        />
      </View>

      {showPicker && (
        <View className="mb-4">
          <DateTimePicker
            value={date}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={onChange}
          />

          {Platform.OS === "ios" && (
            <Button onPress={() => setShowPicker(false)} className="mt-2">
              <Text>Done</Text>
            </Button>
          )}
        </View>
      )}

      <View className="bg-primary-foreground/10 rounded-lg p-4 mb-3">
        <Text
          className={cn(
            "text-sm",
            isEnabled ? "text-green-600 dark:text-green-400" : "text-gray-500"
          )}
        >
          {isEnabled ? `Alarm set for ${formattedTime}` : "Alarm is disabled"}
        </Text>
        <Text className="text-xs text-gray-500 mt-1">
          When triggered, "Start My Day Right" will automatically run
        </Text>
      </View>

      {/* Test notification button */}
      <Button
        variant="outline"
        onPress={scheduleTestNotification}
        className="mb-2"
      >
        <Text>Test Notification (10s)</Text>
      </Button>

      {/* Debug info */}
      {debugInfo && (
        <View className="bg-secondary-foreground/10 rounded-lg p-2 mt-2">
          <Text className="text-xs text-gray-500">{debugInfo}</Text>
        </View>
      )}

      {!hasPermission && (
        <Text className="text-xs text-red-500 mt-2">
          Notification permissions not granted. Please enable notifications for
          this app in your device settings.
        </Text>
      )}
    </Card>
  );
};

export default Alarm;
