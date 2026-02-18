// ============================================================================
// SPOTIFY INTEGRATION
// ============================================================================

class SpotifyManager {
    constructor() {
        this.accessToken = null;
        this.player = null;
        this.deviceId = null;
        this.isAuthenticated = false;
        this.currentSearchPlayerId = null;
        this.inningsPlaylist = [];
        this.inningsCurrentIndex = 0;
        this.isInningsPlaying = false;
    }

    // ========================================================================
    // AUTHENTICATION
    // ========================================================================

    async initialize() {
        // Check if we're returning from Spotify auth
        const token = this.getTokenFromUrl();
        if (token) {
            this.accessToken = token;
            sessionStorage.setItem('spotify_access_token', token);
            window.history.replaceState({}, document.title, window.location.pathname);
            await this.setupPlayer();
        } else {
            // Check for existing token
            const savedToken = sessionStorage.getItem('spotify_access_token');
            if (savedToken) {
                this.accessToken = savedToken;
                await this.setupPlayer();
            }
        }

        this.updateAuthButton();
        this.loadInningsPlaylist();
    }

    getTokenFromUrl() {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        return params.get('access_token');
    }

    authorize() {
        const authUrl = 'https://accounts.spotify.com/authorize';
        const params = new URLSearchParams({
            client_id: SPOTIFY_CONFIG.CLIENT_ID,
            response_type: 'token',
            redirect_uri: SPOTIFY_CONFIG.REDIRECT_URI,
            scope: SPOTIFY_CONFIG.SCOPES.join(' '),
            show_dialog: 'false'
        });

        window.location.href = `${authUrl}?${params.toString()}`;
    }

    disconnect() {
        this.accessToken = null;
        this.isAuthenticated = false;
        sessionStorage.removeItem('spotify_access_token');
        
        if (this.player) {
            this.player.disconnect();
            this.player = null;
        }

        this.updateAuthButton();
        alert('Disconnected from Spotify');
    }

    updateAuthButton() {
        const btn = document.getElementById('spotify-auth-btn');
        const statusText = document.getElementById('spotify-status-text');
        const statusIcon = document.getElementById('spotify-status-icon');

        if (this.isAuthenticated) {
            btn.classList.add('connected');
            btn.classList.remove('disconnected');
            statusText.textContent = 'Spotify Connected';
            statusIcon.textContent = '✓';
            btn.onclick = () => this.disconnect();
        } else {
            btn.classList.remove('connected');
            btn.classList.add('disconnected');
            statusText.textContent = 'Connect Spotify';
            statusIcon.textContent = '🎵';
            btn.onclick = () => this.authorize();
        }
    }

    // ========================================================================
    // SPOTIFY WEB PLAYBACK SDK
    // ========================================================================

    async setupPlayer() {
        if (!this.accessToken) return;

        // Wait for Spotify SDK to load
        await this.waitForSpotifySDK();

        this.player = new Spotify.Player({
            name: 'Baseball Soundboard',
            getOAuthToken: cb => { cb(this.accessToken); },
            volume: AppState.audio.volume
        });

        // Error handling
        this.player.addListener('initialization_error', ({ message }) => {
            console.error('Failed to initialize:', message);
        });

        this.player.addListener('authentication_error', ({ message }) => {
            console.error('Failed to authenticate:', message);
            this.disconnect();
        });

        this.player.addListener('account_error', ({ message }) => {
            console.error('Account error:', message);
            alert('Spotify Premium is required for playback');
        });

        this.player.addListener('playback_error', ({ message }) => {
            console.error('Playback error:', message);
        });

        // Ready
        this.player.addListener('ready', ({ device_id }) => {
            console.log('Spotify player ready with device ID:', device_id);
            this.deviceId = device_id;
            this.isAuthenticated = true;
            this.updateAuthButton();
        });

        // Not Ready
        this.player.addListener('not_ready', ({ device_id }) => {
            console.log('Device ID has gone offline:', device_id);
        });

        // Player state changes
        this.player.addListener('player_state_changed', state => {
            if (!state) return;
            
            // Track ended
            if (state.paused && state.position === 0 && state.duration > 0) {
                this.handleTrackEnd();
            }
        });

        // Connect to the player
        const connected = await this.player.connect();
        
        if (!connected) {
            console.error('Failed to connect to Spotify player');
            this.disconnect();
        }
    }

