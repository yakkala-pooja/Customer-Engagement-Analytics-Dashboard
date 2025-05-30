const express = require('express');
const router = express.Router();
const axios = require('axios');
const data = require('../data/sampleData.json');

// Get all customers
router.get('/', (req, res) => {
  res.json(data);
});

// Get a specific customer + anomaly flags
router.get('/:id', async (req, res) => {
  const customer = data.find(c => c.id === req.params.id);

  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  try {
    // POST to the FastAPI anomaly detector
    const anomalyResponse = await axios.post('http://localhost:8000/detect', {
      dates: customer.dates,
      scores: customer.engagement_score
    });

    // Add anomaly flags to the customer object
    const responseWithAnomalies = {
      ...customer,
      anomalies: anomalyResponse.data.anomalies
    };

    res.json(responseWithAnomalies);
  } catch (error) {
    console.error('Anomaly detection failed:', error.message);
    res.status(500).json({ error: 'Anomaly detection service failed' });
  }
});

module.exports = router;
