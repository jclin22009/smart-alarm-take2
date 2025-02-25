import React, { useState, useEffect } from 'react';
import { View, Text, Alert, Platform, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
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
      <View style={styles.container}>
        <Text style={styles.title}>Calendar permission is required to display your events</Text>
        <Button onPress={requestAccess}>
          <Text>Grant Permission</Text>
        </Button>
      </View>
    );
  }

  // Render loading screen
  if (loading && hasPermission !== null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text>Loading your calendar events...</Text>
      </View>
    );
  }

  // Render error screen
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <Button onPress={refreshEvents}>
          <Text>Retry</Text>
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.pageContainer}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Today's Events</Text>
        <Button variant="ghost" onPress={refreshEvents}>
          <Text>Refresh</Text>
        </Button>
      </View>
      
      <ScrollView>
        {events.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>No events scheduled for today</Text>
          </Card>
        ) : (
          <View style={styles.eventsList}>
            {events.map((event, index) => (
              <Card key={event.id} style={styles.eventCard}>
                <View 
                  style={[styles.colorStrip, { backgroundColor: event.calendar.color }]} 
                />
                <View style={styles.cardContent}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventTime}>{formatEventTime(event)}</Text>
                  
                  {event.location ? (
                    <Text style={styles.eventLocation}>📍 {event.location}</Text>
                  ) : null}
                  
                  {event.notes ? (
                    <View style={styles.notesContainer}>
                      <Separator />
                      <Text style={styles.eventNotes}>{event.notes}</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(226, 232, 240, 0.3)'
  },
  pageContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: 'rgba(226, 232, 240, 0.3)'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold'
  },
  eventsList: {
    gap: 12
  },
  eventCard: {
    overflow: 'hidden',
    marginBottom: 12
  },
  colorStrip: {
    height: 8
  },
  cardContent: {
    padding: 16
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '500'
  },
  eventTime: {
    color: '#64748b'
  },
  eventLocation: {
    marginTop: 4,
    fontSize: 14,
    color: '#64748b'
  },
  notesContainer: {
    marginTop: 8
  },
  eventNotes: {
    fontSize: 14,
    marginTop: 8
  },
  emptyCard: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyText: {
    fontSize: 18,
    color: '#64748b'
  },
  title: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 16
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#ef4444',
    marginBottom: 16
  }
});

export default DailyCalendar;