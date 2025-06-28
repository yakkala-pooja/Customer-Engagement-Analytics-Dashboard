import React, { useState, useEffect } from 'react';
import API from '../services/api';

const AlertsPanel = ({ customerId, customerName }) => {
  const [alertConfig, setAlertConfig] = useState({
    enabled: false,
    email_recipients: [],
    thresholds: {
      warning_threshold: 0.15,
      critical_threshold: 0.30,
      min_anomaly_points: 3,
      cooldown_minutes: 60
    }
  });
  const [newEmail, setNewEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [alertHistory, setAlertHistory] = useState([]);

  useEffect(() => {
    if (customerId) {
      fetchAlertConfig();
      fetchAlertHistory();
    }
  }, [customerId]);

  const fetchAlertConfig = async () => {
    try {
      setIsLoading(true);
      const config = await API.getAlertConfig(customerId);
      setAlertConfig(config);
    } catch (err) {
      console.error('Error fetching alert config:', err);
      setMessage({ type: 'error', text: 'Failed to load alert configuration.' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAlertHistory = async () => {
    try {
      const history = await API.getAlertHistory(customerId);
      setAlertHistory(history);
    } catch (err) {
      console.error('Error fetching alert history:', err);
    }
  };

  const saveAlertConfig = async () => {
    try {
      setIsLoading(true);
      await API.setAlertConfig(customerId, alertConfig);
      setMessage({ type: 'success', text: 'Alert configuration saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error('Error saving alert config:', err);
      setMessage({ type: 'error', text: 'Failed to save alert configuration.' });
    } finally {
      setIsLoading(false);
    }
  };

  const addEmailRecipient = () => {
    if (newEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      if (!alertConfig.email_recipients.includes(newEmail)) {
        setAlertConfig({
          ...alertConfig,
          email_recipients: [...alertConfig.email_recipients, newEmail]
        });
        setNewEmail('');
      } else {
        setMessage({ type: 'error', text: 'Email already added.' });
        setTimeout(() => setMessage(null), 3000);
      }
    } else {
      setMessage({ type: 'error', text: 'Please enter a valid email address.' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const removeEmailRecipient = (email) => {
    setAlertConfig({
      ...alertConfig,
      email_recipients: alertConfig.email_recipients.filter(e => e !== email)
    });
  };

  const handleThresholdChange = (field, value) => {
    setAlertConfig({
      ...alertConfig,
      thresholds: {
        ...alertConfig.thresholds,
        [field]: value
      }
    });
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Alert Configuration {customerName ? `for ${customerName}` : ''}</h3>
      </div>
      <div className="card-body">
        {isLoading ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : (
          <>
            {message && (
              <div className={`alert ${message.type === 'error' ? 'alert-error' : 'alert-success'}`}>
                {message.text}
              </div>
            )}
            
            <div className="form-group">
              <label className="form-label">
                <input 
                  type="checkbox" 
                  checked={alertConfig.enabled} 
                  onChange={e => setAlertConfig({...alertConfig, enabled: e.target.checked})}
                  className="mr-sm"
                />
                Enable Anomaly Alerts
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">Email Recipients</label>
              <div className="flex gap-sm">
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="form-control"
                />
                <button 
                  onClick={addEmailRecipient}
                  className="btn"
                  type="button"
                >
                  Add
                </button>
              </div>
              {alertConfig.email_recipients.length > 0 && (
                <div className="email-list mt-sm">
                  {alertConfig.email_recipients.map((email, index) => (
                    <div key={index} className="email-tag">
                      {email}
                      <button 
                        onClick={() => removeEmailRecipient(email)}
                        className="email-remove"
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Warning Threshold (%)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={alertConfig.thresholds.warning_threshold * 100}
                onChange={e => handleThresholdChange('warning_threshold', parseFloat(e.target.value) / 100)}
                className="form-control"
              />
              <small className="form-text">Percentage of anomalies to trigger a warning alert</small>
            </div>

            <div className="form-group">
              <label className="form-label">Critical Threshold (%)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={alertConfig.thresholds.critical_threshold * 100}
                onChange={e => handleThresholdChange('critical_threshold', parseFloat(e.target.value) / 100)}
                className="form-control"
              />
              <small className="form-text">Percentage of anomalies to trigger a critical alert</small>
            </div>

            <div className="form-group">
              <label className="form-label">Minimum Anomaly Points</label>
              <input
                type="number"
                min="1"
                value={alertConfig.thresholds.min_anomaly_points}
                onChange={e => handleThresholdChange('min_anomaly_points', parseInt(e.target.value))}
                className="form-control"
              />
              <small className="form-text">Minimum number of anomaly points required to trigger an alert</small>
            </div>

            <div className="form-group">
              <label className="form-label">Cooldown Period (minutes)</label>
              <input
                type="number"
                min="1"
                value={alertConfig.thresholds.cooldown_minutes}
                onChange={e => handleThresholdChange('cooldown_minutes', parseInt(e.target.value))}
                className="form-control"
              />
              <small className="form-text">Minimum time between alerts</small>
            </div>

            <button 
              onClick={saveAlertConfig}
              className="btn"
              disabled={isLoading}
            >
              Save Configuration
            </button>
          </>
        )}
      </div>

      {alertHistory.length > 0 && (
        <div className="mt-lg">
          <div className="section-header">
            <h4>Alert History</h4>
          </div>
          <div className="alert-history">
            {alertHistory.map((alert, index) => (
              <div key={index} className={`alert-item ${alert.severity === 'critical' ? 'alert-critical' : 'alert-warning'}`}>
                <div className="alert-time">{formatDate(alert.timestamp)}</div>
                <div className="alert-message">{alert.message}</div>
                <div className="alert-severity">{alert.severity}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertsPanel; 