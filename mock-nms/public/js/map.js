// Initialize Leaflet Map
const map = L.map('map').setView([47.5, -122.2], 9);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Global Marker Storage
const markers = {};

// Custom Map Icons
const offlineIcon = L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34] });
const onlineIcon = L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34] });
const warningIcon = L.icon({ 
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png', 
    iconSize: [25, 41], 
    iconAnchor: [12, 41], 
    popupAnchor: [1, -34],
    className: 'blinking-marker' // <-- This hooks it to the CSS animation
});
