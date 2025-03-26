let map = L.map('map').setView([20.5937, 78.9629], 5); // Default map view
let userLocation = null;
let routeControl = null;

var customIcon = L.icon({
    iconUrl: '/static/elements/penguin.svg',
    iconSize: [42, 100], 
    iconAnchor: [20, 94], 
    popupAnchor: [-11, -76],
});

var pharmacyIcon = L.icon({
    iconUrl: '/static/elements/Pharmacy.png',
    iconSize: [150, 150],
    iconAnchor: [21, 50],
    popupAnchor: [0, -40]
});

var doctorIcon = L.icon({
    iconUrl: '/static/elements/Clinic.png',
    iconSize: [42, 42],
    iconAnchor: [21, 42],
    popupAnchor: [0, -40]
});

var hospitalIcon = L.icon({
    iconUrl: '/static/elements/Hospital.png',
    iconSize: [42, 42],
    iconAnchor: [21, 42],
    popupAnchor: [0, -40]
});

var pathoLabIcon = L.icon({
    iconUrl: '/static/elements/Patho_lab.png',
    iconSize: [42, 42],
    iconAnchor: [21, 42],
    popupAnchor: [0, -40]
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Check if Geolocation is available
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function (position) {
        var lat = position.coords.latitude;
        var lon = position.coords.longitude;

        // Set view to user's location
        map.setView([lat, lon], 13);
        // Update the userLocation variable
        userLocation = [lat, lon];

        // Add a marker at the user's location
        L.marker([lat, lon],{ icon: customIcon }).addTo(map)
            .bindPopup("You are here!")
            .openPopup();
    }, function (error) {
        console.log("Geolocation error: " + error.message);
    });
} else {
    alert("Geolocation is not supported by this browser.");
}


document.getElementById('locationForm').addEventListener('submit', function(e) {
    e.preventDefault();
    let location = document.getElementById('locationInput').value;
    let pharmacyList = document.getElementById('pharmacyList');
    pharmacyList.innerHTML = ''; // Clear the list

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${location}`)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                let lat = data[0].lat;
                let lon = data[0].lon;
                map.setView([lat, lon], 13);
                L.marker([lat, lon]).addTo(map).bindPopup(`<b>${location}</b>`).openPopup();

                // Fetch pharmacies using Overpass API
                return fetch(`https://overpass-api.de/api/interpreter?data=[out:json];node["amenity"="pharmacy"](around:5000,${lat},${lon});out;`);
            } else {
                throw new Error("Location not found");
            }
        })
        .then(res => res.json())
        .then(osmData => {
            if (osmData.elements.length === 0) {
                pharmacyList.innerHTML = "<li>No pharmacies found.</li>";
            } else {
                osmData.elements.forEach(pharmacy => {
                    let name = pharmacy.tags.name || "Unnamed Pharmacy";
                    let pLat = pharmacy.lat;
                    let pLon = pharmacy.lon;
                    let iconType = pharmacyIcon; // Default icon


                    // You'll need these for 
                    // if (name.toLowerCase().includes("doctor")) iconType = doctorIcon;
                    // if (name.toLowerCase().includes("hospital")) iconType = hospitalIcon;
                    // if (name.toLowerCase().includes("patho")) iconType = pathoLabIcon;




                    // Add marker for each pharmacy
                    let marker = L.marker([pLat, pLon],{icon: iconType}).addTo(map)
                        .bindPopup(`<b>${name}</b><br><button onclick="getDirections(${pLat}, ${pLon})">Get Directions</button>`);
                    // L.marker([pLat, pLon]).addTo(map).bindPopup(`<b>${name}</b>`);

                    // Add to list
                    let li = document.createElement("li");
                    li.innerHTML = `${name} <button onclick="getDirections(${pLat}, ${pLon})">Get Directions</button>`;
                    // li.textContent = name;
                    pharmacyList.appendChild(li);
                });
            }
        })
        .catch(err => console.error("Error fetching pharmacies:", err));

    // Fetch pharmacies from Django API
    fetch('/api/pharmacies/')
        .then(response => response.json())
        .then(data => {
            data.pharmacies.forEach(pharmacy => {
                let iconType = pharmacyIcon;
                L.marker([pharmacy.lat, pharmacy.lon],{ icon: iconType }).addTo(map)
                    .bindPopup(`<b>${pharmacy.name}</b><br>${pharmacy.address}<br><button onclick="getDirections(${pharmacy.lat}, ${pharmacy.lon})">Get Directions</button>`);

                let li = document.createElement("li");
                li.textContent = `${pharmacy.name} - ${pharmacy.address} <button onclick="getDirections(${pharmacy.lat}, ${pharmacy.lon})">Get Directions</button>`;
                pharmacyList.appendChild(li);
            });
        })
        .catch(error => console.error("Error loading pharmacies from Django:", error));

    // Fetch pharmacy search results from Django
    fetch(`/search/?query=${encodeURIComponent(location)}`)
        .then(response => response.json())
        .then(data => {
            if (data.pharmacies.length === 0) {
                alert("No pharmacies found.");
            } else {
                data.pharmacies.forEach(pharmacy => {
                    L.marker([pharmacy.lat, pharmacy.lon]).addTo(map)
                        .bindPopup(`<b>${pharmacy.name}</b><br>${pharmacy.address}`);

                    let li = document.createElement("li");
                    li.textContent = `${pharmacy.name} - ${pharmacy.address}`;
                    pharmacyList.appendChild(li);
                });
            }
        })
        .catch(error => console.error("Error fetching pharmacies:", error));
});

function getDirections(destLat, destLon) {
    if (!userLocation) {
        alert("User location not found. Please enable location services.");
        return;
    }

    if (routeControl) {
        map.removeControl(routeControl);
    }

    routeControl = L.Routing.control({
        waypoints: [
            L.latLng(userLocation[0], userLocation[1]),
            L.latLng(destLat, destLon)
        ],
        routeWhileDragging: true,
        createMarker: function() { return null; }
    }).addTo(map);
}