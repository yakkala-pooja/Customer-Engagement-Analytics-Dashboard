import React, { useState, useEffect } from 'react';
import API from '../services/api';
import ChartComponent from './ChartComponent';
import ErrorBoundary from './ErrorBoundary';
import { CSVLink } from 'react-csv';

const CustomerAnalytics = () => {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const data = await API.getCustomers();
      setCustomers(data);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError('Failed to fetch customers. Please try again later.');
    }
  };

  const handleCustomerSelect = async (customerId) => {
    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      const customer = customers.find(c => c.id === customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }
      setSelectedCustomer(customer);

      // Validate required data
      if (!customer.dates || !customer.engagement_score) {
        throw new Error('Customer data is incomplete');
      }

      const anomalyResponse = await API.detectAnomalies({
        dates: customer.dates,
        scores: customer.engagement_score
      });

      setData({
        dates: customer.dates,
        engagement_score: customer.engagement_score,
        anomalies: anomalyResponse.anomalies
      });

    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Customer Engagement Analytics</h2>
      
      <div style={{ marginBottom: '2rem' }}>
        <label htmlFor="customer-select" style={{ marginRight: '1rem' }}>
          Select Customer:
        </label>
        <select
          id="customer-select"
          onChange={(e) => handleCustomerSelect(e.target.value)}
          value={selectedCustomer?.id || ''}
          style={{ padding: '0.5rem' }}
        >
          <option value="">Choose a customer...</option>
          {customers.map(customer => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div>Loading...</div>
      )}

      {error && (
        <div role="alert" style={{ color: '#d32f2f', marginBottom: '1rem', padding: '1rem', backgroundColor: '#ffebee', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {selectedCustomer && (
        <div style={{ marginBottom: '2rem' }}>
          <h3>Customer Information</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li><strong>Name:</strong> {selectedCustomer.name}</li>
            <li><strong>ID:</strong> {selectedCustomer.id}</li>
            <li><strong>Email:</strong> {selectedCustomer.email || 'N/A'}</li>
            <li><strong>Subscription:</strong> {selectedCustomer.subscription_type || 'N/A'}</li>
          </ul>
        </div>
      )}

      {data && (
        <div>
          <h3>Engagement Analysis</h3>
          <ErrorBoundary>
            <ChartComponent data={data} />
          </ErrorBoundary>
          
          <div style={{ marginTop: '1rem' }}>
            <CSVLink
              data={data.dates.map((d, i) => ({
                date: d,
                score: data.engagement_score[i],
                anomaly: data.anomalies[i] ? 'Yes' : 'No',
              }))}
              filename={`${selectedCustomer.name}-engagement.csv`}
              className="btn"
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#2e7d32',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Export CSV
            </CSVLink>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerAnalytics; 