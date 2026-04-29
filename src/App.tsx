import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Home, 
  Search, 
  PlusSquare, 
  Heart, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Repeat, 
  Shuffle, 
  Volume2, 
  VolumeX,
  Volume1,
  Music,
  User,
  Upload,
  X,
  Edit2,
  Trash2,
  Plus,
  ListMusic,
  Clock,
  Mic2,
  Layout
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { get, set, del } from 'idb-keyval';
import { cn } from './utils/cn';

// Types
interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  cover: string;
  color: string;
  url: string;
  lyrics?: string;
  isLiked: boolean;
  audioBlob?: Blob;
  coverBlob?: Blob;
}

interface Playlist {
  id: string;
  name: string;
  image: string;
  trackIds: string[];
}

interface Artist {
  id: string;
  name: string;
  image: string;
  trackIds: string[];
}

interface UserProfile {
  name: string;
  avatar: string;
  letter: string;
}

const COLORS = [
  "from-blue-600", "from-red-600", "from-purple-600", 
  "from-pink-600", "from-indigo-600", "from-orange-600",
  "from-rose-600", "from-lime-600", "from-sky-600", "from-amber-600"
];

// Placeholder images
const DEFAULT_COVERS = {
  TRACK: "/images/default_track.jpg",
  PLAYLIST: "/images/default_playlist.jpg",
  ARTIST: "/images/default_artist.jpg"
};

