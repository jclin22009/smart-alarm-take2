import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Card } from "~/components/ui/card";
import CalendarFetcher, { CalendarFetcherRef } from '~/components/CalendarFetcher';
import PodcastPlayer from '~/components/PodcastPlayer';
import * as Speech from 'expo-speech';

const StartMyDay = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [calendarSummary, setCalendarSummary] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [podcastControl, setPodcastControl] = useState<'play' | 'pause' | 'refresh' | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'idle' | 'fetching-calendar' | 'speaking' | 'playing-podcast'>('idle');
  
  // Add a ref for the CalendarFetcher component
  const calendarFetcherRef = useRef<CalendarFetcherRef>(null);

  // Handle API response from CalendarFetcher
  const handleCalendarResponse = (response: string) => {
    setCalendarSummary(response);
    setIsLoading(false);
    
    // Start speaking the calendar summary
    setStep('speaking');
    setIsSpeaking(true);
    
    Speech.speak(response, {
      language: 'en',
      pitch: 1.0,
      rate: 0.9,
      onStart: () => {
        setIsSpeaking(true);
      },
      onDone: () => {
        setIsSpeaking(false);
        // After speaking is done, start podcast
        setStep('playing-podcast');
        setPodcastControl('play');
      },
      onStopped: () => {
        setIsSpeaking(false);
      },
      onError: (error: any) => {
        setError(`Speech error: ${error}`);
        setIsSpeaking(false);
      }
    });
  };

  // Start the day routine
  const startMyDay = () => {
    setIsLoading(true);
    setError(null);
    setStep('fetching-calendar');
    
    // Reset podcast control
    setPodcastControl(undefined);
    
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

  // Clean up speech if component unmounts
  useEffect(() => {
    return () => {
      if (isSpeaking) {
        Speech.stop();
      }
    };
  }, [isSpeaking]);

  return (
    <View className="flex-1 p-4">
      <Card className="p-6 mb-4">
        <Text className="text-2xl font-bold mb-4 text-center">Morning Routine</Text>
        
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
};

export default StartMyDay;