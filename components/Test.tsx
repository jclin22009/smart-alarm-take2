import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Audio } from 'expo-av';

// Configure the notification handler immediately
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

export default function NotificationSoundTest() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [permissionStatus, setPermissionStatus] = useState('unknown');
  const [isLoading, setIsLoading] = useState(false);

  // Request notification permissions on component mount
  useEffect(() => {
    registerForPushNotificationsAsync().then(status => {
      console.log('Permission status:', status);
      setPermissionStatus(status);
    });

    // Return a cleanup function to remove any listeners if needed
    return () => {
      // Cleanup code if needed
    };
  }, []);

  // Function to test notification with sound
  const scheduleNotificationWithSound = async (soundName: string) => {
    try {
      setIsLoading(true);
      console.log(`Scheduling notification with sound: ${soundName}`);

      // Make sure the sound name includes the extension (match what's in app.json)
      // Based on your app.json, your sound files are .m4a
      const soundFileName = `${soundName}.wav`;
      console.log(`Full sound file name: ${soundFileName}`);


      // const sound = new Audio.Sound();
      // sound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);

      const { sound: soundObject, status } = await Audio.Sound.createAsync(
        require('./assets/sounds/gentle_wakeup.wav'),
        { shouldPlay: true }
      );


      // add channel (idt this is needed tbh, only for android)
      await Notifications.setNotificationChannelAsync('wakeup', {
        name: 'wakeup alarm',
        importance: Notifications.AndroidImportance.HIGH,
        sound: soundFileName,
      });
      


      // This is important - We need to explicitly use TIME_INTERVAL as the type
      // This ensures a delay before notification appears
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Sound Test',
          body: 'This notification should play a custom sound',
          sound: soundFileName,
          interruptionLevel: 'critical',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 5,
          channelId: 'wakeup',
        },
      });

      console.log(`Notification scheduled with ID: ${notificationId} - Will trigger in 5 seconds`);
      Alert.alert(
        'Notification Scheduled',
        `A notification with sound "${soundName}" will trigger in 5 seconds. ID: ${notificationId}`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('Error scheduling notification:', error);
      Alert.alert('Error', `Failed to schedule notification: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to register for push notifications
  async function registerForPushNotificationsAsync() {
    let status;

    // Only request permission on physical devices
    if (Device.isDevice) {
      console.log('Checking notification permissions...');
      
      // Get current permission status
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log('Existing permission status:', existingStatus);
      
      let finalStatus = existingStatus;
      
      // Request permissions if not already granted
      if (existingStatus !== 'granted') {
        console.log('Requesting notification permissions...');
        
        const { status: newStatus } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            // Request critical alert permissions for alarms
            allowCriticalAlerts: true,
          },
        });
        
        console.log('New permission status:', newStatus);
        finalStatus = newStatus;
      }
      
      status = finalStatus;
    } else {
      // For simulator/emulator
      console.log('Using simulator, permissions automatically granted');
      status = 'granted';
    }

  

    return status;
  }

  // Debug information display
  const renderDebugInfo = () => (
    <View style={styles.debugContainer}>
      <Text style={styles.debugTitle}>Debug Info</Text>
      <Text style={styles.debugText}>Permission Status: {permissionStatus}</Text>
      <Text style={styles.debugText}>Platform: {Platform.OS}</Text>
      <Text style={styles.debugText}>Push Token: {expoPushToken || 'None'}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notification Sound Test</Text>
      
      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={() => scheduleNotificationWithSound('gentle_wakeup')}
        disabled={isLoading || permissionStatus !== 'granted'}
      >
        <Text style={styles.buttonText}>Test "Gentle Wakeup" Sound</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={() => scheduleNotificationWithSound('heavy_sleeper_joke')}
        disabled={isLoading || permissionStatus !== 'granted'}
      >
        <Text style={styles.buttonText}>Test "Heavy Sleeper" Sound</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={() => scheduleNotificationWithSound('notif_spam_joke')}
        disabled={isLoading || permissionStatus !== 'granted'}
      >
        <Text style={styles.buttonText}>Test "Notification Spam" Sound</Text>
      </TouchableOpacity>
      
      {permissionStatus !== 'granted' && (
        <Text style={styles.warningText}>
          Notification permissions not granted. Please enable notifications in settings.
        </Text>
      )}
      
      {renderDebugInfo()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  button: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  warningText: {
    color: 'red',
    marginTop: 20,
    textAlign: 'center',
  },
  debugContainer: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#eee',
    borderRadius: 8,
    width: '100%',
  },
  debugTitle: {
    fontWeight: 'bold',
    marginBottom: 10,
  },
  debugText: {
    fontSize: 12,
    marginBottom: 5,
  },
});