const SidebarItem = ({ icon: Icon, label, active = false, collapsed = false, onClick }: { icon: any, label: string, active?: boolean, collapsed?: boolean, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    title={collapsed ? label : undefined}
    className={cn(
      "flex items-center transition-all rounded-md group",
      collapsed ? "justify-center p-3" : "gap-4 px-4 py-3 w-full",
      active ? "text-white bg-white/5" : "text-zinc-400 hover:text-white hover:bg-white/5"
    )}
  >
    <Icon className={cn("w-6 h-6 shrink-0", active ? "text-white" : "group-hover:text-white")} />
    {!collapsed && <span className="font-semibold truncate">{label}</span>}
  </button>
);

export default function App() {
  // State
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [prevVolume, setPrevVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [searchQuery, setSearchQuery] = useState("");
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'library' | 'liked' | 'playlist' | 'artist'>('home');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [navHistory, setNavHistory] = useState<string[]>(['home']);
  const [navIndex, setNavIndex] = useState(0);
  
  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [editingArtist, setEditingArtist] = useState<Artist | null>(null);
  const [showAddSongsToPlaylist, setShowAddSongsToPlaylist] = useState<string | null>(null);
  const [showPlaylistSelector, setShowPlaylistSelector] = useState<string | null>(null);
  const [showLyricsOverlay, setShowLyricsOverlay] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Sanjuanelo',
    avatar: '',
    letter: 'J'
  });
  const [isLoading, setIsLoading] = useState(true);

  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Navigation Logic
  const navigateTo = (tab: any, playlistId?: string, artistId?: string) => {
    const newPath = `${tab}${playlistId ? `:${playlistId}` : ''}${artistId ? `:${artistId}` : ''}`;
    if (navHistory[navIndex] !== newPath) {
      const newHistory = navHistory.slice(0, navIndex + 1);
      newHistory.push(newPath);
      setNavHistory(newHistory);
      setNavIndex(newHistory.length - 1);
    }
    setActiveTab(tab);
    if (playlistId) setSelectedPlaylistId(playlistId);
    if (artistId) setSelectedArtistId(artistId);
  };

  const goBack = () => {
    if (navIndex > 0) {
      const prevIndex = navIndex - 1;
      const path = navHistory[prevIndex];
      const [tab, pId, aId] = path.split(':');
      setActiveTab(tab as any);
      if (pId) setSelectedPlaylistId(pId);
      if (aId) setSelectedArtistId(aId);
      setNavIndex(prevIndex);
    }
  };

  const goForward = () => {
    if (navIndex < navHistory.length - 1) {
      const nextIndex = navIndex + 1;
      const path = navHistory[nextIndex];
      const [tab, pId, aId] = path.split(':');
      setActiveTab(tab as any);
      if (pId) setSelectedPlaylistId(pId);
      if (aId) setSelectedArtistId(aId);
      setNavIndex(nextIndex);
    }
  };

  // Persistence: Load Data
  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const storedTracks = localStorage.getItem('beatix_tracks');
        const storedPlaylists = localStorage.getItem('beatix_playlists');
        const storedArtists = localStorage.getItem('beatix_artists');
        const storedProfile = localStorage.getItem('beatix_profile');

        if (storedProfile) {
          const parsed = JSON.parse(storedProfile);
          const avatarBlob = await get('user_avatar');
          setUserProfile({
            ...parsed,
            avatar: avatarBlob ? URL.createObjectURL(avatarBlob) : parsed.avatar
          });
        }

        if (storedTracks) {
          const parsedTracks: Track[] = JSON.parse(storedTracks);
          const tracksWithBlobs = await Promise.all(parsedTracks.map(async (track) => {
            const audioBlob = await get(`audio_${track.id}`);
            const coverBlob = await get(`cover_${track.id}`);
            
            return {
              ...track,
              url: audioBlob ? URL.createObjectURL(audioBlob) : track.url,
              cover: coverBlob ? URL.createObjectURL(coverBlob) : (track.cover || DEFAULT_COVERS.TRACK),
              audioBlob,
              coverBlob
            };
          }));
          setTracks(tracksWithBlobs);
        }

        if (storedPlaylists) {
          const parsedPlaylists: Playlist[] = JSON.parse(storedPlaylists);
          const playlistsWithBlobs = await Promise.all(parsedPlaylists.map(async (p) => {
            const imageBlob = await get(`playlist_${p.id}`);
            return {
              ...p,
              image: imageBlob ? URL.createObjectURL(imageBlob) : (p.image || DEFAULT_COVERS.PLAYLIST)
            };
          }));
          setPlaylists(playlistsWithBlobs);
        }

        if (storedArtists) {
          const parsedArtists: Artist[] = JSON.parse(storedArtists);
          const artistsWithBlobs = await Promise.all(parsedArtists.map(async (a) => {
            const imageBlob = await get(`artist_${a.id}`);
            return {
              ...a,
              image: imageBlob ? URL.createObjectURL(imageBlob) : (a.image || DEFAULT_COVERS.ARTIST)
            };
          }));
          setArtists(artistsWithBlobs);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredData();
  }, []);

  // Persistence: Save Metadata
  useEffect(() => {
    if (!isLoading) {
      const tracksMeta = tracks.map(({ audioBlob, coverBlob, url, cover, ...rest }) => ({
        ...rest,
        url: '', // Don't store blob URLs
        cover: cover.startsWith('blob:') ? '' : cover
      }));
      localStorage.setItem('beatix_tracks', JSON.stringify(tracksMeta));
    }
  }, [tracks, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      const playlistsMeta = playlists.map(({ image, ...rest }) => ({
        ...rest,
        image: image.startsWith('blob:') ? '' : image
      }));
      localStorage.setItem('beatix_playlists', JSON.stringify(playlistsMeta));
    }
  }, [playlists, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      const artistsMeta = artists.map(({ image, ...rest }) => ({
        ...rest,
        image: image.startsWith('blob:') ? '' : image
      }));
      localStorage.setItem('beatix_artists', JSON.stringify(artistsMeta));
    }
  }, [artists, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      const profileMeta = { ...userProfile, avatar: '' };
      localStorage.setItem('beatix_profile', JSON.stringify(profileMeta));
    }
  }, [userProfile, isLoading]);

  // Derived Data
  const filteredTracks = useMemo(() => {
    return tracks.filter(track => 
      track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.artist.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tracks, searchQuery]);

  const likedTracks = useMemo(() => tracks.filter(t => t.isLiked), [tracks]);

  // Sync current track metadata (especially like status)
  const currentTrackSync = useMemo(() => {
    if (!currentTrack) return null;
    return tracks.find(t => t.id === currentTrack.id) || currentTrack;
  }, [tracks, currentTrack]);

  // Audio Effects
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (currentTrack && isPlaying) {
      audioRef.current?.play().catch(() => setIsPlaying(false));
    } else {
      audioRef.current?.pause();
    }
  }, [isPlaying, currentTrack]);

  // Player Handlers
  const togglePlay = () => setIsPlaying(!isPlaying);
  
  const toggleMute = () => {
    if (isMuted) {
      setVolume(prevVolume);
      setIsMuted(false);
    } else {
      setPrevVolume(volume);
      setVolume(0);
      setIsMuted(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const duration = audioRef.current.duration;
      if (duration) {
        setProgress((current / duration) * 100);
        const minutes = Math.floor(current / 60);
        const seconds = Math.floor(current % 60);
        setCurrentTime(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = (parseFloat(e.target.value) / 100) * (audioRef.current?.duration || 0);
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
      setProgress(parseFloat(e.target.value));
    }
  };

  const playTrack = (track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const nextTrack = () => {
    if (tracks.length === 0) return;
    const currentIndex = currentTrack ? tracks.findIndex(t => t.id === currentTrack.id) : -1;
    let nextIndex = (currentIndex + 1) % tracks.length;
    if (isShuffle) nextIndex = Math.floor(Math.random() * tracks.length);
    playTrack(tracks[nextIndex]);
  };

  const prevTrack = () => {
    if (tracks.length === 0) return;
    const currentIndex = currentTrack ? tracks.findIndex(t => t.id === currentTrack.id) : -1;
    const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
    playTrack(tracks[prevIndex]);
  };

  const toggleLike = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTracks(prev => prev.map(t => t.id === id ? { ...t, isLiked: !t.isLiked } : t));
  };

  // Upload Logic
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      
      audio.onloadedmetadata = async () => {
        const minutes = Math.floor(audio.duration / 60);
        const seconds = Math.floor(audio.duration % 60);
        const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        const id = Math.random().toString(36).substr(2, 9);
        await set(`audio_${id}`, file);
        
      const newTrack: Track = {
        id,
        title: file.name.replace(/\.[^/.]+$/, ""),
        artist: "Unknown Artist",
        album: "Unknown Album",
        duration: durationStr,
        cover: DEFAULT_COVERS.TRACK,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        url: url,
        isLiked: false,
        audioBlob: file
      };
        setTracks(prev => [...prev, newTrack]);
        setEditingTrack(newTrack);
        setShowUploadModal(false);
      };
    }
  };

  const saveTrackEdits = async (updatedTrack: Track) => {
    if (updatedTrack.coverBlob) {
      await set(`cover_${updatedTrack.id}`, updatedTrack.coverBlob);
    }

    // Process all artists for this track
    const trackArtistNames = updatedTrack.artist.split(',').map(a => a.trim()).filter(Boolean);
    
    setArtists(prev => {
      let currentArtists = [...prev];
      
      trackArtistNames.forEach(name => {
        const existingIndex = currentArtists.findIndex(a => a.name.toLowerCase() === name.toLowerCase());
        
        if (existingIndex !== -1) {
          // Update existing artist: add track ID if not present
          const artist = currentArtists[existingIndex];
          if (!artist.trackIds.includes(updatedTrack.id)) {
            currentArtists[existingIndex] = {
              ...artist,
              trackIds: [...artist.trackIds, updatedTrack.id]
            };
          }
        } else {
          // Create new artist
          currentArtists.push({
            id: Math.random().toString(36).substr(2, 9),
            name: name,
            image: DEFAULT_COVERS.ARTIST,
            trackIds: [updatedTrack.id]
          });
        }
      });
      
      return currentArtists;
    });

    setTracks(prev => prev.map(t => t.id === updatedTrack.id ? updatedTrack : t));
    if (currentTrack?.id === updatedTrack.id) setCurrentTrack(updatedTrack);
    setEditingTrack(null);
  };

  const savePlaylistEdits = async (p: Playlist, blob?: Blob) => {
    if (blob) {
      await set(`playlist_${p.id}`, blob);
    }
    setPlaylists(prev => prev.map(item => item.id === p.id ? p : item));
    setEditingPlaylist(null);
  };

  const saveArtistEdits = async (a: Artist, blob?: Blob) => {
    if (blob) {
      await set(`artist_${a.id}`, blob);
    }
    setArtists(prev => prev.map(item => item.id === a.id ? a : item));
    setEditingArtist(null);
  };

  const createPlaylist = (type: 'playlist' | 'artist') => {
    const id = Math.random().toString(36).substr(2, 9);
    const image = type === 'playlist' ? DEFAULT_COVERS.PLAYLIST : DEFAULT_COVERS.ARTIST;
    if (type === 'playlist') {
      const newPlaylist = { id, name: "New Playlist", image, trackIds: [] };
      setPlaylists(prev => [...prev, newPlaylist]);
      setEditingPlaylist(newPlaylist);
    } else {
      const newArtist = { id, name: "New Artist", image, trackIds: [] };
      setArtists(prev => [...prev, newArtist]);
      setEditingArtist(newArtist);
    }
    setShowCreateModal(false);
  };

  const addTrackToPlaylist = (trackId: string, playlistId: string) => {
    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        if (p.trackIds.includes(trackId)) return p;
        return { ...p, trackIds: [...p.trackIds, trackId] };
      }
      return p;
    }));
    setShowPlaylistSelector(null);
  };

  const addTrackToArtist = (trackId: string, artistId: string) => {
    setArtists(prev => prev.map(a => {
      if (a.id === artistId) {
        if (a.trackIds.includes(trackId)) return a;
        return { ...a, trackIds: [...a.trackIds, trackId] };
      }
      return a;
    }));
    setShowPlaylistSelector(null);
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch(e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'KeyM':
          toggleMute();
          break;
        case 'KeyL':
          if (currentTrack) toggleLike(currentTrack.id);
          break;
        case 'ArrowRight':
          if (e.shiftKey) nextTrack();
          else if (audioRef.current) audioRef.current.currentTime += 5;
          break;
        case 'ArrowLeft':
          if (e.shiftKey) prevTrack();
          else if (audioRef.current) audioRef.current.currentTime -= 5;
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(prev => Math.min(1, prev + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(prev => Math.max(0, prev - 0.1));
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTrack, volume, isMuted]);

  return (
    <div className="flex h-screen w-full bg-black text-zinc-100 overflow-hidden font-sans select-none">
      {currentTrack && (
        <audio 
          ref={audioRef} 
          src={currentTrack.url} 
          onTimeUpdate={handleTimeUpdate}
          onEnded={isRepeat ? () => { if(audioRef.current) audioRef.current.currentTime = 0; audioRef.current?.play(); } : nextTrack}
        />
      )}
      {/* Sidebar */}
      <aside className={cn(
        "bg-black flex flex-col gap-2 p-2 hidden md:flex h-full overflow-hidden transition-all duration-300",
        isSidebarCollapsed ? "w-[84px]" : "w-64"
      )}>
        <div className="bg-zinc-900 rounded-lg p-2">
          <SidebarItem icon={Home} label="Home" active={activeTab === 'home'} collapsed={isSidebarCollapsed} onClick={() => navigateTo('home')} />
          <SidebarItem icon={Search} label="Search" active={activeTab === 'search'} collapsed={isSidebarCollapsed} onClick={() => navigateTo('search')} />
        </div>

        <div className="bg-zinc-900 rounded-lg p-2 flex-1 flex flex-col overflow-hidden">
          <div className={cn("flex flex-col items-center mb-4 pt-2", isSidebarCollapsed ? "" : "px-2")}>
            <div className={cn("flex items-center w-full", isSidebarCollapsed ? "justify-center" : "justify-between")}>
              <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors p-3"
                title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                <ListMusic className="w-7 h-7" />
                {!isSidebarCollapsed && <span className="font-semibold text-lg">Your Library</span>}
              </button>
              {!isSidebarCollapsed && (
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors"
                >
                  <Plus className="w-6 h-6 text-zinc-400 hover:text-white" />
                </button>
              )}
            </div>
            
            {isSidebarCollapsed && (
              <button 
                onClick={() => setShowCreateModal(true)}
                className="mt-4 w-12 h-12 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center transition-colors shadow-lg group"
                title="Create New"
              >
                <Plus className="w-6 h-6 text-zinc-400 group-hover:text-white" />
              </button>
            )}
          </div>

          {!isSidebarCollapsed && (
            <div className="flex gap-2 px-2 mb-4 overflow-x-auto scrollbar-hide">
              <span className="px-3 py-1 bg-zinc-800 rounded-full text-xs font-semibold hover:bg-zinc-700 cursor-pointer whitespace-nowrap">Playlists</span>
              <span className="px-3 py-1 bg-zinc-800 rounded-full text-xs font-semibold hover:bg-zinc-700 cursor-pointer whitespace-nowrap">Artists</span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-1 scrollbar-hide pb-24">
            {likedTracks.length > 0 && (
              <div 
                className={cn(
                  "flex items-center hover:bg-white/5 rounded-md cursor-pointer group transition-all",
                  isSidebarCollapsed ? "justify-center p-2" : "gap-3 p-2",
                  activeTab === 'liked' && "bg-white/10"
                )}
                onClick={() => navigateTo('liked')}
                title={isSidebarCollapsed ? "Liked Songs" : undefined}
              >
                <div className="w-12 h-12 shrink-0 bg-gradient-to-br from-indigo-700 to-blue-300 rounded flex items-center justify-center shadow-lg">
                  <Heart className="w-6 h-6 fill-white text-white" />
                </div>
                {!isSidebarCollapsed && (
                  <div className="flex flex-col overflow-hidden">
                    <span className="font-medium truncate">Liked Songs</span>
                    <span className="text-sm text-zinc-400">Playlist • {likedTracks.length}</span>
                  </div>
                )}
              </div>
            )}

            {playlists.map(playlist => (
              <div 
                key={playlist.id} 
                className={cn(
                  "flex items-center hover:bg-white/5 rounded-md cursor-pointer group transition-all",
                  isSidebarCollapsed ? "justify-center p-2" : "gap-3 p-2",
                  activeTab === 'playlist' && selectedPlaylistId === playlist.id && "bg-white/10"
                )}
                onClick={() => navigateTo('playlist', playlist.id)}
                title={isSidebarCollapsed ? playlist.name : undefined}
              >
                <img src={playlist.image} alt="" className="w-12 h-12 shrink-0 rounded object-cover shadow-lg" />
                {!isSidebarCollapsed && (
                  <>
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-medium truncate">{playlist.name}</span>
                      <span className="text-sm text-zinc-400 truncate">Playlist • {playlist.trackIds.length}</span>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setEditingPlaylist(playlist); }}
                      className="ml-auto opacity-0 group-hover:opacity-100 p-2 hover:bg-zinc-700 rounded-full"
                    >
                      <Edit2 className="w-4 h-4 text-zinc-400" />
                    </button>
                  </>
                )}
              </div>
            ))}

            {artists.map(artist => (
              <div 
                key={artist.id} 
                className={cn(
                  "flex items-center hover:bg-white/5 rounded-md cursor-pointer group transition-all",
                  isSidebarCollapsed ? "justify-center p-2" : "gap-3 p-2",
                  activeTab === 'artist' && selectedArtistId === artist.id && "bg-white/10"
                )}
                onClick={() => navigateTo('artist', undefined, artist.id)}
                title={isSidebarCollapsed ? artist.name : undefined}
              >
                <img src={artist.image} alt="" className="w-12 h-12 shrink-0 rounded-full object-cover shadow-lg" />
                {!isSidebarCollapsed && (
                  <>
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-medium truncate">{artist.name}</span>
                      <span className="text-sm text-zinc-400">Artist</span>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setEditingArtist(artist); }}
                      className="ml-auto opacity-0 group-hover:opacity-100 p-2 hover:bg-zinc-700 rounded-full"
                    >
                      <Edit2 className="w-4 h-4 text-zinc-400" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-zinc-900 rounded-lg m-2 ml-0 flex flex-col relative overflow-y-auto scrollbar-hide">
        {/* Background Gradient */}
        <div className={cn("absolute inset-0 h-80 bg-gradient-to-b transition-colors duration-1000", currentTrack?.color || "from-zinc-800", "to-zinc-900 opacity-60")} />

        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-transparent backdrop-blur-md">
          <div className="flex items-center gap-4 flex-1">
            <div className="flex gap-2">
              <button 
                onClick={goBack}
                disabled={navIndex === 0}
                className={cn("w-8 h-8 rounded-full bg-black/40 flex items-center justify-center hover:bg-black/60 transition-colors", navIndex === 0 && "opacity-50 cursor-not-allowed")}
              >
                <SkipBack className="w-4 h-4 text-white" />
              </button>
              <button 
                onClick={goForward}
                disabled={navIndex === navHistory.length - 1}
                className={cn("w-8 h-8 rounded-full bg-black/40 flex items-center justify-center hover:bg-black/60 transition-colors", navIndex === navHistory.length - 1 && "opacity-50 cursor-not-allowed")}
              >
                <SkipForward className="w-4 h-4 text-white" />
              </button>
            </div>
            {activeTab === 'search' && (
              <div className="relative w-full max-w-md group ml-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-white transition-colors" />
                <input 
                  type="text"
                  placeholder="What do you want to listen to?"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-800 hover:bg-zinc-700/80 focus:bg-zinc-800 border border-transparent focus:border-white/20 rounded-full py-2 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-zinc-500"
                />
              </div>
            )}
          </div>
          <div className="flex gap-4 items-center">
            <button 
              onClick={() => setShowUploadModal(true)}
              className="bg-white text-black font-bold px-4 py-2 rounded-full text-sm hover:scale-105 transition-transform flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Import Music
            </button>
            <button 
              onClick={() => setShowProfileModal(true)}
              className="bg-black/40 text-white font-bold px-4 py-2 rounded-full text-sm hover:scale-105 transition-transform flex items-center gap-2"
            >
              {userProfile.avatar ? (
                <img src={userProfile.avatar} className="w-6 h-6 rounded-full object-cover" alt="" />
              ) : (
                <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-[12px] font-bold">
                  {userProfile.letter}
                </div>
              )}
              {userProfile.name}
            </button>
          </div>
        </header>

        {/* Content Rendering */}
        <div className="relative flex-1 pb-32">
          {activeTab === 'home' && (
            <div className="px-6 py-4">
              <h2 className="text-3xl font-bold mb-6">Welcome back</h2>
              {tracks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-500 bg-zinc-800/20 rounded-xl border border-dashed border-zinc-700">
                  <Music className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-xl font-bold text-white mb-2">Your library is empty</p>
                  <p className="text-sm mb-6">Import some mp3 files to start listening</p>
                  <button 
                    onClick={() => setShowUploadModal(true)}
                    className="bg-green-500 text-black font-bold px-8 py-3 rounded-full hover:scale-105 transition-transform"
                  >
                    Upload Song
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tracks.slice(0, 6).map(track => (
                    <div key={track.id} className="flex items-center gap-4 bg-white/5 hover:bg-white/10 transition-all rounded overflow-hidden group cursor-pointer" onClick={() => playTrack(track)}>
                      <img src={track.cover} alt="" className="w-16 h-16 object-cover shadow-lg" />
                      <div className="flex flex-col overflow-hidden">
                        <span className="font-bold truncate">{track.title}</span>
                        <span className="text-xs text-zinc-400 truncate">{track.artist}</span>
                      </div>
                      <div className="ml-auto mr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-xl">
                          <Play className="w-6 h-6 text-black fill-black ml-1" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {tracks.length > 0 && (
                <div className="mt-10">
                  <h2 className="text-2xl font-bold mb-4">Jump back in</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {tracks.map(track => (
                      <div key={track.id} className="p-4 bg-zinc-900/40 hover:bg-zinc-800 transition-all rounded-lg group cursor-pointer relative" onClick={() => playTrack(track)}>
                        <div className="relative mb-4">
                          <img src={track.cover} alt="" className="w-full aspect-square rounded-md shadow-lg object-cover" />
                          <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 transition-all duration-300">
                            <button className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-xl hover:scale-105">
                              <Play className="w-6 h-6 text-black fill-black ml-1" />
                            </button>
                          </div>
                        </div>
                        <span className="font-bold text-base block mb-1">{track.title}</span>
                        <span className="text-sm text-zinc-400 block">{track.artist}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEditingTrack(track); }}
                          className="absolute top-2 right-2 p-2 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {(activeTab === 'liked' || activeTab === 'search' || activeTab === 'playlist' || activeTab === 'artist') && (
            <div className="px-6 py-4">
              <div className="flex items-end gap-6 mb-8">
                {activeTab === 'liked' ? (
                  <>
                    <div className="w-48 h-48 md:w-60 md:h-60 bg-gradient-to-br from-indigo-700 to-blue-300 rounded shadow-2xl flex items-center justify-center">
                      <Heart className="w-24 h-24 fill-white text-white" />
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase">Playlist</span>
                      <h1 className="text-4xl md:text-7xl font-black tracking-tighter mt-2 mb-4">Liked Songs</h1>
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-[10px]">{userProfile.letter}</div>
                        <span>{userProfile.name}</span>
                        <span className="text-zinc-300">• {likedTracks.length} songs</span>
                      </div>
                    </div>
                  </>
                ) : activeTab === 'playlist' ? (
                  (() => {
                    const p = playlists.find(p => p.id === selectedPlaylistId);
                    return p ? (
                      <>
                        <img src={p.image} alt="" className="w-48 h-48 md:w-60 md:h-60 rounded shadow-2xl object-cover" />
                        <div>
                          <span className="text-xs font-bold uppercase">Playlist</span>
                          <h1 className="text-4xl md:text-7xl font-black tracking-tighter mt-2 mb-4">{p.name}</h1>
                          <div className="flex items-center gap-2 text-sm font-bold text-zinc-300">
                            <span>{userProfile.name} • {p.trackIds.length} songs</span>
                          </div>
                          <button 
                            onClick={() => setShowAddSongsToPlaylist(p.id)}
                            className="mt-4 bg-white text-black font-bold px-6 py-2 rounded-full hover:scale-105 transition-transform flex items-center gap-2"
                          >
                            <Plus className="w-4 h-4" /> Add Songs
                          </button>
                        </div>
                      </>
                    ) : null;
                  })()
                ) : activeTab === 'artist' ? (
                  (() => {
                    const a = artists.find(a => a.id === selectedArtistId);
                    return a ? (
                      <>
                        <img src={a.image} alt="" className="w-48 h-48 md:w-60 md:h-60 rounded-full shadow-2xl object-cover" />
                        <div>
                          <span className="text-xs font-bold uppercase">Artist</span>
                          <h1 className="text-4xl md:text-7xl font-black tracking-tighter mt-2 mb-4">{a.name}</h1>
                          <div className="flex items-center gap-2 text-sm font-bold text-zinc-300">
                            <span>Verified Artist</span>
                          </div>
                          <button 
                            onClick={() => setShowAddSongsToPlaylist(a.id)}
                            className="mt-4 bg-white text-black font-bold px-6 py-2 rounded-full hover:scale-105 transition-transform flex items-center gap-2"
                          >
                            <Plus className="w-4 h-4" /> Add Songs
                          </button>
                        </div>
                      </>
                    ) : null;
                  })()
                ) : (
                  <h1 className="text-3xl font-bold">Search</h1>
                )}
              </div>

              <div className="bg-black/20 backdrop-blur-md rounded-lg p-4">
                <div className="grid grid-cols-[16px_4fr_3fr_minmax(120px,1fr)] gap-4 px-4 py-2 border-b border-white/10 text-zinc-400 text-sm font-medium mb-4 uppercase">
                  <span>#</span>
                  <span>Title</span>
                  <span>Album</span>
                  <div className="flex justify-end"><Clock className="w-4 h-4" /></div>
                </div>

                <div className="space-y-1">
                  {(activeTab === 'search' ? filteredTracks : 
                    activeTab === 'liked' ? likedTracks : 
                    activeTab === 'playlist' ? tracks.filter(t => playlists.find(p => p.id === selectedPlaylistId)?.trackIds.includes(t.id)) :
                    activeTab === 'artist' ? tracks.filter(t => t.artist === artists.find(a => a.id === selectedArtistId)?.name) :
                    []
                  ).map((track, index) => (
                    <div key={track.id} className={cn("grid grid-cols-[16px_4fr_3fr_minmax(120px,1fr)] gap-4 px-4 py-2 rounded-md hover:bg-white/10 group cursor-pointer transition-colors items-center", currentTrack?.id === track.id && "bg-white/5")} onClick={() => playTrack(track)}>
                      <div className="flex items-center justify-center">
                        {currentTrack?.id === track.id && isPlaying ? (
                          <div className="w-4 flex items-end gap-[2px] h-3">
                            <div className="w-1 bg-green-500 animate-bounce-custom" style={{ animationDelay: '0s' }} />
                            <div className="w-1 bg-green-500 animate-bounce-custom" style={{ animationDelay: '0.2s' }} />
                            <div className="w-1 bg-green-500 animate-bounce-custom" style={{ animationDelay: '0.1s' }} />
                          </div>
                        ) : (
                          <span className={cn("text-zinc-400 group-hover:hidden", currentTrack?.id === track.id && "text-green-500")}>{index + 1}</span>
                        )}
                        <Play className={cn("w-4 h-4 text-white hidden group-hover:block", currentTrack?.id === track.id && "text-green-500")} fill="currentColor" />
                      </div>
                      <div className="flex items-center gap-3 overflow-hidden">
                        <img src={track.cover} alt="" className="w-10 h-10 rounded flex-shrink-0" />
                        <div className="flex flex-col overflow-hidden">
                          <span className={cn("font-medium truncate", currentTrack?.id === track.id ? "text-green-500" : "text-white")}>{track.title}</span>
                          <span className="text-xs text-zinc-400 truncate group-hover:text-white">{track.artist}</span>
                        </div>
                      </div>
                      <span className="text-sm text-zinc-400 truncate">{track.album}</span>
                      <div className="flex items-center justify-end gap-4">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowPlaylistSelector(track.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-white"
                        >
                          <PlusSquare className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => toggleLike(track.id, e)}>
                          <Heart className={cn("w-4 h-4 transition-colors", track.isLiked ? "text-red-600 fill-red-600" : "text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-white")} />
                        </button>
                        <span className="text-sm text-zinc-400 w-10 text-right">{track.duration}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEditingTrack(track); }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-white"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Right Sidebar - Now Playing View */}
      <AnimatePresence>
        {isRightSidebarVisible && (
          <motion.aside 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="bg-black flex flex-col gap-2 p-2 hidden lg:flex h-full overflow-hidden border-l border-zinc-800"
          >
            <div className="bg-zinc-900 rounded-lg p-4 flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-base hover:underline cursor-pointer">Now Playing</h2>
                <button 
                  onClick={() => setIsRightSidebarVisible(false)}
                  className="p-1 hover:bg-zinc-800 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400 hover:text-white" />
                </button>
              </div>

              {currentTrackSync ? (
                <div className="flex flex-col gap-4">
                  <motion.div 
                    layoutId="right-sidebar-cover"
                    className="relative group"
                  >
                    <img 
                      src={currentTrackSync.cover} 
                      alt="" 
                      className="w-full aspect-square rounded-lg object-cover shadow-2xl" 
                    />
                  </motion.div>
                  
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col overflow-hidden">
                      <h3 className="text-2xl font-bold truncate hover:underline cursor-pointer leading-tight">
                        {currentTrackSync.title}
                      </h3>
                      <p className="text-zinc-400 hover:text-white hover:underline cursor-pointer truncate">
                        {currentTrackSync.artist}
                      </p>
                    </div>
                    <button 
                      onClick={() => setShowPlaylistSelector(currentTrackSync.id)}
                      className="text-zinc-400 hover:text-white mt-1"
                    >
                      <PlusSquare className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-4">
                  <Music className="w-16 h-16 opacity-20" />
                  <p className="text-center">Select a song to see more details</p>
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Now Playing Bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-black h-20 md:h-24 px-4 flex items-center justify-between z-50 border-t border-zinc-800">
        <div className="flex items-center gap-4 w-[30%]">
          {currentTrackSync ? (
            <>
              <img src={currentTrackSync.cover} alt="" className="w-14 h-14 rounded shadow-lg object-cover" />
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium hover:underline cursor-pointer truncate">{currentTrackSync.title}</span>
                <span className="text-xs text-zinc-400 hover:underline cursor-pointer truncate">{currentTrackSync.artist}</span>
              </div>
              <button onClick={() => toggleLike(currentTrackSync.id)}>
                <Heart className={cn("w-4 h-4 cursor-pointer ml-2 flex-shrink-0", currentTrackSync.isLiked ? "text-red-600 fill-red-600" : "text-zinc-400 hover:text-white")} />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-zinc-800 rounded" />
              <div className="flex flex-col gap-2">
                <div className="w-24 h-3 bg-zinc-800 rounded" />
                <div className="w-16 h-2 bg-zinc-800 rounded" />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 max-w-[40%] w-full">
          <div className="flex items-center gap-4 md:gap-6">
            <Shuffle 
              onClick={() => setIsShuffle(!isShuffle)}
              className={cn("w-4 h-4 cursor-pointer transition-colors", isShuffle ? "text-green-500" : "text-zinc-400 hover:text-white")} 
            />
            <SkipBack onClick={prevTrack} className="w-5 h-5 text-zinc-400 hover:text-white cursor-pointer fill-zinc-400 hover:fill-white" />
            <button onClick={togglePlay} className="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform">
              {isPlaying ? <Pause className="w-5 h-5 text-black fill-black" /> : <Play className="w-5 h-5 text-black fill-black ml-0.5" />}
            </button>
            <SkipForward onClick={nextTrack} className="w-5 h-5 text-zinc-400 hover:text-white cursor-pointer fill-zinc-400 hover:fill-white" />
            <Repeat 
              onClick={() => setIsRepeat(!isRepeat)}
              className={cn("w-4 h-4 cursor-pointer transition-colors", isRepeat ? "text-green-500" : "text-zinc-400 hover:text-white")} 
            />
          </div>
          
          <div className="flex items-center gap-2 w-full">
            <span className="text-[10px] text-zinc-400 w-10 text-right">{currentTime}</span>
            <div className="relative flex-1 group h-1 bg-zinc-600 rounded-full overflow-hidden cursor-pointer">
              <input type="range" min="0" max="100" value={progress} onChange={handleSeek} className="absolute inset-0 w-full opacity-0 cursor-pointer z-10" />
              <div className="absolute top-0 left-0 h-full bg-white group-hover:bg-green-500 rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[10px] text-zinc-400 w-10">{currentTrack?.duration || "0:00"}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 w-[30%]">
          {currentTrackSync && (
            <>
              <button 
                onClick={() => setShowLyricsOverlay(!showLyricsOverlay)}
                className={cn("p-1 transition-colors", showLyricsOverlay ? "text-green-500" : "text-zinc-400 hover:text-white")}
              >
                <Mic2 className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setShowPlaylistSelector(currentTrackSync.id)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <PlusSquare className="w-5 h-5" />
              </button>
            </>
          )}
          <button 
            onClick={() => setIsRightSidebarVisible(!isRightSidebarVisible)}
            className={cn(
              "p-1 transition-colors hidden lg:block",
              isRightSidebarVisible ? "text-green-500" : "text-zinc-400 hover:text-white"
            )}
            title="Now Playing View"
          >
            <Layout className="w-5 h-5" />
          </button>
          <button onClick={toggleMute}>
            {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-zinc-400 hover:text-white" /> : volume < 0.5 ? <Volume1 className="w-5 h-5 text-zinc-400 hover:text-white" /> : <Volume2 className="w-5 h-5 text-zinc-400 hover:text-white" />}
          </button>
          <div className="w-24 group h-1 bg-zinc-600 rounded-full relative overflow-hidden hidden md:block">
            <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="absolute inset-0 w-full opacity-0 cursor-pointer z-10" />
            <div className="absolute top-0 left-0 h-full bg-white group-hover:bg-green-500" style={{ width: `${volume * 100}%` }} />
          </div>
        </div>
      </footer>

      {/* Lyrics Overlay */}
      <AnimatePresence>
        {showLyricsOverlay && currentTrackSync && (
          <motion.div 
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            className="fixed inset-0 z-[60] bg-black/98 flex flex-col items-center p-8 overflow-y-auto"
          >
            <div className="w-full max-w-4xl min-h-full flex flex-col py-24">
              <button 
                onClick={() => setShowLyricsOverlay(false)}
                className="fixed top-8 right-8 p-3 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors z-[70] shadow-xl"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="w-full flex flex-col md:flex-row gap-12 items-center mb-16">
                <img 
                  src={currentTrackSync.cover} 
                  alt="" 
                  className="w-64 h-64 md:w-80 md:h-80 rounded-2xl shadow-2xl object-cover shrink-0" 
                />
                <div className="flex-1 text-center md:text-left space-y-4 overflow-hidden">
                  <h2 className="text-5xl md:text-7xl font-black text-white leading-tight">{currentTrackSync.title}</h2>
                  <p className="text-2xl text-zinc-400">{currentTrackSync.artist}</p>
                </div>
              </div>

              <div className="w-full text-center md:text-left pb-32">
                <pre className="text-3xl md:text-5xl font-black leading-[1.4] whitespace-pre-wrap font-sans text-white/90 selection:bg-white selection:text-black">
                  {currentTrackSync.lyrics || "No lyrics available for this song."}
                </pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-zinc-900 w-full max-w-md p-8 rounded-2xl shadow-2xl border border-zinc-800">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Import Music</h2>
                <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-zinc-800 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-700 rounded-xl p-10 flex flex-col items-center justify-center gap-4 hover:border-green-500 hover:bg-green-500/5 transition-all cursor-pointer group"
              >
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center group-hover:bg-green-500/10">
                  <Upload className="w-8 h-8 text-zinc-400 group-hover:text-green-500" />
                </div>
                <div className="text-center">
                  <p className="font-bold">Choose an mp3 file</p>
                  <p className="text-sm text-zinc-500 mt-1">or drag and drop it here</p>
                </div>
                <input ref={fileInputRef} type="file" accept="audio/mpeg" className="hidden" onChange={handleFileUpload} />
              </div>
            </motion.div>
          </div>
        )}

        {editingPlaylist && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-zinc-900 w-full max-w-md p-8 rounded-2xl shadow-2xl border border-zinc-800">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Edit Playlist</h2>
                <button onClick={() => setEditingPlaylist(null)} className="p-2 hover:bg-zinc-800 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              <div className="space-y-6">
                <div className="relative group mx-auto w-48">
                  <img src={editingPlaylist.image} alt="" className="w-48 h-48 rounded-lg object-cover shadow-2xl" />
                  <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-lg">
                    <Upload className="w-8 h-8 mb-2" />
                    <span className="text-xs font-bold">Change Image</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setEditingPlaylist({ ...editingPlaylist, image: URL.createObjectURL(file) });
                    }} />
                  </label>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase text-zinc-500">Playlist Name</label>
                  <input type="text" value={editingPlaylist.name} onChange={(e) => setEditingPlaylist({...editingPlaylist, name: e.target.value})} className="bg-zinc-800 border-none rounded p-3 text-sm focus:ring-2 ring-green-500 outline-none" />
                </div>
                <div className="flex gap-4 mt-8">
                  <button onClick={async () => {
                    await del(`playlist_${editingPlaylist.id}`);
                    setPlaylists(prev => prev.filter(p => p.id !== editingPlaylist.id));
                    setEditingPlaylist(null);
                  }} className="text-red-500 font-bold">Delete</button>
                  <button onClick={async () => {
                    const blob = editingPlaylist.image.startsWith('blob:') ? await fetch(editingPlaylist.image).then(r => r.blob()) : undefined;
                    savePlaylistEdits(editingPlaylist, blob);
                  }} className="flex-1 py-3 bg-green-500 text-black font-bold rounded-full hover:scale-105 transition-transform">Save</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {editingArtist && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-zinc-900 w-full max-w-md p-8 rounded-2xl shadow-2xl border border-zinc-800">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Edit Artist</h2>
                <button onClick={() => setEditingArtist(null)} className="p-2 hover:bg-zinc-800 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              <div className="space-y-6">
                <div className="relative group mx-auto w-48">
                  <img src={editingArtist.image} alt="" className="w-48 h-48 rounded-full object-cover shadow-2xl" />
                  <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full">
                    <Upload className="w-8 h-8 mb-2" />
                    <span className="text-xs font-bold">Change Image</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setEditingArtist({ ...editingArtist, image: URL.createObjectURL(file) });
                    }} />
                  </label>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase text-zinc-500">Artist Name</label>
                  <input type="text" value={editingArtist.name} onChange={(e) => setEditingArtist({...editingArtist, name: e.target.value})} className="bg-zinc-800 border-none rounded p-3 text-sm focus:ring-2 ring-green-500 outline-none" />
                </div>
                <div className="flex gap-4 mt-8">
                  <button onClick={async () => {
                    await del(`artist_${editingArtist.id}`);
                    setArtists(prev => prev.filter(a => a.id !== editingArtist.id));
                    setEditingArtist(null);
                  }} className="text-red-500 font-bold">Delete</button>
                  <button onClick={async () => {
                    const blob = editingArtist.image.startsWith('blob:') ? await fetch(editingArtist.image).then(r => r.blob()) : undefined;
                    saveArtistEdits(editingArtist, blob);
                  }} className="flex-1 py-3 bg-green-500 text-black font-bold rounded-full hover:scale-105 transition-transform">Save</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {editingTrack && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-zinc-900 w-full max-w-2xl p-8 rounded-2xl shadow-2xl border border-zinc-800 overflow-y-auto max-h-[90vh]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Edit Details</h2>
                <button onClick={() => setEditingTrack(null)} className="p-2 hover:bg-zinc-800 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="relative group">
                    <img src={editingTrack.cover} alt="" className="w-full aspect-square rounded-lg object-cover shadow-2xl" />
                    <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-lg">
                      <Upload className="w-10 h-10 mb-2" />
                      <span className="text-sm font-bold">Change Image</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setEditingTrack({ ...editingTrack, cover: URL.createObjectURL(file), coverBlob: file });
                      }} />
                    </label>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase text-zinc-500">Track Name</label>
                    <input type="text" value={editingTrack.title} onChange={(e) => setEditingTrack({...editingTrack, title: e.target.value})} className="bg-zinc-800 border-none rounded p-3 text-sm focus:ring-2 ring-green-500 outline-none" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase text-zinc-500">Artist(s)</label>
                      <button 
                        onClick={() => {
                          const current = editingTrack.artist ? editingTrack.artist + ", " : "";
                          setEditingTrack({...editingTrack, artist: current + "New Artist"});
                        }}
                        className="text-[10px] font-bold text-green-500 hover:underline"
                      >
                        + Add Artist
                      </button>
                    </div>
                    <input 
                      type="text" 
                      value={editingTrack.artist} 
                      placeholder="Artist 1, Artist 2..."
                      onChange={(e) => setEditingTrack({...editingTrack, artist: e.target.value})} 
                      className="bg-zinc-800 border-none rounded p-3 text-sm focus:ring-2 ring-green-500 outline-none" 
                    />
                    <p className="text-[10px] text-zinc-500">Separate multiple artists with commas</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase text-zinc-500">Album Name (Optional)</label>
                    <input type="text" value={editingTrack.album} onChange={(e) => setEditingTrack({...editingTrack, album: e.target.value})} className="bg-zinc-800 border-none rounded p-3 text-sm focus:ring-2 ring-green-500 outline-none" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase text-zinc-500">Lyrics (Optional)</label>
                    <textarea value={editingTrack.lyrics || ''} onChange={(e) => setEditingTrack({...editingTrack, lyrics: e.target.value})} className="bg-zinc-800 border-none rounded p-3 text-sm h-32 resize-none focus:ring-2 ring-green-500 outline-none" placeholder="Paste lyrics here..." />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-8">
                <button 
                  onClick={async () => {
                    await del(`audio_${editingTrack.id}`);
                    await del(`cover_${editingTrack.id}`);
                    setTracks(prev => prev.filter(t => t.id !== editingTrack.id));
                    if (currentTrack?.id === editingTrack.id) setCurrentTrack(null);
                    setEditingTrack(null);
                  }}
                  className="text-red-500 hover:text-red-400 font-bold flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Track
                </button>
                <div className="flex gap-4">
                  <button onClick={() => setEditingTrack(null)} className="px-6 py-3 font-bold hover:scale-105 transition-transform">Cancel</button>
                  <button onClick={() => saveTrackEdits(editingTrack)} className="px-10 py-3 bg-green-500 text-black font-bold rounded-full hover:scale-105 transition-transform shadow-xl">Save Changes</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-zinc-900 w-full max-w-sm p-8 rounded-2xl shadow-2xl border border-zinc-800">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Create New</h2>
                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-zinc-800 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => createPlaylist('playlist')}
                  className="flex flex-col items-center gap-4 p-6 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl transition-colors group"
                >
                  <div className="w-16 h-16 bg-zinc-700 rounded-lg flex items-center justify-center group-hover:bg-green-500/20">
                    <ListMusic className="w-8 h-8 text-zinc-400 group-hover:text-green-500" />
                  </div>
                  <span className="font-bold">Playlist</span>
                </button>
                <button 
                  onClick={() => createPlaylist('artist')}
                  className="flex flex-col items-center gap-4 p-6 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl transition-colors group"
                >
                  <div className="w-16 h-16 bg-zinc-700 rounded-full flex items-center justify-center group-hover:bg-green-500/20">
                    <User className="w-8 h-8 text-zinc-400 group-hover:text-green-500" />
                  </div>
                  <span className="font-bold">Artist</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showPlaylistSelector && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowPlaylistSelector(null)}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-zinc-900 w-full max-w-sm p-6 rounded-2xl shadow-2xl border border-zinc-800" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-bold mb-4">Add to...</h2>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-2 scrollbar-hide">
                <p className="text-xs font-bold text-zinc-500 uppercase px-2 mb-2">Playlists</p>
                {playlists.map(p => (
                  <button key={p.id} onClick={() => addTrackToPlaylist(showPlaylistSelector!, p.id)} className="w-full flex items-center gap-3 p-2 hover:bg-zinc-800 rounded-md transition-colors text-left">
                    <img src={p.image} className="w-10 h-10 rounded object-cover" />
                    <span className="font-bold">{p.name}</span>
                  </button>
                ))}
                {playlists.length === 0 && <p className="text-sm text-zinc-500 px-2 italic">No playlists created</p>}
                
                <p className="text-xs font-bold text-zinc-500 uppercase px-2 mb-2 mt-4">Artists</p>
                {artists.map(a => (
                  <button key={a.id} onClick={() => addTrackToArtist(showPlaylistSelector!, a.id)} className="w-full flex items-center gap-3 p-2 hover:bg-zinc-800 rounded-md transition-colors text-left">
                    <img src={a.image} className="w-10 h-10 rounded-full object-cover" />
                    <span className="font-bold">{a.name}</span>
                  </button>
                ))}
                {artists.length === 0 && <p className="text-sm text-zinc-500 px-2 italic">No artists created</p>}
              </div>
            </motion.div>
          </div>
        )}

        {showAddSongsToPlaylist && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-zinc-900 w-full max-w-lg p-8 rounded-2xl shadow-2xl border border-zinc-800 max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Add Songs</h2>
                <button onClick={() => setShowAddSongsToPlaylist(null)} className="p-2 hover:bg-zinc-800 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                {tracks.map(track => {
                  const isPlaylist = playlists.some(p => p.id === showAddSongsToPlaylist);
                  const collection = isPlaylist ? playlists.find(p => p.id === showAddSongsToPlaylist) : artists.find(a => a.id === showAddSongsToPlaylist);
                  const isAdded = collection?.trackIds.includes(track.id);

                  return (
                    <div key={track.id} className="flex items-center gap-4 p-2 rounded-lg hover:bg-white/5 transition-colors">
                      <img src={track.cover} className="w-12 h-12 rounded object-cover" />
                      <div className="flex-1 overflow-hidden">
                        <p className="font-bold truncate">{track.title}</p>
                        <p className="text-xs text-zinc-500 truncate">{track.artist}</p>
                      </div>
                      <button 
                        onClick={() => {
                          if (isPlaylist) {
                            addTrackToPlaylist(track.id, showAddSongsToPlaylist!);
                          } else {
                            addTrackToArtist(track.id, showAddSongsToPlaylist!);
                          }
                        }}
                        className={cn("px-4 py-1.5 rounded-full text-sm font-bold transition-all", isAdded ? "bg-zinc-800 text-zinc-500" : "bg-white text-black hover:scale-105")}
                      >
                        {isAdded ? "Added" : "Add"}
                      </button>
                    </div>
                  );
                })}
                {tracks.length === 0 && <p className="text-center text-zinc-500 py-10">No songs in library. Import some first!</p>}
              </div>
            </motion.div>
          </div>
        )}

        {showProfileModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="bg-zinc-900 w-full max-w-md p-8 rounded-2xl shadow-2xl border border-zinc-800"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Edit Profile</h2>
                <button onClick={() => setShowProfileModal(false)} className="p-2 hover:bg-zinc-800 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="space-y-6">
                <div className="relative group mx-auto w-32">
                  {userProfile.avatar ? (
                    <img src={userProfile.avatar} alt="" className="w-32 h-32 rounded-full object-cover shadow-2xl" />
                  ) : (
                    <div className="w-32 h-32 bg-orange-500 rounded-full flex items-center justify-center text-5xl font-bold shadow-2xl">
                      {userProfile.letter}
                    </div>
                  )}
                  <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full">
                    <Upload className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-bold">Change Image</span>
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await set('user_avatar', file);
                        setUserProfile({ ...userProfile, avatar: URL.createObjectURL(file) });
                      }
                    }} />
                  </label>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase text-zinc-500">Username</label>
                  <input 
                    type="text" 
                    value={userProfile.name} 
                    onChange={(e) => setUserProfile({...userProfile, name: e.target.value})} 
                    className="bg-zinc-800 border-none rounded p-3 text-sm focus:ring-2 ring-green-500 outline-none" 
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase text-zinc-500">Avatar Letter (if no image)</label>
                  <input 
                    type="text" 
                    maxLength={1}
                    value={userProfile.letter} 
                    onChange={(e) => setUserProfile({...userProfile, letter: e.target.value.toUpperCase()})} 
                    className="bg-zinc-800 border-none rounded p-3 text-sm focus:ring-2 ring-green-500 outline-none text-center font-bold" 
                  />
                </div>

                <button 
                  onClick={() => setShowProfileModal(false)} 
                  className="w-full py-3 bg-green-500 text-black font-bold rounded-full hover:scale-105 transition-transform mt-4"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
