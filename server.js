// server.js

// 1. Import necessary modules
require('dotenv').config(); // Loads environment variables from .env file
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
// For Node.js versions < 18, you might need 'node-fetch'. For v18+, fetch is global.
// const fetch = require('node-fetch'); // Uncomment if using Node < 18 and install it (npm install node-fetch@2)


// 2. Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000; // Server will run on port 3000

// 3. Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Allow server to understand JSON request bodies
app.use(express.static(path.join(__dirname, 'public')));

// 4. Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Successfully connected to MongoDB Atlas!'))
    .catch(err => console.error('MongoDB connection error:', err));

// 5. Define the Heart Schema and Model (how heart data is structured in DB)
const heartSchema = new mongoose.Schema({
    type: { type: String, required: true, enum: ['redHeart', 'silverHeart', 'yellowHeart'] },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    message: { type: String, default: '' },
    countryName: { type: String, default: 'Unknown' },
    countryCode: { type: String, default: 'XX' },
    timestamp: { type: Date, default: Date.now }
});
const Heart = mongoose.model('Heart', heartSchema); // 'Heart' will be the collection name (pluralized to 'hearts')

// 6. API Endpoints

// Helper function for reverse geocoding (moved from frontend)
async function getCountryFromServerLatLng(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=3&accept-language=en`);
        if (!response.ok) {
            console.error('Nominatim API response not OK:', response.status, await response.text());
            throw new Error('Network response was not ok from Nominatim.');
        }
        const data = await response.json();
        if (data && data.address) {
            return {
                countryName: data.address.country || 'the open sea',
                countryCode: data.address.country_code ? data.address.country_code.toUpperCase() : 'XX'
            };
        } else {
            return { countryName: 'the open sea', countryCode: 'XX' };
        }
    } catch (error) {
        console.error('Failed to get country from lat/lng (server-side):', error);
        return { countryName: 'an unknown location', countryCode: 'XX' }; // Fallback
    }
}

// POST: Create a new heart
app.post('/api/hearts', async (req, res) => {
    try {
        const { type, latitude, longitude, message } = req.body;

        if (latitude === undefined || longitude === undefined || !type) {
            return res.status(400).json({ error: 'Missing required fields: type, latitude, longitude' });
        }

        // Get country info
        const geo = await getCountryFromServerLatLng(latitude, longitude);

        const newHeart = new Heart({
            type,
            latitude,
            longitude,
            message: message || '',
            countryName: geo.countryName,
            countryCode: geo.countryCode,
            timestamp: new Date() // Server sets the timestamp
        });

        await newHeart.save(); // Save to MongoDB
        res.status(201).json(newHeart); // Send back the created heart
    } catch (error) {
        console.error('Error creating heart:', error);
        res.status(500).json({ error: 'Failed to create heart' });
    }
});

// GET: Retrieve all hearts
app.get('/api/hearts', async (req, res) => {
    try {
        const hearts = await Heart.find().sort({ timestamp: -1 }); // Get all hearts, newest first
        res.status(200).json(hearts);
    } catch (error) {
        console.error('Error fetching hearts:', error);
        res.status(500).json({ error: 'Failed to fetch hearts' });
    }
});

// 7. Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});