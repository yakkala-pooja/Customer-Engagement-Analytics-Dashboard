import axios from 'axios';

const BASE_URL = "http://localhost:8000";  // Backend server URL
const API_KEY = "rIV08bJX2rEKoCeu9fGHd7XVwQkcxA";

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
    try {
      const url = customerId 
        ? `${BASE_URL}/alerts/history?customer_id=${customerId}&limit=10`
        : `${BASE_URL}/alerts/history?limit=10`;
      const response = await fetch(url, {
        headers: {
          'X-API-Key': API_KEY
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch alert history');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching alert history:', error);
      return [];
    }
  },

  async getAlertConfig(customerId) {
    try {
      const response = await fetch(`${BASE_URL}/alerts/config/${customerId}`, {
        headers: {
          'X-API-Key': API_KEY
        }
      });
      if (!response.ok) {
        if (response.status === 404) {
          // Return default config if none exists
          return {
            enabled: false,
            email_recipients: [],
            thresholds: {
              warning_threshold: 0.15,
              critical_threshold: 0.30,
              min_anomaly_points: 3,
              cooldown_minutes: 60
            }
          };
        }
        throw new Error('Failed to fetch alert configuration');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching alert config:', error);
      // Return default config on error
      return {
        enabled: false,
        email_recipients: [],
        thresholds: {
          warning_threshold: 0.15,
          critical_threshold: 0.30,
          min_anomaly_points: 3,
          cooldown_minutes: 60
        }
      };
    }
  },

  async setAlertConfig(customerId, config) {
    const response = await fetch(`${BASE_URL}/alerts/config/${customerId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(config)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail || 'Failed to update alert configuration');
    }
    return response.json();
  }
};

export default API;

