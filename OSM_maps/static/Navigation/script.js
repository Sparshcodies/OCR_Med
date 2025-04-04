// Initialize the map
const map = L.map('map').setView([20.5937, 78.9629], 6); // Centered at India

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// Store the current base location globally
let currentBaseLocation = [20.5937, 78.9629]; // Default: India

// Function to search for a location and update the map
function searchLocation() {
    let location = document.getElementById('locationInput').value.trim(); // Get search input
    if (!location) return;

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${location}`)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                let lat = parseFloat(data[0].lat);
                let lon = parseFloat(data[0].lon);

                // Update the map view
                map.setView([lat, lon], 12);

                // Remove old marker if exists
                if (window.searchMarker) {
                    map.removeLayer(window.searchMarker);
                }

                // Add marker for searched location
                window.searchMarker = L.marker([lat, lon]).addTo(map)
                    .bindPopup(`Searched Location: ${location}`)
                    .openPopup();

                // Update current base location for future searches (e.g., hospitals)
                currentBaseLocation = [lat, lon];
                console.log("New Base Location Set:", currentBaseLocation);
            } else {
                alert('Location not found! Try a different search term.');
            }
        })
        .catch(error => console.error('Error:', error));
}

// Function to find nearby places (e.g., hospitals, pharmacies)
function findNearbyPlaces(type) {
    if (!currentBaseLocation) {
        alert("Please search for a location first.");
        return;
    }

    let [lat, lon] = currentBaseLocation;
    let overpassQuery = `[out:json];node(around:5000, ${lat}, ${lon})["amenity"="${type}"];out;`;

    fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`)
        .then(response => response.json())
        .then(data => {
            if (window.nearbyMarkers) {
                window.nearbyMarkers.forEach(marker => map.removeLayer(marker));
            }
            window.nearbyMarkers = [];

            data.elements.forEach(element => {
                if (element.lat && element.lon) {
                    let marker = L.marker([element.lat, element.lon]).addTo(map)
                        .bindPopup(`Nearby ${type.charAt(0).toUpperCase() + type.slice(1)}`)
                        .openPopup();
                    window.nearbyMarkers.push(marker);
                }
            });

            if (data.elements.length === 0) {
                alert(`No nearby ${type} found.`);
            }
        })
        .catch(error => console.error('Error fetching nearby places:', error));
}

// Event listeners
document.getElementById('searchBtn').addEventListener('click', searchLocation);
document.getElementById('hospitalBtn2').addEventListener('click', () => findNearbyPlaces('hospital'));
document.getElementById('pharmacyBtn2').addEventListener('click', () => findNearbyPlaces('pharmacy'));
document.getElementById('doctorBtn2').addEventListener('click', () => findNearbyPlaces('doctors'));
document.getElementById('labBtn2').addEventListener('click', () => findNearbyPlaces('laboratory'));
let userMarker = null;
let watchId = null;

// Function to update the user's location
function updateUserLocation(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

    // If the marker already exists, update its position
    if (userMarker) {
        userMarker.setLatLng([lat, lon]);
    } else {
        // Create a marker for the user's location
        userMarker = L.marker([lat, lon], {
            icon: L.icon({
                iconUrl: 'https://leafletjs.com/examples/custom-icons/marker-icon.png', // Change to custom icon if needed
                iconSize: [25, 41],
                iconAnchor: [12, 41],
            })
        }).addTo(map).bindPopup('Your Current Location').openPopup();
    }

    map.setView([lat, lon]); // Center map on new position
}

// Start live tracking
function startLiveTracking() {
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(updateUserLocation, 
            (error) => console.error("Error getting location: ", error),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
    } else {
        alert("Geolocation is not supported by your browser.");
    }
}

// Stop live tracking
function stopLiveTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
}

// Start tracking when "Start Navigation" button is clicked
document.getElementById('getDirection').addEventListener('click', startLiveTracking);
