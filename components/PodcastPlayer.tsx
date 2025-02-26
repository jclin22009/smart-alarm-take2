import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Button } from "~/components/ui/button";
import { Text,  } from "~/components/ui/text";
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Card } from '~/components/ui/card';
import * as rssParser from 'react-native-rss-parser';


const PodcastPlayer = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestEpisode, setLatestEpisode] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [podcastTitle, setPodcastTitle] = useState('');

  // Fetch the latest episode from NPR's Up First RSS feed
  const fetchLatestEpisode = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('https://feeds.npr.org/510318/podcast.xml');
      const responseText = await response.text();
      const rss = await rssParser.parse(responseText);
      
      // Get the latest episode (first item in the feed)
      if (rss.items && rss.items.length > 0) {
        const latest = rss.items[0];
        setPodcastTitle(latest.title);
        
        // Find the audio enclosure
        const audioEnclosure = latest.enclosures.find((enclosure) => 
          enclosure.mimeType.startsWith('audio/')
        );
        
        if (audioEnclosure) {
          setLatestEpisode(audioEnclosure.url);
        } else {
          setError('No audio found for the latest episode');
        }
      } else {
        setError('No episodes found in the feed');
      }
    } catch (err) {
      setError('Failed to fetch podcast feed');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Load and play audio
  const playPodcast = async () => {
    try {
      if (sound) {
        // If we already have a sound object, just play it
        await sound.playAsync();
        setIsPlaying(true);
      } else if (latestEpisode) {
        // Otherwise, load and play the audio
        setLoading(true);
        
        // Unload any existing audio first
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
        });
        
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: latestEpisode },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        
        setSound(newSound);
        setIsPlaying(true);
        setLoading(false);
      } else {
        // If we don't have an episode URL yet, fetch it first
        await fetchLatestEpisode();
      }
    } catch (err) {
      setError('Failed to play podcast');
      setLoading(false);
      console.error(err);
    }
  };

  // Pause audio
  const pausePodcast = async () => {
    if (sound) {
      await sound.pauseAsync();
      setIsPlaying(false);
    }
  };

  // Monitor playback status

type PlaybackStatus = AVPlaybackStatus;

const onPlaybackStatusUpdate = (status: PlaybackStatus) => {
    if (status.isLoaded) {
        setIsPlaying(status.isPlaying);
    } else {
        // Handle unloaded state or errors
        console.log("Audio not loaded:", status);
        if (status && 'error' in status) {
            setError(`Playback error: ${status.error}`);
        }
    }
};

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      if (sound) {
        sound?.unloadAsync();
      }
    };
  }, [sound]);

  // Fetch the latest episode when component mounts
  useEffect(() => {
    fetchLatestEpisode();
  }, []);

  return (
    <Card className="p-4 mt-4">
      <Text className="font-bold text-lg mb-2">NPR Up First Podcast</Text>
      
      {loading ? (
        <View className="items-center p-2">
          <ActivityIndicator size="small" />
          <Text className="mt-2">{latestEpisode ? 'Loading audio...' : 'Fetching latest episode...'}</Text>
        </View>
      ) : error ? (
        <Text className="text-red-600">{error}</Text>
      ) : (
        <>
          {podcastTitle && (
            <Text className="mb-2 italic">{podcastTitle}</Text>
          )}
          
          <View className="flex-row space-x-2">
            {isPlaying ? (
              <Button onPress={pausePodcast}>
                <Text>Pause</Text>
              </Button>
            ) : (
              <Button onPress={playPodcast}>
                <Text>Play Up First</Text>
              </Button>
            )}
            
            <Button variant="outline" onPress={fetchLatestEpisode}>
              <Text>Refresh</Text>
            </Button>
          </View>
        </>
      )}
    </Card>
  );
};

export default PodcastPlayer;