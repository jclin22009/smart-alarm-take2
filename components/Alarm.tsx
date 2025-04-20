import React, { useState, useEffect, useRef } from "react";
import { View, Switch, Platform, Pressable, AppState, Modal, StyleSheet, ScrollView } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { cn } from "~/lib/utils";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import { Audio, InterruptionModeIOS } from "expo-av";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
} from "~/components/ui/dialog";
import { useColorScheme } from "~/lib/useColorScheme";
import { MoreHorizontal, Volume2 } from "lucide-react-native";
import Test from "./Test";

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
            interruptionModeIOS: InterruptionModeIOS.DoNotMix
          });
        }
        
        // If alarm should be triggering now or very soon (within 10 seconds)
        if (timeDiff <= 10) {
          console.log("[Background Task] Alarm is triggering now, ensuring audio is ready");
          // Force audio setup for maximum volume
          await Audio.setIsEnabledAsync(true);
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: false,
            interruptionModeIOS: InterruptionModeIOS.DoNotMix,
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

// Configure notifications to show alerts and play sounds with critical priority
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
    importance: Notifications.AndroidImportance.MAX,
  }),
});
  

// Define alarm sound options based on available sound files
const ALARM_SOUNDS = [
  { id: 'gentle_wakeup', name: 'Gentle Wakeup', file: require('~/assets/sounds/gentle_wakeup.wav') },
  { id: 'heavy_sleeper_joke', name: 'Heavy Sleeper', file: require('~/assets/sounds/heavy_sleeper_joke.m4a') },
  { id: 'notif_spam_joke', name: 'Notification Spam', file: require('~/assets/sounds/notif_spam_joke.m4a') },
  { id: 'silent', name: 'Silent', file: require('~/assets/sounds/silent.mp3') },
];

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
  const [alarmAlertVisible, setAlarmAlertVisible] = useState(false);
  const [alarmSound, setAlarmSound] = useState<Audio.Sound | null>(null);
  const [selectedAlarmSound, setSelectedAlarmSound] = useState(ALARM_SOUNDS[0]);
  const [soundSelectorOpen, setSoundSelectorOpen] = useState(false);
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
          // Immediately play sound when notification is received
          playAlarmSound();
          setAlarmAlertVisible(true);
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
          // When user interacts with notification, ensure sound is playing
          playAlarmSound();
          setAlarmAlertVisible(true);
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
      stopAlarmSound();
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
          title: "Alarm",
          body: "Time to wake up!",
          data: { 
            action: "startMyDay",
            type: "alarm",
            alarmTime: triggerTime.toISOString(),
            soundId: selectedAlarmSound.id
          },
          sound: selectedAlarmSound.id === 'silent' ? false : selectedAlarmSound.id,
          // Add categoryIdentifier for actions
          categoryIdentifier: "alarm",
          interruptionLevel: "critical", // Critical alert for iOS
          priority: "max", // Maximum priority for Android
          // Make the notification sticky on Android
          sticky: Platform.OS === "android",
          autoDismiss: false
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
  
  // Play alarm sound on loop with maximum volume
  const playAlarmSound = async () => {
    try {
      console.log("Starting alarm sound playback...");
      
      // Stop any existing sound
      if (alarmSound) {
        await alarmSound.stopAsync();
        await alarmSound.unloadAsync();
      }
      
      // Configure audio for maximum volume and background playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,  // Play even when device is on silent
        staysActiveInBackground: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      
      // Load and play the selected alarm sound
      const { sound } = await Audio.Sound.createAsync(
        selectedAlarmSound.file,
        { 
          isLooping: true,
          shouldPlay: true,
          volume: 1.0, // Maximum volume
        }
      );
      
      setAlarmSound(sound);
      console.log(`Alarm sound "${selectedAlarmSound.name}" playing on loop`);
    } catch (err) {
      console.error("Error playing alarm sound:", err);
    }
  };
  
  // Stop the alarm sound
  const stopAlarmSound = async () => {
    try {
      if (alarmSound) {
        await alarmSound.stopAsync();
        await alarmSound.unloadAsync();
        setAlarmSound(null);
        console.log("Alarm sound stopped");
      }
    } catch (err) {
      console.error("Error stopping alarm sound:", err);
    }
  };

  // Open edit dialog, initializing tempDate with current date
  const openEditDialog = () => {
    setTempDate(new Date(date));
    setDialogOpen(true);
  };
  
  // Open the sound selector dialog
  const openSoundSelector = () => {
    console.log("Opening sound selector");
    // Make sure not to have both dialogs open at the same time
    setDialogOpen(false); // Close the edit dialog first
    // Use setTimeout to ensure dialogs don't conflict
    setTimeout(() => {
      setSoundSelectorOpen(true);
    }, 100);
  };
  
  // Handle sound selection
  const handleSelectSound = (sound: typeof ALARM_SOUNDS[0]) => {
    setSelectedAlarmSound(sound);
    setSoundSelectorOpen(false);
    
    // Preview the selected sound
    previewAlarmSound(sound);
    
    // If alarm is enabled, reschedule with new sound
    if (isEnabled && hasPermission) {
      scheduleAlarm();
    }
    
    // Allow time for the sound selector to properly close before reopening the edit dialog
    setTimeout(() => {
      console.log("Reopening edit alarm dialog");
      setDialogOpen(true);
    }, 300);
  };
  
  // Preview the alarm sound briefly
  const previewAlarmSound = async (sound: typeof ALARM_SOUNDS[0]) => {
    try {
      // Stop any existing preview
      if (alarmSound) {
        await alarmSound.stopAsync();
        await alarmSound.unloadAsync();
        setAlarmSound(null);
      }
      
      // Skip preview for silent sound
      if (sound.id === 'silent') return;
      
      // Configure audio for preview
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        shouldDuckAndroid: false,
      });
      
      // Play a short preview of the sound
      const { sound: audioSound } = await Audio.Sound.createAsync(
        sound.file,
        { 
          shouldPlay: true,
          volume: 0.5, // Lower volume for preview
        }
      );
      
      setAlarmSound(audioSound);
      
      // Stop preview after 3 seconds
      setTimeout(async () => {
        if (audioSound) {
          await audioSound.stopAsync();
          await audioSound.unloadAsync();
          setAlarmSound(null);
        }
      }, 3000);
      
    } catch (err) {
      console.error("Error previewing sound:", err);
    }
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
    // Ensure sound selector is also closed
    setSoundSelectorOpen(false);
  };

  // Request permissions for notifications
  async function registerForPushNotificationsAsync() {
    let status;

    // Check if we're running on a physical device
    if (Device.isDevice) {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        // Request permissions with critical alerts option for iOS
        const { status: newStatus } =
          await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
              // allowAnnouncements: true,
              allowCriticalAlerts: true, // Request critical alerts permission
              provideAppNotificationSettings: true
            },
            android: {}
          });
        finalStatus = newStatus;
      }

      status = finalStatus;
      console.log("Notification permissions status:", status);
      
      // Log iOS-specific permissions if available
      if (Platform.OS === 'ios') {
        const permissions = await Notifications.getPermissionsAsync();
        console.log("iOS notification permissions:", permissions.ios);
      }
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

  // Handle alarm dismissal
  const handleDismissAlarm = () => {
    // Stop the alarm sound
    stopAlarmSound();
    
    // Hide the alarm alert
    setAlarmAlertVisible(false);
    
    // Trigger the StartMyDay flow after dismissal
    onTrigger();
  };

  return (
    <>
      <Card className="p-6 mb-4">

        <Pressable
          onPress={openEditDialog}
          className="flex-row justify-between items-center rounded-lg"
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

        <View className="bg-primary-foreground/10 rounded-lg pt-2">
          <Text
            className={cn(
              "text-md",
              isEnabled ? "text-green-600 dark:text-green-400" : "text-gray-500"
            )}
          >
            {isEnabled ? `Alarm set for ${formattedTime}` : "Alarm is disabled"}
          </Text>
        </View>

        {/* Debug info */}
        {/* {debugInfo && (
          <View className="bg-secondary-foreground/10 rounded-lg p-2 mt-2">
            <Text className="text-xs text-gray-500">{debugInfo}</Text>
          </View>
        )} */}

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

          <View className="mt-4">
            <Pressable 
              onPress={openSoundSelector}
              className="flex-row justify-between items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <View className="flex-row items-center gap-2">
                <Volume2 size={20} color={isDarkColorScheme ? "#e4e4e7" : "#71717a"} />
                <Text className="text-sm">Alarm Sound</Text>
              </View>
              <Text className="text-sm text-primary">{selectedAlarmSound.name}</Text>
            </Pressable>
            
            <Text className="text-sm text-gray-500 mt-2">
              When this alarm goes off, a sound will play until you dismiss it.
            </Text>
          </View>

          <DialogFooter>
            <Button variant="outline" onPress={cancelChanges} className="mr-2">
              <Text>Cancel</Text>
            </Button>
            <Button onPress={()=>{saveChanges(); setIsEnabled(true);}}>
              <Text>Save</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sound Selector Modal - completely separate from Dialog component */}
      <Modal
        visible={soundSelectorOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setSoundSelectorOpen(false);
          // Reopen the edit dialog after closing with back button
          setTimeout(() => setDialogOpen(true), 300);
        }}
        hardwareAccelerated={true}
        statusBarTranslucent={true}
      >
        <Pressable 
          style={StyleSheet.absoluteFill} 
          className="bg-black/50"
          onPress={() => {
            setSoundSelectorOpen(false);
            // Reopen the edit dialog when tapping outside
            setTimeout(() => setDialogOpen(true), 300);
          }}
        >
          <View className="flex-1 justify-center items-center">
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View className="bg-background w-80 rounded-lg p-4">
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="text-xl font-semibold">Select Alarm Sound</Text>
                  <Pressable onPress={() => {
                    setSoundSelectorOpen(false);
                    // Reopen the edit dialog when closing
                    setTimeout(() => setDialogOpen(true), 300);
                  }}>
                    <Text className="text-primary">Close</Text>
                  </Pressable>
                </View>
                
                <ScrollView className="max-h-64">
                  {ALARM_SOUNDS.map((sound) => (
                    <Pressable
                      key={sound.id}
                      onPress={() => handleSelectSound(sound)}
                      className={cn(
                        "flex-row justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800",
                        selectedAlarmSound.id === sound.id ? "bg-primary-foreground/10" : ""
                      )}
                    >
                      <Text className={cn(
                        "text-base",
                        selectedAlarmSound.id === sound.id ? "font-bold text-primary" : ""
                      )}>
                        {sound.name}
                      </Text>
                      
                      {selectedAlarmSound.id === sound.id && (
                        <View className="w-3 h-3 rounded-full bg-primary" />
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
                
                <View className="mt-4 flex-row justify-end">
                  <Button variant="outline" onPress={() => setSoundSelectorOpen(false)}>
                    <Text>Cancel</Text>
                  </Button>
                </View>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Full-screen Alarm Alert */}
      <Modal
        visible={alarmAlertVisible}
        transparent={false}
        animationType="fade"
        onRequestClose={() => {}} // Prevent back button from closing
      >
        <View style={StyleSheet.absoluteFill} className="bg-background flex items-center justify-between p-8">
          <View className="flex-1 justify-center items-center">
            <Text className="text-4xl font-bold mb-6 text-center">Alarm</Text>
            <Text className="text-5xl font-bold text-primary text-center">{formattedTime}</Text>
            <Text className="text-xl text-gray-500 mt-4 text-center">{selectedAlarmSound.name}</Text>
          </View>
          
          <Button 
            size="lg" 
            className="w-full mb-12" 
            onPress={handleDismissAlarm}
          >
            <Text className="text-xl font-bold">Dismiss</Text>
          </Button>
        </View>
      </Modal>
    </>
  );
};

export default Alarm;