    waitForSpotifySDK() {
        return new Promise(resolve => {
            if (window.Spotify) {
                resolve();
            } else {
                window.onSpotifyWebPlaybackSDKReady = () => {
                    resolve();
                };
            }
        });
    }

    handleTrackEnd() {
        // If playing innings playlist, move to next track
        if (this.isInningsPlaying) {
            this.playNextInningsTrack();
        } else {
            // Regular player track ended
            if (AppState.audio.currentBtn) {
                UIManager.clearElementState(AppState.audio.currentBtn);
                AppState.audio.currentBtn.removeAttribute('data-active');
                AppState.audio.currentBtn = null;
            }
            document.body.classList.remove('audio-active');
            UIManager.updateHighlighting();
        }
    }

    // ========================================================================
    // PLAYBACK CONTROL
    // ========================================================================

    async play(trackUri) {
        if (!this.isAuthenticated || !this.deviceId) {
            alert('Please connect to Spotify first');
            return false;
        }

        try {
            const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.accessToken}`
                },
                body: JSON.stringify({
                    uris: [trackUri]
                })
            });

            if (response.status === 204 || response.status === 200) {
                return true;
            } else if (response.status === 401) {
                this.disconnect();
                alert('Spotify session expired. Please reconnect.');
                return false;
            } else {
                console.error('Playback failed:', response.status);
                return false;
            }
        } catch (error) {
            console.error('Error playing track:', error);
            return false;
        }
    }

    async pause() {
        if (!this.player) return;
        
        try {
            await this.player.pause();
        } catch (error) {
            console.error('Error pausing:', error);
        }
    }

    async setVolume(volume) {
        if (!this.player) return;
        
        try {
            await this.player.setVolume(volume);
        } catch (error) {
            console.error('Error setting volume:', error);
        }
    }

    // ========================================================================
    // TRACK SEARCH
    // ========================================================================

    async searchTracks(query) {
        if (!this.accessToken) {
            alert('Please connect to Spotify first');
            return [];
        }

        try {
            const params = new URLSearchParams({
                q: query,
                type: 'track',
                limit: 20
            });

            const response = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.tracks.items;
            } else if (response.status === 401) {
                this.disconnect();
                alert('Spotify session expired. Please reconnect.');
                return [];
            }
        } catch (error) {
            console.error('Error searching tracks:', error);
            return [];
        }
    }

    showSearchModal(playerId) {
        this.currentSearchPlayerId = playerId;
        document.getElementById('spotify-search-modal').classList.remove('hidden');
        document.getElementById('spotify-search-input').value = '';
        document.getElementById('spotify-results').innerHTML = '';
        document.getElementById('spotify-search-input').focus();
    }

    hideSearchModal() {
        document.getElementById('spotify-search-modal').classList.add('hidden');
        this.currentSearchPlayerId = null;
    }

    async performSearch() {
        const query = document.getElementById('spotify-search-input').value.trim();
        if (!query) return;

        const results = await this.searchTracks(query);
        this.displaySearchResults(results);
    }

    displaySearchResults(tracks) {
        const container = document.getElementById('spotify-results');
        container.innerHTML = '';

        if (tracks.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#999;">No results found</p>';
            return;
        }

        tracks.forEach(track => {
            const item = document.createElement('div');
            item.className = 'spotify-track-item';
            
            const albumArt = track.album.images[2]?.url || track.album.images[0]?.url || '';
            const artists = track.artists.map(a => a.name).join(', ');
            
            item.innerHTML = `
                ${albumArt ? `<img src="${albumArt}" class="spotify-track-album-art" alt="Album art">` : ''}
                <div class="spotify-track-info">
                    <div class="spotify-track-name">${this.escapeHtml(track.name)}</div>
                    <div class="spotify-track-artist">${this.escapeHtml(artists)}</div>
                </div>
            `;

            item.onclick = () => this.selectTrack(track);
            container.appendChild(item);
        });
    }

    async selectTrack(track) {
        if (this.currentSearchPlayerId) {
            // Assigning track to a player
            try {
                const player = await Database.getPlayer(this.currentSearchPlayerId);
                if (!player) return;

                player.spotifyTrack = {
                    uri: track.uri,
                    name: track.name,
                    artist: track.artists.map(a => a.name).join(', '),
                    albumArt: track.album.images[2]?.url || track.album.images[0]?.url || '',
                    duration: track.duration_ms
                };

                player.audioSource = 'spotify';
                await Database.updatePlayer(player);
                await UIManager.renderRoster();
                
                this.hideSearchModal();
                alert(`Assigned "${track.name}" to player`);
            } catch (error) {
                console.error('Error assigning track:', error);
                alert('Failed to assign track');
            }
        } else {
            // Adding to innings playlist
            this.addToInningsPlaylist(track);
            this.hideSearchModal();
        }
    }

    // ========================================================================
    // INNINGS PLAYLIST
    // ========================================================================

    showInningsModal() {
        document.getElementById('innings-modal').classList.remove('hidden');
        this.renderInningsPlaylist();
    }

    hideInningsModal() {
        document.getElementById('innings-modal').classList.add('hidden');
    }

    addToInningsPlaylist(track) {
        const playlistTrack = {
            uri: track.uri,
            name: track.name,
            artist: track.artists.map(a => a.name).join(', '),
            albumArt: track.album.images[2]?.url || track.album.images[0]?.url || '',
            id: Date.now() + Math.random()
        };

        this.inningsPlaylist.push(playlistTrack);
        this.saveInningsPlaylist();
        this.renderInningsPlaylist();
    }

    removeFromInningsPlaylist(trackId) {
        this.inningsPlaylist = this.inningsPlaylist.filter(t => t.id !== trackId);
        this.saveInningsPlaylist();
        this.renderInningsPlaylist();
    }

    renderInningsPlaylist() {
        const container = document.getElementById('innings-playlist');
        container.innerHTML = '';

        if (this.inningsPlaylist.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#999;">No tracks in playlist. Click "Add Track" to search Spotify.</p>';
            return;
        }

        this.inningsPlaylist.forEach((track, index) => {
            const item = document.createElement('div');
            item.className = 'innings-track-item';
            if (this.isInningsPlaying && index === this.inningsCurrentIndex) {
                item.classList.add('playing');
            }

            item.innerHTML = `
                ${track.albumArt ? `<img src="${track.albumArt}" class="spotify-track-album-art" alt="Album art">` : ''}
                <div class="spotify-track-info">
                    <div class="spotify-track-name">${this.escapeHtml(track.name)}</div>
                    <div class="spotify-track-artist">${this.escapeHtml(track.artist)}</div>
                </div>
                <button class="innings-track-remove" data-action="remove-innings-track" data-track-id="${track.id}">Remove</button>
            `;

            container.appendChild(item);
        });
    }

    async playInningsPlaylist() {
        if (this.inningsPlaylist.length === 0) {
            alert('Playlist is empty. Add some tracks first!');
            return;
        }

        if (!this.isAuthenticated) {
            alert('Please connect to Spotify first');
            return;
        }

        this.isInningsPlaying = true;
        this.inningsCurrentIndex = 0;
        await this.playInningsTrack(0);
        this.renderInningsPlaylist();
    }

    async playInningsTrack(index) {
        if (index >= this.inningsPlaylist.length) {
            this.stopInningsPlaylist();
            return;
        }

        const track = this.inningsPlaylist[index];
        this.inningsCurrentIndex = index;
        
        const success = await this.play(track.uri);
        if (success) {
            this.renderInningsPlaylist();
        } else {
            this.stopInningsPlaylist();
        }
    }

    async playNextInningsTrack() {
        const nextIndex = this.inningsCurrentIndex + 1;
        if (nextIndex >= this.inningsPlaylist.length) {
            // Loop back to start
            await this.playInningsTrack(0);
        } else {
            await this.playInningsTrack(nextIndex);
        }
    }

    stopInningsPlaylist() {
        this.isInningsPlaying = false;
        this.inningsCurrentIndex = 0;
        this.pause();
        this.renderInningsPlaylist();
    }

    saveInningsPlaylist() {
        try {
            const data = JSON.stringify(this.inningsPlaylist);
            localStorage.setItem(`innings_playlist_${AppState.currentTeamId}`, data);
        } catch (error) {
            console.error('Error saving innings playlist:', error);
        }
    }

    loadInningsPlaylist() {
        try {
            const data = localStorage.getItem(`innings_playlist_${AppState.currentTeamId}`);
            if (data) {
                this.inningsPlaylist = JSON.parse(data);
            } else {
                this.inningsPlaylist = [];
            }
        } catch (error) {
            console.error('Error loading innings playlist:', error);
            this.inningsPlaylist = [];
        }
    }

    // ========================================================================
    // UTILITIES
    // ========================================================================

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create global instance
const spotifyManager = new SpotifyManager();
