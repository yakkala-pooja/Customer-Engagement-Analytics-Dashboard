import React, { useState, useEffect } from 'react';
import API from '../services/api';
import ChartComponent from './ChartComponent';
import ErrorBoundary from './ErrorBoundary';
import AlertsPanel from './AlertsPanel';
import { CSVLink } from 'react-csv';

const CustomerAnalytics = () => {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAlerts, setShowAlerts] = useState(false);

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
    setShowAlerts(false);

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

  const toggleAlerts = () => {
    setShowAlerts(!showAlerts);
  };

  return (
    <div>
      <h2 className="text-xl mb-lg">Customer Engagement Analytics</h2>
      
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Select Customer</h3>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label htmlFor="customer-select" className="form-label">
              Choose a customer to analyze:
            </label>
            <select
              id="customer-select"
              className="form-control"
              onChange={(e) => handleCustomerSelect(e.target.value)}
              value={selectedCustomer?.id || ''}
            >
              <option value="">Select a customer...</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      )}

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {selectedCustomer && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Customer Information</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2">
              <div>
                <p><strong>Name:</strong> {selectedCustomer.name}</p>
                <p><strong>ID:</strong> {selectedCustomer.id}</p>
              </div>
              <div>
                <p><strong>Email:</strong> {selectedCustomer.email || 'N/A'}</p>
                <p><strong>Subscription:</strong> {selectedCustomer.subscription_type || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {data && (
        <>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Engagement Analysis</h3>
            </div>
            <div className="card-body">
              <ErrorBoundary>
                <ChartComponent data={data} />
              </ErrorBoundary>
            </div>
            <div className="card-footer">
              <div className="flex justify-between">
                <CSVLink
                  data={data.dates.map((d, i) => ({
                    date: d,
                    score: data.engagement_score[i],
                    anomaly: data.anomalies[i] ? 'Yes' : 'No',
                  }))}
                  filename={`${selectedCustomer.name}-engagement.csv`}
                  className="btn"
                >
                  Export CSV
                </CSVLink>
                
                <button 
                  onClick={toggleAlerts}
                  className="btn-secondary btn"
                >
                  {showAlerts ? 'Hide Alerts' : 'Configure Alerts'}
                </button>
              </div>
            </div>
          </div>

          {showAlerts && selectedCustomer && (
            <AlertsPanel 
              customerId={selectedCustomer.id} 
              customerName={selectedCustomer.name}
            />
          )}
        </>
      )}
    </div>
  );
};

export default CustomerAnalytics; 