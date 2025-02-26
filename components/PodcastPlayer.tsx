import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Card } from '~/components/ui/card';
import * as rssParser from 'react-native-rss-parser';

interface PodcastPlayerProps {
  controlState?: 'play' | 'pause' | 'refresh';
}

const PodcastPlayer: React.FC<PodcastPlayerProps> = ({ controlState }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestEpisode, setLatestEpisode] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [podcastTitle, setPodcastTitle] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);

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
      setIsInitializing(false);
    }
  };

  // Load and play audio
  const playPodcast = async () => {
    try {
      if (sound) {
        // If we already have a sound object, just play it
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          await sound.playAsync();
          setIsPlaying(true);
        } else {
          // If sound was unloaded for some reason, reload it
          await loadAndPlaySound();
        }
      } else if (latestEpisode) {
        // Otherwise, load and play the audio
        await loadAndPlaySound();
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

  // Helper function to load and play sound
  const loadAndPlaySound = async () => {
    if (!latestEpisode) return;
    
    setLoading(true);
    
    try {
      // Unload any existing audio first
      if (sound) {
        await sound.unloadAsync();
      }
      
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
    } catch (err) {
      setError(`Failed to load audio: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Pause audio
  const pausePodcast = async () => {
    if (sound) {
      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      }
    }
  };

  // Monitor playback status
  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
      
      // Handle audio finishing
      if (status.didJustFinish) {
        setIsPlaying(false);
      }
    } else if (!isInitializing && status && 'error' in status) {
      // Only log and show errors, not normal unloaded states during initialization
      console.error("Playback error:", status.error);
      setError(`Playback error: ${status.error}`);
    }
  };

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(err => 
          console.warn("Error unloading sound on cleanup:", err)
        );
      }
    };
  }, [sound]);

  // Fetch the latest episode when component mounts
  useEffect(() => {
    fetchLatestEpisode();
    
    // Ensure proper audio setup on mount
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });
      } catch (err) {
        console.warn("Error setting audio mode:", err);
      }
    };
    
    setupAudio();
  }, []);

  // Handle controlState prop changes
  useEffect(() => {
    const handleControlChange = async () => {
      if (controlState === 'play' && !isPlaying) {
        await playPodcast();
      } else if (controlState === 'pause' && isPlaying) {
        await pausePodcast();
      } else if (controlState === 'refresh') {
        await fetchLatestEpisode();
      }
    };
    
    handleControlChange();
  }, [controlState]);

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