import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { View, ActivityIndicator, ScrollView } from 'react-native';
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Text } from "~/components/ui/text";
import * as Calendar from 'expo-calendar';
import { format } from 'date-fns';

interface CalendarFetcherProps {
  onApiResponse: (response: string) => void;
}

// Define the ref type
export type CalendarFetcherRef = {
  fetchAndProcessEvents: () => Promise<void>;
};

// Using forwardRef to expose methods to parent component
const CalendarFetcher = forwardRef<CalendarFetcherRef, CalendarFetcherProps>(
  (props, ref) => {
    const { onApiResponse } = props;
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [requestString, setRequestString] = useState<string>('');
    const [apiResponse, setApiResponse] = useState<string | null>(null);

    // Fetch events and process them
    const fetchAndProcessEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        setRequestString('');
        setApiResponse(null);
        
        // Check permissions
        const { status } = await Calendar.requestCalendarPermissionsAsync();
        if (status !== 'granted') {
          setError('Calendar permission is required');
          setLoading(false);
          return;
        }
        
        // Get today's date range
        const today = new Date();
        const startDate = new Date(today.setHours(0, 0, 0, 0));
        const endDate = new Date(today.setHours(23, 59, 59, 999));
        
        // Get all calendars and events
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        let allEvents: any[] = [];
        
        for (const cal of calendars) {
          const events = await Calendar.getEventsAsync([cal.id], startDate, endDate);
          allEvents = [...allEvents, ...events];
        }
        
        // Sort events by start time
        allEvents.sort((a, b) => 
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        );
        
        // Format events for API
        const formattedRequest = allEvents.length > 0
          ? allEvents.map(event => {
              const start = format(new Date(event.startDate), 'h:mm a');
              const end = format(new Date(event.endDate), 'h:mm a');
              const timeStr = event.allDay ? 'All day' : `${start} - ${end}`;
              
              let eventStr = `${event.title} (${timeStr})`;
              if (event.location) eventStr += ` at ${event.location}`;
              if (event.notes) eventStr += ` - ${event.notes}`;
              return eventStr;
            }).join('\n')
          : "No events scheduled for today";
        
        setRequestString(formattedRequest);
        
        // Make actual API call to get GPT-4o summary
        try {
          const response = await fetch('https://smart-alarm-backend.vercel.app/api/summarize-calendar', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ calendarEvents: formattedRequest }),
          });
          
          const data = await response.json();
          
          if (response.ok) {
            setApiResponse(data.summary);
            onApiResponse(data.summary); // Call the callback with the API response
          } else {
            setError(data.error || 'Failed to get summary');
          }
        } catch (apiError) {
          setError('API request failed');
        }
        
        setLoading(false);
        
      } catch (err) {
        setError('Failed to fetch calendar events');
        setLoading(false);
      }
    };

    // Expose the fetchAndProcessEvents method to parent via ref
    useImperativeHandle(ref, () => ({
      fetchAndProcessEvents
    }));

    return (
      <View className="flex-1 p-4">
        <Button onPress={fetchAndProcessEvents} disabled={loading}>
          <Text>{loading ? "Loading..." : "Fetch Today's Events"}</Text>
        </Button>
        
        <Card className="mt-4 p-4">
          {loading ? (
            <View className="items-center p-2">
              <ActivityIndicator size="large" />
              <Text className="mt-2">Processing events...</Text>
            </View>
          ) : (
            <ScrollView>
              {error ? (
                <Text className="text-red-600">{error}</Text>
              ) : (
                <>
                  {requestString && (
                    <>
                      <Text className="font-bold">Request:</Text>
                      <Text className="p-2 bg-gray-100 rounded">{requestString}</Text>
                      
                      {apiResponse && (
                        <>
                          <Separator className="my-2" />
                          <Text className="font-bold">API Response:</Text>
                          <Text className="p-2 bg-gray-100 rounded">{apiResponse}</Text>
                        </>
                      )}
                    </>
                  )}
                  
                  {!requestString && !apiResponse && (
                    <Text>Press the button to fetch today's events</Text>
                  )}
                </>
              )}
            </ScrollView>
          )}
        </Card>
      </View>
    );
  }
);

export default CalendarFetcher;