import React, { useState, useEffect } from 'react';
import API from '../services/api';
import ChartComponent from './ChartComponent';
import ErrorBoundary from './ErrorBoundary';
import AlertsPanel from './AlertsPanel';
import { CSVLink } from 'react-csv';

function Dashboard() {
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [anomalyData, setAnomalyData] = useState(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchCustomers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await API.getCustomers();
        if (isMounted) {
          setCustomers(data);
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to fetch customers. Please try again later.');
          console.error('Error fetching customers:', err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchCustomers();
    return () => {
      isMounted = false;
    };
  }, []);

  const onCustomerSelect = async (e) => {
    setError(null);
    setIsLoading(true);
    setAnomalyData(null);
    
    const cust = customers.find(c => c.id === e.target.value);
    if (!cust) {
      setSelected(null);
      setIsLoading(false);
      return;
    }

    console.log('Selected customer data:', cust);
    setSelected(cust);

    try {
      const requestData = {
        dates: cust.dates,
        scores: cust.engagement_score,
      };
      console.log('Sending data to API:', requestData);
      
      const response = await API.detectAnomalies(requestData, cust.id);
      console.log('Raw API Response:', response);
      
      setAnomalyData(response);

      // Log the prepared chart data
      const preparedData = {
        ...cust,
        anomalies: response.anomalies
      };
      console.log('Prepared chart data:', preparedData);
    } catch (error) {
      console.error('Error detecting anomalies:', error);
      setError('Failed to analyze customer data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Prepare data for chart
  const chartData = selected && anomalyData ? {
    id: selected.id,
    name: selected.name,
    email: selected.email,
    subscription_type: selected.subscription_type,
    dates: selected.dates,
    engagement_score: selected.engagement_score,
    anomalies: anomalyData.anomalies || []
  } : null;

  console.log('Final chart data:', chartData);

  return (
    <div style={{ padding: '2rem' }}>
      <h1>
        <span role="img" aria-label="Dashboard">📊</span>
        {' '}Customer Engagement Dashboard
      </h1>

      <div className="form-group">
        <label htmlFor="customer-select">Select a customer:</label>
        <select
          id="customer-select"
          onChange={onCustomerSelect}
          style={{ marginBottom: '1rem', padding: '0.5rem' }}
          defaultValue=""
          disabled={isLoading}
        >
          <option value="">Select Customer</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div role="alert" aria-busy="true">
          Loading...
        </div>
      )}

      {error && (
        <div role="alert" style={{ color: '#d32f2f', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {selected && (
        <div>
          <div className="customer-info" style={{ marginBottom: '2rem' }}>
            <h2>Customer Information</h2>
            <p><strong>Name:</strong> {selected.name}</p>
            <p><strong>ID:</strong> {selected.id}</p>
            <p><strong>Email:</strong> {selected.email}</p>
            <p><strong>Subscription:</strong> {selected.subscription_type}</p>
          </div>

          {!chartData && !error && !isLoading && (
            <div>Analyzing customer data...</div>
          )}

          {chartData && !isLoading && (
            <>
              <ErrorBoundary>
                <ChartComponent data={chartData} />
              </ErrorBoundary>

              <div style={{ marginTop: '1rem' }}>
                <CSVLink
                  data={chartData.dates.map((d, i) => ({
                    date: d,
                    score: chartData.engagement_score[i],
                    anomaly: chartData.anomalies[i],
                  }))}
                  filename="engagement.csv"
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
            </>
          )}

          <ErrorBoundary>
            <AlertsPanel customerId={selected.id} />
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
