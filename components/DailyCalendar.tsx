import React, { useState, useEffect } from 'react';
import { View, Text, Alert, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import * as Calendar from 'expo-calendar';
import { format } from 'date-fns';

// Type definitions for calendar events
interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
  allDay: boolean;
  calendar: {
    id: string;
    title: string;
    color: string;
  };
}

const DailyCalendar = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Request calendar permissions and fetch events on component mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Calendar.requestCalendarPermissionsAsync();
        const hasPermission = status === 'granted';
        setHasPermission(hasPermission);

        if (hasPermission) {
          await fetchTodayEvents();
        }
      } catch (err) {
        setError('Failed to get calendar permissions');
        setLoading(false);
      }
    })();
  }, []);

  // Get all events for today
  const fetchTodayEvents = async () => {
    try {
      setLoading(true);
      
      // Get calendar IDs
      const calendars = await Calendar.getCalendarsAsync(
        Calendar.EntityTypes.EVENT
      );
      
      // Get today's start and end time
      const today = new Date();
      const startDate = new Date(today.setHours(0, 0, 0, 0));
      const endDate = new Date(today.setHours(23, 59, 59, 999));

      // Fetch events from all calendars
      let allEvents: CalendarEvent[] = [];
      
      for (const calendar of calendars) {
        const calendarEvents = await Calendar.getEventsAsync(
          [calendar.id],
          startDate,
          endDate
        );
        
        // Map calendar properties to our event type
        const formattedEvents = calendarEvents.map(event => ({
          id: event.id,
          title: event.title,
          startDate: new Date(event.startDate),
          endDate: new Date(event.endDate),
          location: event.location,
          notes: event.notes,
          allDay: event.allDay,
          calendar: {
            id: calendar.id,
            title: calendar.title,
            color: calendar.color
          }
        }));
        
        allEvents = [...allEvents, ...formattedEvents];
      }
      
      // Sort events by start time
      allEvents.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
      
      setEvents(allEvents);
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch calendar events');
      setLoading(false);
    }
  };

  // Format the time for display
  const formatEventTime = (event: CalendarEvent) => {
    if (event.allDay) {
      return 'All day';
    }
    
    const start = format(event.startDate, 'h:mm a');
    const end = format(event.endDate, 'h:mm a');
    return `${start} - ${end}`;
  };

  // Request calendar access
  const requestAccess = async () => {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status === 'granted') {
        setHasPermission(true);
        await fetchTodayEvents();
      } else {
        setHasPermission(false);
        setError('Calendar permission is required to show events');
      }
    } catch (err) {
      setError('Failed to request calendar permissions');
    }
  };

  // Refresh events
  const refreshEvents = async () => {
    if (hasPermission) {
      await fetchTodayEvents();
    }
  };

  // Render permission request screen
  if (hasPermission === false) {
    return (
      <View className="flex-1 justify-center items-center p-6 bg-gray-200">
        <Text className="text-lg text-center mb-4">Calendar permission is required to display your events</Text>
        <Button onPress={requestAccess}>
          <Text>Grant Permission</Text>
        </Button>
      </View>
    );
  }

  // Render loading screen
  if (loading && hasPermission !== null) {
    return (
      <View className="flex-1 justify-center items-center p-6 bg-gray-200">
        <ActivityIndicator size="large" />
        <Text>Loading your calendar events...</Text>
      </View>
    );
  }

  // Render error screen
  if (error) {
    return (
      <View className="flex-1 justify-center items-center p-6 bg-gray-200">
        <Text className="text-lg text-center text-red-600 mb-4">{error}</Text>
        <Button onPress={refreshEvents}>
          <Text>Retry</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1 p-4 bg-gray-200">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-2xl font-bold">Today's Events</Text>
        <Button variant="ghost" onPress={refreshEvents}>
          <Text>Refresh</Text>
        </Button>
      </View>
      
      <ScrollView>
        {events.length === 0 ? (
          <Card className="p-4 justify-center items-center">
            <Text className="text-lg text-gray-600">No events scheduled for today</Text>
          </Card>
        ) : (
          <View className="space-y-3">
            {events.map((event, index) => (
              <Card key={event.id} className="overflow-hidden mb-3">
                <View className="h-2" style={{ backgroundColor: event.calendar.color }} />
                <View className="p-4">
                  <Text className="text-lg font-medium">{event.title}</Text>
                  <Text className="text-gray-600">{formatEventTime(event)}</Text>
                  
                  {event.location ? (
                    <Text className="mt-1 text-sm text-gray-600">📍 {event.location}</Text>
                  ) : null}
                  
                  {event.notes ? (
                    <View className="mt-2">
                      <Separator />
                      <Text className="text-sm mt-2">{event.notes}</Text>
                    </View>
                  ) : null}
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default DailyCalendar;