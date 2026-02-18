// Spotify Configuration
// Get your Client ID from: https://developer.spotify.com/dashboard
const SPOTIFY_CONFIG = {
    CLIENT_ID: '6fcf4eda70c44b08878b97d61c185764', // Replace with your actual Client ID
    REDIRECT_URI: 'http://localhost:8000/callback', // Change this to match your setup
    SCOPES: [
        'streaming',
        'user-read-email',
        'user-read-private',
        'user-modify-playback-state',
        'user-read-playback-state'
    ]
};
