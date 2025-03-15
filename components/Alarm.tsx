import React, { useState, useEffect, useRef } from "react";
import { View, Switch, Platform, Pressable, AppState } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { cn } from "~/lib/utils";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import { Audio } from "expo-av";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
} from "~/components/ui/dialog";
import { useColorScheme } from "~/lib/useColorScheme";
import { MoreHorizontal } from "lucide-react-native";

const BACKGROUND_ALARM_TASK = "background-alarm-task";

// Define the background task
TaskManager.defineTask(BACKGROUND_ALARM_TASK, async () => {
  try {
    console.log("[Background Task] Checking if alarm should trigger");
    
    // Get all scheduled notifications
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    // Get current time
    const now = new Date();
    
    // Check if any alarm should trigger now
    for (const notification of scheduledNotifications) {
      if (notification.content.data?.type === "alarm") {
        const triggerTime = new Date(notification.trigger.value);
        const timeDiff = (triggerTime.getTime() - now.getTime()) / 1000;
        
        console.log(`[Background Task] Alarm scheduled for ${triggerTime.toLocaleString()}`);
        console.log(`[Background Task] Time until alarm: ${Math.floor(timeDiff / 60)} minutes ${Math.floor(timeDiff % 60)} seconds`);
        
        // If the alarm is within 1 minute of triggering, prepare audio system
        if (timeDiff > 0 && timeDiff < 60) {
          console.log("[Background Task] Alarm is about to trigger, preparing audio system");
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: false,
          });
        }
      }
    }
    
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error("[Background Task] Error:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Configure notifications to show alerts and play sounds
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

interface AlarmProps {
  onTrigger: () => void;
}

const Alarm = ({ onTrigger }: AlarmProps) => {
  const { isDarkColorScheme } = useColorScheme();
  const [isEnabled, setIsEnabled] = useState(false);
  const [date, setDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
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
  // Initialize background fetch task
  const registerBackgroundFetchAsync = async () => {
    try {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_ALARM_TASK, {
        minimumInterval: 60, // 1 minute
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log("Background fetch task registered");
    } catch (err) {
      console.error("Background fetch registration failed:", err);
    }
  };

  // Subscribe to app state changes to reinitialize alarm when app comes to foreground
  const appStateListener = useRef<any>(null);
  
  useEffect(() => {
    registerForPushNotificationsAsync().then((status) => {
      setHasPermission(status === "granted");
      if (status !== "granted") {
        setDebugInfo("Notification permissions not granted");
      } else {
        // Register background task if permissions granted
        registerBackgroundFetchAsync();
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

    // Listen for app state changes
    appStateListener.current = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        // Check and refresh alarms when app comes to foreground
        Notifications.getAllScheduledNotificationsAsync().then(
          (notifications) => {
            console.log("Currently scheduled notifications:", notifications);
            // If alarm is enabled but no notifications exist, reschedule
            if (isEnabled && notifications.length === 0) {
              scheduleAlarm();
            }
          }
        );
      }
    });

    // Clean up listeners when the component unmounts
    return () => {
      Notifications.removeNotificationSubscription(
        notificationListener.current!
      );
      Notifications.removeNotificationSubscription(responseListener.current!);
      appStateListener.current?.remove();
      cancelAlarm();
    };
  }, []);

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

      // Create a persistent "alarm set" notification
      await Notifications.setNotificationCategoryAsync("alarm", [
        {
          identifier: "dismiss",
          buttonTitle: "Dismiss",
          options: {
            isDestructive: true,
          },
        },
      ]);

      // Schedule the actual alarm notification
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Good Morning",
          body: "Time to start your day right!",
          data: { 
            action: "startMyDay",
            type: "alarm",
            alarmTime: triggerTime.toISOString()
          },
          sound: true,
          // Add categoryIdentifier for actions
          categoryIdentifier: "alarm",
          // Make the notification sticky on Android
          sticky: Platform.OS === "android",
          autoDismiss: false,
          // Ensure highest priority on Android
          priority: "max",
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

      // Ensure background task is registered
      await registerBackgroundFetchAsync();

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

  // Open edit dialog, initializing tempDate with current date
  const openEditDialog = () => {
    setTempDate(new Date(date));
    setDialogOpen(true);
  };

  // Save changes from dialog
  const saveChanges = () => {
    setDate(tempDate);
    setDialogOpen(false);

    // If alarm is enabled, reschedule with new time
    if (isEnabled && hasPermission) {
      scheduleAlarm();
    }
  };

  // Cancel dialog changes
  const cancelChanges = () => {
    setDialogOpen(false);
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

  // Handle time change in the dialog
  const onTimeChange = (event: any, selectedDate?: Date) => {
    if (selectedDate) {
      // Only update the time (hour, minute) and preserve the current date
      const currentDate = new Date(tempDate);
      currentDate.setHours(selectedDate.getHours());
      currentDate.setMinutes(selectedDate.getMinutes());
      currentDate.setSeconds(0);
      setTempDate(currentDate);
    }
  };

  return (
    <>
      <Card className="p-6 mb-4">
        <Text className="text-2xl font-bold mb-4 text-center">Smart Alarm</Text>

        <Pressable
          onPress={openEditDialog}
          className="flex-row justify-between items-center mb-6 bg-secondary/20 p-4 rounded-lg"
        >
          <View className="flex-row items-center gap-3">
            <Text className="text-3xl font-bold">{formattedTime}</Text>
            <MoreHorizontal size={24} color="gray" />
          </View>
          <Switch
            trackColor={{ false: "#767577", true: "#b4d1ec" }}
            thumbColor={isEnabled ? "#0284c7" : "#f4f3f4"}
            onValueChange={setIsEnabled}
            value={isEnabled}
          />
        </Pressable>

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

        {/* Debug info */}
        {debugInfo && (
          <View className="bg-secondary-foreground/10 rounded-lg p-2 mt-2">
            <Text className="text-xs text-gray-500">{debugInfo}</Text>
          </View>
        )}

        {!hasPermission && (
          <Text className="text-xs text-red-500 mt-2">
            Notification permissions not granted. Please enable notifications
            for this app in your device settings.
          </Text>
        )}
      </Card>

      {/* Edit Alarm Dialog */}
      <Dialog isOpen={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <Text className="text-xl font-semibold">Edit Alarm</Text>
          </DialogHeader>

          <View className="items-center py-4">
            <DateTimePicker
              value={tempDate}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={onTimeChange}
              themeVariant={isDarkColorScheme ? "dark" : "light"}
            />
          </View>

          <View className="mt-2">
            <Text className="text-sm text-gray-500">
              When this alarm goes off, "Start My Day Right" will automatically
              begin.
            </Text>
          </View>

          <DialogFooter>
            <Button variant="outline" onPress={cancelChanges} className="mr-2">
              <Text>Cancel</Text>
            </Button>
            <Button onPress={saveChanges}>
              <Text>Save</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Alarm;
