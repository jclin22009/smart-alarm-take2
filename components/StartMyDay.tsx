import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Card } from "~/components/ui/card";
import CalendarFetcher, { CalendarFetcherRef } from '~/components/CalendarFetcher';
import PodcastPlayer from '~/components/PodcastPlayer';
import * as Speech from 'expo-speech';
import { Audio, InterruptionModeIOS } from 'expo-av';
import { AVPlaybackStatus } from 'expo-av';

// Define the ref type
export interface StartMyDayRef {
  startMyDay: () => void;
}

const StartMyDay = forwardRef<StartMyDayRef, {}>((props, ref) => {
  const [isLoading, setIsLoading] = useState(false);
  const [calendarSummary, setCalendarSummary] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [podcastControl, setPodcastControl] = useState<'play' | 'pause' | 'refresh' | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'idle' | 'fetching-calendar' | 'speaking' | 'playing-podcast'>('idle');
  
  // Add a ref for the CalendarFetcher component
  const calendarFetcherRef = useRef<CalendarFetcherRef>(null);
  
  // Add a timeout ref to handle potential speech issues
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle API response from CalendarFetcher
  const handleCalendarResponse = (response: string) => {
    setCalendarSummary(response);
    setIsLoading(false);
    
    // Start speaking the calendar summary
    setStep('speaking');
    setIsSpeaking(true);
    
    // Set a safety timeout in case speech onDone doesn't fire
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
    }
    
    // Safety timeout to ensure podcast plays even if speech callbacks fail
    speechTimeoutRef.current = setTimeout(() => {
      if (step === 'speaking') {
        console.log('Speech timeout triggered, proceeding to podcast');
        Speech.stop(); // Stop any ongoing speech
        setIsSpeaking(false);
        moveToPodcast();
      }
    }, 30000); // 30-second timeout (adjust based on typical summary length)
    
    // Add an initialization delay to ensure audio system is fully ready
    // This is crucial for when the app is launched from a notification/alarm
    setTimeout(async () => {
      try {
        console.log('Setting up audio mode for speech...');
        
        // First, make sure we release any existing audio sessions
        await Audio.setIsEnabledAsync(false);
        await new Promise(resolve => setTimeout(resolve, 300)); // Short delay
        
        // Then re-enable and configure audio properly
        await Audio.setIsEnabledAsync(true);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false, // Use speaker, not earpiece
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        });
        
        console.log('Audio mode set, starting speech');
        
        // Now start the speech with proper audio setup
        Speech.speak(response, {
          language: 'en',
          pitch: 1.0,
          rate: 0.9,
          onStart: () => {
            console.log('Speech started');
            setIsSpeaking(true);
          },
          onDone: () => {
            console.log('Speech completed, moving to podcast');
            setIsSpeaking(false);
            
            // Clear the safety timeout since speech completed naturally
            if (speechTimeoutRef.current) {
              clearTimeout(speechTimeoutRef.current);
              speechTimeoutRef.current = null;
            }
            
            moveToPodcast();
          },
          onStopped: () => {
            console.log('Speech stopped');
            setIsSpeaking(false);
          },
          onError: (error: any) => {
            console.error('Speech error:', error);
            setError(`Speech error: ${error}`);
            setIsSpeaking(false);
            
            // Even if speech fails, we should still try to play the podcast
            moveToPodcast();
          }
        });
      } catch (err) {
        console.error('Audio setup error:', err);
        setError(`Audio setup error: ${err instanceof Error ? err.message : String(err)}`);
        
        // If audio setup fails, still try to do speech but it might be silent
        Speech.speak(response, {
          onDone: () => moveToPodcast(),
          onError: () => moveToPodcast()
        });
      }
    }, 800); // Add a delay to ensure app is fully awake when coming from notification
  };
  
  // Separate function to handle transition to podcast
  const moveToPodcast = () => {
    console.log('Moving to podcast playback');
    setStep('playing-podcast');
    
    // Small delay before starting podcast to ensure audio resources are properly released
    setTimeout(() => {
      setPodcastControl('play');
    }, 500);
  };

  // Start the day routine
  const startMyDay = async () => {
    console.log('Starting my day routine');
    setIsLoading(true);
    setError(null);
    setStep('fetching-calendar');
    
    // Reset podcast control
    setPodcastControl(undefined);
    
    // Stop any ongoing speech
    if (isSpeaking) {
      Speech.stop();
    }
    
    // Clear any existing timeout
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
    
    // Initialize audio system early - important for waking from alarm
    try {
      console.log('Initializing audio system...');
      
      // First ensure audio is enabled (needed when app just started from alarm)
      await Audio.setIsEnabledAsync(true);
      
      // Do a quick audio check to ensure the system is awake
      const soundObj = new Audio.Sound();
      // Load a tiny silent audio file to "prime" the audio system
      // This creates the audio session without playing anything noticeable
      await soundObj.loadAsync(require('~/assets/sounds/silent.mp3'));
      await soundObj.playAsync();
      
      // Give it a moment to ensure audio is initialized
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Then unload it
      await soundObj.unloadAsync();
      
      console.log('Audio system initialized');
    } catch (err) {
      console.warn('Audio initialization issue, continuing anyway:', err);
      // We'll continue even if this fails
    }
    
    // Trigger calendar fetching through the ref
    if (calendarFetcherRef.current) {
      calendarFetcherRef.current.fetchAndProcessEvents().catch(err => {
        setError("Calendar fetch error: " + (err.message || "Unknown error"));
        setIsLoading(false);
        setStep('idle');
      });
    } else {
      setError("Calendar component not initialized properly");
      setIsLoading(false);
      setStep('idle');
    }
  };

  // Expose the startMyDay method to parent components via ref
  useImperativeHandle(ref, () => ({
    startMyDay
  }));

  // Clean up speech and timeouts if component unmounts
  useEffect(() => {
    return () => {
      if (isSpeaking) {
        Speech.stop();
      }
      
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
      }
    };
  }, [isSpeaking]);

  return (
    <View className="p-4">
      <Card className="p-6 mb-4">
        
        <Button 
          size="lg" 
          onPress={startMyDay} 
          disabled={isLoading || isSpeaking}
          className="mb-4"
        >
          <Text className="font-bold">Start My Day Right</Text>
        </Button>
        
        {step !== 'idle' && (
          <View className="mt-2">
            <View className="flex-row items-center mb-2">
              <View className={`h-3 w-3 rounded-full mr-2 ${step === 'fetching-calendar' ? 'bg-amber-500' : (step === 'speaking' || step === 'playing-podcast') ? 'bg-green-500' : 'bg-gray-300'}`} />
              <Text>Fetch Calendar Events</Text>
              {step === 'fetching-calendar' && isLoading && <ActivityIndicator size="small" className="ml-2" />}
            </View>
            
            <View className="flex-row items-center mb-2">
              <View className={`h-3 w-3 rounded-full mr-2 ${step === 'speaking' ? 'bg-amber-500' : (step === 'playing-podcast') ? 'bg-green-500' : 'bg-gray-300'}`} />
              <Text>Read Daily Summary</Text>
              {isSpeaking && <ActivityIndicator size="small" className="ml-2" />}
            </View>
            
            <View className="flex-row items-center">
              <View className={`h-3 w-3 rounded-full mr-2 ${step === 'playing-podcast' ? 'bg-amber-500' : 'bg-gray-300'}`} />
              <Text>Play Morning Podcast</Text>
            </View>
          </View>
        )}
        
        {error && (
          <Text className="text-red-600 mt-2">{error}</Text>
        )}
      </Card>
      
      {/* Hidden CalendarFetcher but accessible via ref */}
      <View className="h-0 overflow-hidden">
        <CalendarFetcher ref={calendarFetcherRef} onApiResponse={handleCalendarResponse} />
      </View>
      
      {/* Podcast Player */}
      <PodcastPlayer controlState={podcastControl} />
    </View>
  );
});

StartMyDay.displayName = 'StartMyDay';

export default StartMyDay;