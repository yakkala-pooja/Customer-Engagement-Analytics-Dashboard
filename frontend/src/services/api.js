import axios from 'axios';

const BASE_URL = "http://localhost:8000";  // Backend server URL
const API_KEY = "YOUR-API-KEY";

const API = {
  getCustomers: () =>
    fetch(`${BASE_URL}/customers`, {
      headers: {
        'X-API-Key': API_KEY
      }
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch customers");
        return res.json();
      }),

  detectAnomalies: async (data, customerId = null) => {
    const url = customerId 
      ? `${BASE_URL}/detect?customer_id=${customerId}`
      : `${BASE_URL}/detect`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.detail || 
        `Failed to detect anomalies: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();
    
    // If the response includes alert info, extract just the anomaly detection part
    return result.anomaly_detection || result;
  },

  getRedditMetrics: async (subreddit, timeframe = 'week', limit = 100) => {
    const response = await fetch(
      `${BASE_URL}/reddit/metrics/${subreddit}?timeframe=${timeframe}&limit=${limit}`,
      {
        headers: {
          'X-API-Key': API_KEY
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.detail ||
        `Failed to fetch Reddit metrics: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  },

  async getAlertHistory(customerId = null) {
    const url = customerId 
      ? `${BASE_URL}/alerts/history?customer_id=${customerId}`
      : `${BASE_URL}/alerts/history`;
    const response = await fetch(url, {
      headers: {
        'X-API-Key': API_KEY
      }
    });
    if (!response.ok) {
      throw new Error('Failed to fetch alert history');
    }
    return response.json();
  },

  async getAlertConfig(customerId) {
    const response = await fetch(`${BASE_URL}/alerts/config/${customerId}`, {
      headers: {
        'X-API-Key': API_KEY
      }
    });
    if (!response.ok) {
      throw new Error('Failed to fetch alert configuration');
    }
    return response.json();
  },

  async updateAlertConfig(customerId, config) {
    const response = await fetch(`${BASE_URL}/alerts/config/${customerId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(config)
    });
    if (!response.ok) {
      throw new Error('Failed to update alert configuration');
    }
    return response.json();
  }
};

export default API;

