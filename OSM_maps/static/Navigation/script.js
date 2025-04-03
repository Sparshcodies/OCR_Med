// Initialize the map
const map = L.map('map').setView([20.5937, 78.9629], 6); // Centered at India

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// Predefined source and destination locations
const source = L.marker([20.5937, 78.9629]).addTo(map).bindPopup('Source Location').openPopup();
const destination = L.marker([19.0760, 72.8777]).addTo(map).bindPopup('Destination Location').openPopup();

// Route line (dummy data)
const routePoints = [
    [20.5937, 78.9629],
    [20.0, 78.5],
    [19.5, 78.0],
    [19.0760, 72.8777]
];

const routeLine = L.polyline(routePoints, { color: 'red' }).addTo(map);

// Fit map bounds to the route
map.fitBounds(routeLine.getBounds());