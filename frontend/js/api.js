const API_BASE_URL = window.API_CONFIG?.apiBaseUrl || 'http://localhost:8000/api';

class CareerCompassAPI {
    async getDashboard(userId) {
        const response = await fetch(`${API_BASE_URL}/users/${userId}/dashboard`);
        return response.json();
    }

    async getFootprints(userId) {
        const response = await fetch(`${API_BASE_URL}/activities/footprints/${userId}`);
        return response.json();
    }

    async getVillages() {
        const response = await fetch(`${API_BASE_URL}/villages`);
        return response.json();
    }

    async getRecommendedMentors(userId) {
        const response = await fetch(`${API_BASE_URL}/mentors/recommend/${userId}`);
        return response.json();
    }

    async logActivity(userId, activity) {
        const response = await fetch(`${API_BASE_URL}/activities`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({userId, activity, timestamp: new Date().toISOString()})
        });
        return response.json();
    }
}

const api = new CareerCompassAPI();
