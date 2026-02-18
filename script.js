// ============================================================================
// CONSTANTS & ENUMS
// ============================================================================

const DB_NAME = "BaseballSoundboardDB";
const DB_VERSION = 4;
const STORE_NAMES = {
    TEAMS: "teams",
    PLAYERS: "players",
    LINEUP: "lineup",
    APP_STATE: "appState"
};

const PLAYER_STATE = {
    IDLE: "idle",
    ON_DECK: "on-deck",
    PLAYING: "playing",
    STOPPING: "stopping"
};

const LAST_PLAYED = {
    NONE: -1,
    RESET: -2
};

// ============================================================================
// APPLICATION STATE
// ============================================================================

const AppState = {
    db: null,
    currentTeamId: null,
    audio: {
        current: null,
        currentBtn: null,
        fadeInterval: null,
        volume: 0.8
    },
    ui: {
        isLocked: true,
        lastPlayedIndex: LAST_PLAYED.RESET
    },
    playerTracks: new Map() // playerId -> blob URL
};

// ============================================================================
// DATABASE LAYER
// ============================================================================

class Database {
    static async initialize() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                AppState.db = request.result;
                resolve(request.result);
            };
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                
                // Create teams store
                if (!db.objectStoreNames.contains(STORE_NAMES.TEAMS)) {
                    db.createObjectStore(STORE_NAMES.TEAMS, { 
                        keyPath: "id", 
                        autoIncrement: true 
                    });
                }
                
                // Create players store with teamId index
                if (!db.objectStoreNames.contains(STORE_NAMES.PLAYERS)) {
                    const playerStore = db.createObjectStore(STORE_NAMES.PLAYERS, { 
                        keyPath: "id", 
                        autoIncrement: true 
                    });
                    playerStore.createIndex("teamId", "teamId", { unique: false });
                }
                
                // Create lineup store with teamId index
                if (!db.objectStoreNames.contains(STORE_NAMES.LINEUP)) {
                    db.createObjectStore(STORE_NAMES.LINEUP, { 
                        keyPath: "teamId" 
                    });
                }
                
                // Create app state store
                if (!db.objectStoreNames.contains(STORE_NAMES.APP_STATE)) {
                    db.createObjectStore(STORE_NAMES.APP_STATE, { keyPath: "key" });
                }
            };
        });
    }
    
    // TEAM OPERATIONS
    static async getAllTeams() {
        return new Promise((resolve, reject) => {
            const transaction = AppState.db.transaction([STORE_NAMES.TEAMS], "readonly");
            const store = transaction.objectStore(STORE_NAMES.TEAMS);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    static async getTeam(id) {
        return new Promise((resolve, reject) => {
            const transaction = AppState.db.transaction([STORE_NAMES.TEAMS], "readonly");
            const store = transaction.objectStore(STORE_NAMES.TEAMS);
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    static async addTeam(team) {
        return new Promise((resolve, reject) => {
            const transaction = AppState.db.transaction([STORE_NAMES.TEAMS], "readwrite");
            const store = transaction.objectStore(STORE_NAMES.TEAMS);
            const request = store.add(team);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    static async updateTeam(team) {
        return new Promise((resolve, reject) => {
            const transaction = AppState.db.transaction([STORE_NAMES.TEAMS], "readwrite");
            const store = transaction.objectStore(STORE_NAMES.TEAMS);
            const request = store.put(team);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    static async deleteTeam(id) {
        return new Promise((resolve, reject) => {
            const transaction = AppState.db.transaction([STORE_NAMES.TEAMS], "readwrite");
            const store = transaction.objectStore(STORE_NAMES.TEAMS);
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    
    // PLAYER OPERATIONS
    static async getAllPlayers(teamId = null) {
        return new Promise((resolve, reject) => {
            const transaction = AppState.db.transaction([STORE_NAMES.PLAYERS], "readonly");
            const store = transaction.objectStore(STORE_NAMES.PLAYERS);
            
            if (teamId === null) {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } else {
                const index = store.index("teamId");
                const request = index.getAll(teamId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            }
        });
    }
    
    static async getPlayer(id) {
        return new Promise((resolve, reject) => {
            const transaction = AppState.db.transaction([STORE_NAMES.PLAYERS], "readonly");
            const store = transaction.objectStore(STORE_NAMES.PLAYERS);
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    static async addPlayer(player) {
        return new Promise((resolve, reject) => {
            const transaction = AppState.db.transaction([STORE_NAMES.PLAYERS], "readwrite");
            const store = transaction.objectStore(STORE_NAMES.PLAYERS);
            const request = store.add(player);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    static async updatePlayer(player) {
        return new Promise((resolve, reject) => {
            const transaction = AppState.db.transaction([STORE_NAMES.PLAYERS], "readwrite");
            const store = transaction.objectStore(STORE_NAMES.PLAYERS);
            const request = store.put(player);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    static async deletePlayer(id) {
        return new Promise((resolve, reject) => {
            const transaction = AppState.db.transaction([STORE_NAMES.PLAYERS], "readwrite");
            const store = transaction.objectStore(STORE_NAMES.PLAYERS);
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    
    static async deletePlayersByTeam(teamId) {
        const players = await this.getAllPlayers(teamId);
        const promises = players.map(player => this.deletePlayer(player.id));
        return Promise.all(promises);
    }
    
    // LINEUP OPERATIONS
    static async saveLineup(teamId, lineup) {
        return new Promise((resolve, reject) => {
            const transaction = AppState.db.transaction([STORE_NAMES.LINEUP], "readwrite");
            const store = transaction.objectStore(STORE_NAMES.LINEUP);
            const request = store.put({ teamId, data: lineup });
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    
    static async getLineup(teamId) {
        return new Promise((resolve, reject) => {
            const transaction = AppState.db.transaction([STORE_NAMES.LINEUP], "readonly");
            const store = transaction.objectStore(STORE_NAMES.LINEUP);
            const request = store.get(teamId);
            
            request.onsuccess = () => resolve(request.result?.data || []);
            request.onerror = () => reject(request.error);
        });
    }
    
    static async deleteLineup(teamId) {
        return new Promise((resolve, reject) => {
            const transaction = AppState.db.transaction([STORE_NAMES.LINEUP], "readwrite");
            const store = transaction.objectStore(STORE_NAMES.LINEUP);
            const request = store.delete(teamId);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    
    // APP STATE OPERATIONS
    static async saveAppState(key, value) {
        return new Promise((resolve, reject) => {
            const transaction = AppState.db.transaction([STORE_NAMES.APP_STATE], "readwrite");
            const store = transaction.objectStore(STORE_NAMES.APP_STATE);
            const request = store.put({ key, value });
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    
    static async getAppState(key) {
        return new Promise((resolve, reject) => {
            const transaction = AppState.db.transaction([STORE_NAMES.APP_STATE], "readonly");
            const store = transaction.objectStore(STORE_NAMES.APP_STATE);
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result?.value);
            request.onerror = () => reject(request.error);
        });
    }
}

// ============================================================================
// TEAM MANAGER
// ============================================================================

class TeamManager {
    static async initialize() {
        const teams = await Database.getAllTeams();
        
        // Create default team if none exist
        if (teams.length === 0) {
            const teamId = await Database.addTeam({ 
                name: "Default Team", 
                createdAt: Date.now() 
            });
            AppState.currentTeamId = teamId;
            await Database.saveAppState('currentTeamId', teamId);
        } else {
            // Load last selected team
            const savedTeamId = await Database.getAppState('currentTeamId');
            if (savedTeamId && teams.some(t => t.id === savedTeamId)) {
                AppState.currentTeamId = savedTeamId;
            } else {
                AppState.currentTeamId = teams[0].id;
                await Database.saveAppState('currentTeamId', teams[0].id);
            }
        }
        
        await this.populateTeamSelector();
    }
    
    static async populateTeamSelector() {
        const teams = await Database.getAllTeams();
        const select = document.getElementById('team-select');
        select.innerHTML = '';
        
        teams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.id;
            option.textContent = team.name;
            option.selected = team.id === AppState.currentTeamId;
            select.appendChild(option);
        });
        
        // Add change event listener
        select.onchange = async (e) => {
            await this.switchTeam(parseInt(e.target.value));
        };
    }
    
    static async switchTeam(teamId) {
        // Stop any playing audio
        AudioPlayer.stop();
        
        // Save current team state
        if (AppState.currentTeamId) {
            await StateManager.saveLineup();
        }
        
        // Switch to new team
        AppState.currentTeamId = teamId;
        await Database.saveAppState('currentTeamId', teamId);
        
        // Reload UI
        AppState.playerTracks.clear();
        await UIManager.renderRoster();
        await StateManager.loadState();
        
        console.log(`Switched to team ${teamId}`);
    }
    
    static async addTeam(name) {
        if (!name || !name.trim()) {
            alert('Please enter a team name');
            return;
        }
        
        try {
            const teamId = await Database.addTeam({ 
                name: name.trim(), 
                createdAt: Date.now() 
            });
            
            await this.populateTeamSelector();
            await this.renderTeamsList();
            
            // Clear form
            document.getElementById('new-team-name').value = '';
            
        } catch (error) {
            console.error('Error adding team:', error);
            alert('Failed to add team');
        }
    }
    
    static async renameTeam(teamId, newName) {
        if (!newName || !newName.trim()) {
            alert('Please enter a valid team name');
            return;
        }
        
        try {
            const team = await Database.getTeam(teamId);
            if (!team) return;
            
            team.name = newName.trim();
            await Database.updateTeam(team);
            
            await this.populateTeamSelector();
            await this.renderTeamsList();
            
        } catch (error) {
            console.error('Error renaming team:', error);
            alert('Failed to rename team');
        }
    }
    
    static async deleteTeam(teamId) {
        const teams = await Database.getAllTeams();
        
        if (teams.length === 1) {
            alert('Cannot delete the last team. At least one team is required.');
            return;
        }
        
        const team = await Database.getTeam(teamId);
        if (!confirm(`Delete team "${team.name}" and all its players?`)) {
            return;
        }
        
        try {
            // Delete all players for this team
            await Database.deletePlayersByTeam(teamId);
            
            // Delete lineup for this team
            await Database.deleteLineup(teamId);
            
            // Delete team
            await Database.deleteTeam(teamId);
            
            // If deleted current team, switch to first available
            if (teamId === AppState.currentTeamId) {
                const remainingTeams = await Database.getAllTeams();
                await this.switchTeam(remainingTeams[0].id);
            }
            
            await this.populateTeamSelector();
            await this.renderTeamsList();
            
        } catch (error) {
            console.error('Error deleting team:', error);
            alert('Failed to delete team');
        }
    }
    
    static async renderTeamsList() {
        const teams = await Database.getAllTeams();
        const container = document.getElementById('teams-list');
        container.innerHTML = '';
        
        for (const team of teams) {
            const players = await Database.getAllPlayers(team.id);
            const playerCount = players.length;
            const pitcherCount = players.filter(p => p.isPitcher).length;
            
            const item = document.createElement('div');
            item.className = 'team-item' + (team.id === AppState.currentTeamId ? ' active' : '');
            item.innerHTML = `
                <div class="team-item-info">
                    <div class="team-item-name">${UIManager.escapeHtml(team.name)}</div>
                    <div class="team-item-stats">${playerCount} players (${pitcherCount} pitchers)</div>
                </div>
                <div class="team-item-actions">
                    <button class="team-rename-btn" data-action="rename-team" data-team-id="${team.id}">Rename</button>
                    <button class="team-delete-btn" data-action="delete-team" data-team-id="${team.id}">Delete</button>
                </div>
            `;
            container.appendChild(item);
        }
    }
    
    static showModal() {
        document.getElementById('team-modal').classList.remove('hidden');
        this.renderTeamsList();
    }
    
    static hideModal() {
        document.getElementById('team-modal').classList.add('hidden');
    }
}

// ============================================================================
// STORAGE MANAGER
// ============================================================================

class StorageManager {
    static async getStorageEstimate() {
        try {
            if (!navigator.storage || !navigator.storage.estimate) {
                return null;
            }
            
            const estimate = await navigator.storage.estimate();
            return {
                usage: estimate.usage || 0,
                quota: estimate.quota || 0,
                percentage: estimate.quota ? (estimate.usage / estimate.quota) * 100 : 0
            };
        } catch (error) {
            console.error('Error getting storage estimate:', error);
            return null;
        }
    }
    
    static formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }
    
    static async updateStorageDisplay() {
        const estimate = await this.getStorageEstimate();
        
        if (!estimate) {
            document.getElementById('storage-stats').textContent = 'Not available';
            document.getElementById('storage-bar').style.width = '0%';
            return;
        }
        
        const { usage, quota, percentage } = estimate;
        const available = quota - usage;
        
        // Update stats text
        const statsEl = document.getElementById('storage-stats');
        statsEl.textContent = `${this.formatBytes(usage)} / ${this.formatBytes(quota)} (${this.formatBytes(available)} free)`;
        
        // Update progress bar
        const barEl = document.getElementById('storage-bar');
        barEl.style.width = `${percentage}%`;
        
        // Apply warning/critical states
        barEl.classList.remove('warning', 'critical');
        
        if (percentage >= 95) {
            barEl.classList.add('critical');
            this.showStorageWarning(available, percentage);
        } else if (percentage >= 80) {
            barEl.classList.add('warning');
        }
        
        return { usage, quota, percentage, available };
    }
    
    static showStorageWarning(available, percentage) {
        const message = `WARNING: Storage is ${percentage.toFixed(1)}% full!\n\n` +
                       `Only ${this.formatBytes(available)} remaining.\n\n` +
                       `Consider deleting unused players or their audio files to free up space.`;
        
        alert(message);
    }
    
    static async checkStorageBeforeUpload(file) {
        const estimate = await this.getStorageEstimate();
        
        if (!estimate) return true;
        
        const { usage, quota, percentage } = estimate;
        const availableAfterUpload = quota - usage - file.size;
        const percentageAfterUpload = ((usage + file.size) / quota) * 100;
        
        if (percentageAfterUpload >= 95) {
            const message = `Cannot upload file: Storage would exceed 95% capacity!\n\n` +
                           `File size: ${this.formatBytes(file.size)}\n` +
                           `Current usage: ${this.formatBytes(usage)} / ${this.formatBytes(quota)}\n` +
                           `After upload: ${percentageAfterUpload.toFixed(1)}%\n\n` +
                           `Please delete some audio files first.`;
            
            alert(message);
            return false;
        }
        
        if (percentageAfterUpload >= 80 && percentage < 80) {
            const message = `Warning: This upload will use ${percentageAfterUpload.toFixed(1)}% of storage.\n\n` +
                           `File size: ${this.formatBytes(file.size)}\n` +
                           `You will have ${this.formatBytes(availableAfterUpload)} remaining.\n\n` +
                           `Continue with upload?`;
            
            return confirm(message);
        }
        
        return true;
    }
}

// ============================================================================
// AUDIO PLAYER
// ============================================================================

class AudioPlayer {
    static play(playerId, buttonElement) {
        const audioUrl = AppState.playerTracks.get(playerId);
        if (!audioUrl) {
            console.error(`No audio found for player ${playerId}`);
            return;
        }
        
        if (AppState.audio.current && AppState.audio.currentBtn === buttonElement) {
            this.fadeOut();
            return;
        }
        
        if (AppState.audio.current) return;
        
        try {
            const lineupItems = Array.from(document.querySelectorAll('.lineup-item'));
            const lineupIndex = lineupItems.indexOf(buttonElement);
            if (lineupIndex !== -1) {
                AppState.ui.lastPlayedIndex = lineupIndex;
                Database.saveAppState(`lastPlayedIndex_${AppState.currentTeamId}`, lineupIndex).catch(console.error);
            }
            
            const audio = new Audio(audioUrl);
            audio.volume = AppState.audio.volume;
            AppState.audio.current = audio;
            AppState.audio.currentBtn = buttonElement;
            
            document.body.classList.add('audio-active');
            UIManager.setElementState(buttonElement, PLAYER_STATE.PLAYING);
            buttonElement.setAttribute('data-active', 'true');
            
            const trigger = buttonElement.querySelector('.play-trigger');
            if (trigger) trigger.setAttribute('data-active', 'true');
            
            audio.play().catch(err => {
                console.error('Audio playback failed:', err);
                this.stop();
            });
            
            audio.onended = () => this.onAudioEnd();
            
        } catch (error) {
            console.error('Error playing audio:', error);
            this.stop();
        }
    }
    
    static fadeOut() {
        if (!AppState.audio.current || AppState.audio.fadeInterval) return;
        
        const fadeSpeed = parseInt(document.getElementById('fade-speed').value);
        const step = 0.05;
        const intervalTime = fadeSpeed / (AppState.audio.current.volume / step);
        
        UIManager.setElementState(AppState.audio.currentBtn, PLAYER_STATE.STOPPING);
        
        AppState.audio.fadeInterval = setInterval(() => {
            if (AppState.audio.current && AppState.audio.current.volume > step) {
                AppState.audio.current.volume -= step;
            } else {
                this.onAudioEnd();
            }
        }, intervalTime);
    }
    
    static stop() {
        if (AppState.audio.fadeInterval) {
            clearInterval(AppState.audio.fadeInterval);
            AppState.audio.fadeInterval = null;
        }
        
        if (AppState.audio.current) {
            AppState.audio.current.pause();
            AppState.audio.current.currentTime = 0;
            AppState.audio.current = null;
        }
        
        if (AppState.audio.currentBtn) {
            UIManager.clearElementState(AppState.audio.currentBtn);
            AppState.audio.currentBtn.removeAttribute('data-active');
            
            const trigger = AppState.audio.currentBtn.querySelector('.play-trigger');
            if (trigger) trigger.removeAttribute('data-active');
            
            AppState.audio.currentBtn = null;
        }
        
        document.body.classList.remove('audio-active');
    }
    
    static onAudioEnd() {
        this.stop();
        UIManager.updateHighlighting();
        StateManager.saveLineup().catch(console.error);
    }
    
    static setVolume(volume) {
        AppState.audio.volume = volume;
        if (AppState.audio.current && !AppState.audio.fadeInterval) {
            AppState.audio.current.volume = volume;
        }
    }
}

// ============================================================================
// UI MANAGER
// ============================================================================

class UIManager {
    static async renderRoster() {
        try {
            const players = await Database.getAllPlayers(AppState.currentTeamId);
            const rosterEl = document.getElementById('roster');
            const subsEl = document.getElementById('subs-list');
            const pitchersEl = document.getElementById('pitchers-list');
            
            rosterEl.innerHTML = "";
            subsEl.innerHTML = "";
            pitchersEl.innerHTML = "";
            
            const sortedPlayers = [...players].sort((a, b) => 
                parseInt(a.number || 0) - parseInt(b.number || 0)
            );
            
            sortedPlayers.forEach(player => {
                this.renderRosterItem(player, rosterEl);
                this.loadPlayerAudio(player);
                
                if (player.isPitcher) {
                    this.renderPitcherItem(player, pitchersEl);
                } else {
                    this.renderSubItem(player, subsEl);
                }
            });
            
            await StorageManager.updateStorageDisplay();
            
        } catch (error) {
            console.error('Error rendering roster:', error);
        }
    }
    
    static renderRosterItem(player, container) {
        const card = document.createElement('div');
        card.className = 'roster-item' + (player.isPitcher ? ' pitcher' : '');
        card.innerHTML = `
            <div class="roster-item-header">
                <div class="player-info${player.isPitcher ? ' pitcher' : ''}" data-player-id="${player.id}">#${this.escapeHtml(player.number)} ${this.escapeHtml(player.name)}</div>
                <div class="roster-actions">
                    <button class="edit-btn" data-action="edit-player" data-player-id="${player.id}">✏️ Edit</button>
                    ${!player.isPitcher ? `<button class="roster-btn" data-action="add-to-lineup" data-player-id="${player.id}">➕ Lineup</button>` : ''}
                </div>
            </div>
            <div class="upload-zone">
                <input type="file" accept="audio/*" data-action="upload-audio" data-player-id="${player.id}">
                <button class="delete-player-btn" data-action="delete-player" data-player-id="${player.id}">Delete</button>
                <p class="status ${player.file ? 'loaded' : ''}">${this.escapeHtml(player.fileName || 'No audio uploaded')}</p>
            </div>
        `;
        container.appendChild(card);
    }
    
    static renderSubItem(player, container) {
        const btn = document.createElement('button');
        btn.className = 'sub-item-btn';
        btn.innerHTML = `<strong>#${this.escapeHtml(player.number)}</strong> &nbsp; ${this.escapeHtml(player.name)}`;
        btn.dataset.playerId = player.id;
        btn.dataset.action = 'play-audio';
        container.appendChild(btn);
    }
    
    static renderPitcherItem(player, container) {
        const btn = document.createElement('button');
        btn.className = 'sub-item-btn';
        btn.innerHTML = `<strong>#${this.escapeHtml(player.number)}</strong> &nbsp; ${this.escapeHtml(player.name)} ⚾`;
        btn.dataset.playerId = player.id;
        btn.dataset.action = 'play-audio';
        btn.style.borderLeft = '6px solid #8e44ad';
        container.appendChild(btn);
    }
    
    static loadPlayerAudio(player) {
        if (player.file) {
            const oldUrl = AppState.playerTracks.get(player.id);
            if (oldUrl) URL.revokeObjectURL(oldUrl);
            
            const blobUrl = URL.createObjectURL(player.file);
            AppState.playerTracks.set(player.id, blobUrl);
        }
    }
    
    static async renderLineup() {
        try {
            const lineup = await Database.getLineup(AppState.currentTeamId);
            const lineupEl = document.getElementById('lineup');
            lineupEl.innerHTML = "";
            
            lineup.forEach(player => {
                lineupEl.appendChild(this.createLineupElement(player));
            });
            
            this.updateHighlighting();
            
        } catch (error) {
            console.error('Error rendering lineup:', error);
        }
    }
    
    static createLineupElement(player) {
        const item = document.createElement('div');
        item.className = 'lineup-item';
        item.dataset.playerId = player.id;
        item.innerHTML = `
            <button class="play-trigger" data-action="play-audio" data-player-id="${player.id}">
                <strong>#${this.escapeHtml(player.number)}</strong> <span>${this.escapeHtml(player.name)}</span>
            </button>
            <button class="remove-from-lineup" data-action="remove-from-lineup">❌</button>
        `;
        return item;
    }
    
    static updateHighlighting() {
        const items = document.querySelectorAll('.lineup-item');
        
        items.forEach((item, index) => {
            if (item.dataset.state === PLAYER_STATE.ON_DECK) {
                item.removeAttribute('data-state');
            }
            
            if (AppState.ui.lastPlayedIndex !== LAST_PLAYED.RESET) {
                if (AppState.ui.lastPlayedIndex === LAST_PLAYED.NONE && index === 0) {
                    item.dataset.state = PLAYER_STATE.ON_DECK;
                } else if (index === AppState.ui.lastPlayedIndex + 1) {
                    item.dataset.state = PLAYER_STATE.ON_DECK;
                }
            }
        });
    }
    
    static setElementState(element, state) {
        if (element) {
            element.dataset.state = state;
        }
    }
    
    static clearElementState(element) {
        if (element) {
            element.removeAttribute('data-state');
        }
    }
    
    static toggleLockUI() {
        AppState.ui.isLocked = !AppState.ui.isLocked;
        document.body.classList.toggle('locked', AppState.ui.isLocked);
        
        const lockBtn = document.getElementById('lock-toggle');
        lockBtn.textContent = AppState.ui.isLocked ? "🔒 Unlock to Edit" : "🔓 Lock & Save";
        
        this.renderRoster();
    }
    
    static toggleSubsDrawer() {
        const drawer = document.getElementById('subs-drawer');
        const pitchersDrawer = document.getElementById('pitchers-drawer');
        
        if (!pitchersDrawer.classList.contains('closed')) {
            pitchersDrawer.classList.add('closed');
        }
        
        drawer.classList.toggle('closed');
    }
    
    static togglePitchersDrawer() {
        const drawer = document.getElementById('pitchers-drawer');
        const subsDrawer = document.getElementById('subs-drawer');
        
        if (!subsDrawer.classList.contains('closed')) {
            subsDrawer.classList.add('closed');
        }
        
        drawer.classList.toggle('closed');
    }
    
    static showEditForm(playerId) {
        Database.getPlayer(playerId).then(player => {
            if (!player) return;
            
            const container = document.querySelector(`[data-player-id="${playerId}"].player-info`);
            if (!container) return;
            
            container.innerHTML = `
                <input type="text" class="edit-input" data-edit-field="number" style="width:50px" value="${this.escapeHtml(player.number)}" maxlength="3">
                <input type="text" class="edit-input" data-edit-field="name" value="${this.escapeHtml(player.name)}" maxlength="50">
                <div class="pitcher-toggle-edit">
                    <input type="checkbox" id="edit-pitcher-${playerId}" data-edit-field="pitcher" ${player.isPitcher ? 'checked' : ''}>
                    <label for="edit-pitcher-${playerId}">Pitcher</label>
                </div>
                <button class="save-btn" data-action="save-player" data-player-id="${playerId}">💾 Save</button>
            `;
        }).catch(console.error);
    }
    
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ============================================================================
// STATE MANAGER
// ============================================================================

class StateManager {
    static async saveLineup() {
        try {
            const lineupItems = document.querySelectorAll('#lineup .lineup-item');
            const lineup = Array.from(lineupItems).map(item => ({
                id: parseInt(item.dataset.playerId),
                name: item.querySelector('span').textContent,
                number: item.querySelector('strong').textContent.replace('#', '')
            }));
            
            await Database.saveLineup(AppState.currentTeamId, lineup);
            await Database.saveAppState(`lastPlayedIndex_${AppState.currentTeamId}`, AppState.ui.lastPlayedIndex);
            
        } catch (error) {
            console.error('Error saving lineup:', error);
        }
    }
    
    static async loadState() {
        try {
            const lastPlayedIndex = await Database.getAppState(`lastPlayedIndex_${AppState.currentTeamId}`);
            if (lastPlayedIndex !== undefined) {
                AppState.ui.lastPlayedIndex = lastPlayedIndex;
            } else {
                AppState.ui.lastPlayedIndex = LAST_PLAYED.RESET;
            }
            
            await UIManager.renderLineup();
            
        } catch (error) {
            console.error('Error loading state:', error);
        }
    }
    
    static resetHighlight() {
        AppState.ui.lastPlayedIndex = LAST_PLAYED.RESET;
        Database.saveAppState(`lastPlayedIndex_${AppState.currentTeamId}`, LAST_PLAYED.RESET).catch(console.error);
        UIManager.updateHighlighting();
    }
    
    static async clearLineup() {
        if (!confirm("Clear batting order?")) return;
        
        try {
            document.getElementById('lineup').innerHTML = "";
            AppState.ui.lastPlayedIndex = LAST_PLAYED.RESET;
            
            await Database.saveLineup(AppState.currentTeamId, []);
            await Database.saveAppState(`lastPlayedIndex_${AppState.currentTeamId}`, LAST_PLAYED.RESET);
            
            UIManager.updateHighlighting();
            
        } catch (error) {
            console.error('Error clearing lineup:', error);
        }
    }
}

// ============================================================================
// PLAYER ACTIONS
// ============================================================================

class PlayerActions {
    static async addPlayer(name, number, isPitcher = false) {
        if (!name || !name.trim()) {
            alert('Please enter a player name');
            return;
        }
        
        try {
            await Database.addPlayer({ 
                teamId: AppState.currentTeamId,
                name: name.trim(), 
                number: number.trim(), 
                isPitcher: isPitcher,
                file: null, 
                fileName: "" 
            });
            
            document.getElementById('new-player-name').value = "";
            document.getElementById('new-player-number').value = "";
            document.getElementById('new-player-pitcher').checked = false;
            
            await UIManager.renderRoster();
            
        } catch (error) {
            console.error('Error adding player:', error);
            alert('Failed to add player');
        }
    }
    
    static async updatePlayer(playerId, updates) {
        try {
            const player = await Database.getPlayer(playerId);
            if (!player) return;
            
            Object.assign(player, updates);
            await Database.updatePlayer(player);
            await UIManager.renderRoster();
            
        } catch (error) {
            console.error('Error updating player:', error);
            alert('Failed to update player');
        }
    }
    
    static async deletePlayer(playerId) {
        if (!confirm("Delete this player?")) return;
        
        try {
            const blobUrl = AppState.playerTracks.get(playerId);
            if (blobUrl) {
                URL.revokeObjectURL(blobUrl);
                AppState.playerTracks.delete(playerId);
            }
            
            await Database.deletePlayer(playerId);
            await UIManager.renderRoster();
            
        } catch (error) {
            console.error('Error deleting player:', error);
            alert('Failed to delete player');
        }
    }
    
    static async uploadAudio(playerId, file) {
        if (!file || !file.type.startsWith('audio/')) {
            alert('Please select a valid audio file');
            return;
        }
        
        const canUpload = await StorageManager.checkStorageBeforeUpload(file);
        if (!canUpload) return;
        
        try {
            const player = await Database.getPlayer(playerId);
            if (!player) return;
            
            player.file = file;
            player.fileName = file.name;
            
            await Database.updatePlayer(player);
            await UIManager.renderRoster();
            
        } catch (error) {
            console.error('Error uploading audio:', error);
            alert('Failed to upload audio');
        }
    }
    
    static async addToLineup(playerId) {
        try {
            const player = await Database.getPlayer(playerId);
            if (!player) return;
            
            const lineupEl = document.getElementById('lineup');
            lineupEl.appendChild(UIManager.createLineupElement(player));
            
            await StateManager.saveLineup();
            UIManager.updateHighlighting();
            
        } catch (error) {
            console.error('Error adding to lineup:', error);
        }
    }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

class EventHandlers {
    static initialize() {
        document.addEventListener('click', this.handleClick.bind(this));
        
        document.getElementById('volume').addEventListener('input', (e) => {
            AudioPlayer.setVolume(parseFloat(e.target.value));
        });
        
        Sortable.create(document.getElementById('lineup'), {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onStart: () => AppState.ui.isLocked ? false : true,
            onEnd: () => {
                StateManager.saveLineup().catch(console.error);
                UIManager.updateHighlighting();
            }
        });
    }
    
    static async handleClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        
        const action = target.dataset.action;
        const playerId = target.dataset.playerId ? parseInt(target.dataset.playerId) : null;
        const teamId = target.dataset.teamId ? parseInt(target.dataset.teamId) : null;
        
        switch (action) {
            case 'toggle-lock':
                UIManager.toggleLockUI();
                break;
                
            case 'toggle-subs':
                UIManager.toggleSubsDrawer();
                break;
                
            case 'toggle-pitchers':
                UIManager.togglePitchersDrawer();
                break;
                
            case 'reset-highlight':
                StateManager.resetHighlight();
                break;
                
            case 'clear-lineup':
                await StateManager.clearLineup();
                break;
                
            case 'manage-teams':
                TeamManager.showModal();
                break;
                
            case 'close-modal':
                TeamManager.hideModal();
                break;
                
            case 'add-team':
                const teamName = document.getElementById('new-team-name').value;
                await TeamManager.addTeam(teamName);
                break;
                
            case 'rename-team':
                const newName = prompt('Enter new team name:');
                if (newName) {
                    await TeamManager.renameTeam(teamId, newName);
                }
                break;
                
            case 'delete-team':
                await TeamManager.deleteTeam(teamId);
                break;
                
            case 'add-player':
                const name = document.getElementById('new-player-name').value;
                const number = document.getElementById('new-player-number').value;
                const isPitcher = document.getElementById('new-player-pitcher').checked;
                await PlayerActions.addPlayer(name, number, isPitcher);
                break;
                
            case 'edit-player':
                UIManager.showEditForm(playerId);
                break;
                
            case 'save-player':
                const container = target.closest('.roster-item-header');
                const nameInput = container.querySelector('[data-edit-field="name"]');
                const numberInput = container.querySelector('[data-edit-field="number"]');
                const pitcherInput = container.querySelector('[data-edit-field="pitcher"]');
                await PlayerActions.updatePlayer(playerId, {
                    name: nameInput.value,
                    number: numberInput.value,
                    isPitcher: pitcherInput ? pitcherInput.checked : false
                });
                break;
                
            case 'delete-player':
                await PlayerActions.deletePlayer(playerId);
                break;
                
            case 'add-to-lineup':
                await PlayerActions.addToLineup(playerId);
                break;
                
            case 'remove-from-lineup':
                target.closest('.lineup-item').remove();
                await StateManager.saveLineup();
                UIManager.updateHighlighting();
                break;
                
            case 'play-audio':
                const element = target.closest('.lineup-item') || target.closest('.sub-item-btn');
                AudioPlayer.play(playerId, element);
                break;
                
            case 'upload-audio':
                if (target.files && target.files[0]) {
                    await PlayerActions.uploadAudio(playerId, target.files[0]);
                }
                break;
                
            case 'spotify-auth':
                // Handled by spotify.js
                break;
                
            case 'search-spotify':
                await spotifyManager.performSearch();
                break;
                
            case 'close-spotify-search':
                spotifyManager.hideSearchModal();
                break;
                
            case 'spotify-search-player':
                spotifyManager.showSearchModal(playerId);
                break;
                
            case 'select-source-local':
                await PlayerActions.updatePlayer(playerId, { audioSource: 'local' });
                break;
                
            case 'select-source-spotify':
                await PlayerActions.updatePlayer(playerId, { audioSource: 'spotify' });
                break;
                
            case 'manage-innings':
                spotifyManager.showInningsModal();
                break;
                
            case 'close-innings-modal':
                spotifyManager.hideInningsModal();
                break;
                
            case 'play-innings-playlist':
                await spotifyManager.playInningsPlaylist();
                break;
                
            case 'stop-innings-playlist':
                spotifyManager.stopInningsPlaylist();
                break;
                
            case 'add-innings-track':
                spotifyManager.showSearchModal(null);
                break;
                
            case 'remove-innings-track':
                const trackId = parseFloat(target.dataset.trackId);
                spotifyManager.removeFromInningsPlaylist(trackId);
                break;
        }
    }
}

// ============================================================================
// APPLICATION INITIALIZATION
// ============================================================================

async function initializeApp() {
    try {
        await Database.initialize();
        await TeamManager.initialize();
        await UIManager.renderRoster();
        await StateManager.loadState();
        
        EventHandlers.initialize();

        // Initialize Spotify AFTER everything else
        await spotifyManager.initialize();
        
        console.log('Baseball Soundboard initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize app:', error);
        alert('Failed to initialize application. Please refresh the page.');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
