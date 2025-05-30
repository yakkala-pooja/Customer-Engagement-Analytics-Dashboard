import React, { useState, useEffect } from 'react';
import API from '../services/api';

function AlertsPanel({ customerId }) {
  const [alertHistory, setAlertHistory] = useState([]);
  const [alertConfig, setAlertConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editConfig, setEditConfig] = useState(null);

  useEffect(() => {
    if (customerId) {
      fetchAlertData();
    }
  }, [customerId]);

  const fetchAlertData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [history, config] = await Promise.all([
        API.getAlertHistory(customerId),
        API.getAlertConfig(customerId)
      ]);
      setAlertHistory(history);
      setAlertConfig(config);
      setEditConfig(config);
    } catch (err) {
      setError('Failed to fetch alert data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigUpdate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const updatedConfig = await API.updateAlertConfig(customerId, editConfig);
      setAlertConfig(updatedConfig);
      setIsEditing(false);
    } catch (err) {
      setError('Failed to update alert configuration');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div>Loading alert data...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="alerts-panel">
      <h2>Alert Settings</h2>
      
      {/* Alert Configuration */}
      <div className="alert-config">
        <h3>Alert Configuration</h3>
        {alertConfig && !isEditing ? (
          <>
            <div className="config-display">
              <p>
                <strong>Status:</strong> {alertConfig.enabled ? 'Enabled' : 'Disabled'}
              </p>
              <p>
                <strong>Warning Threshold:</strong> {alertConfig.thresholds.warning_threshold * 100}%
              </p>
              <p>
                <strong>Critical Threshold:</strong> {alertConfig.thresholds.critical_threshold * 100}%
              </p>
              <p>
                <strong>Recipients:</strong> {alertConfig.email_recipients.join(', ')}
              </p>
              <button 
                onClick={() => setIsEditing(true)}
                className="btn-edit"
              >
                Edit Configuration
              </button>
            </div>
          </>
        ) : alertConfig && isEditing ? (
          <div className="config-form">
            <label>
              <input
                type="checkbox"
                checked={editConfig.enabled}
                onChange={(e) => setEditConfig({
                  ...editConfig,
                  enabled: e.target.checked
                })}
              />
              Enable Alerts
            </label>
            
            <label>
              Warning Threshold (%)
              <input
                type="number"
                min="0"
                max="100"
                value={editConfig.thresholds.warning_threshold * 100}
                onChange={(e) => setEditConfig({
                  ...editConfig,
                  thresholds: {
                    ...editConfig.thresholds,
                    warning_threshold: e.target.value / 100
                  }
                })}
              />
            </label>
            
            <label>
              Critical Threshold (%)
              <input
                type="number"
                min="0"
                max="100"
                value={editConfig.thresholds.critical_threshold * 100}
                onChange={(e) => setEditConfig({
                  ...editConfig,
                  thresholds: {
                    ...editConfig.thresholds,
                    critical_threshold: e.target.value / 100
                  }
                })}
              />
            </label>
            
            <label>
              Email Recipients (comma-separated)
              <input
                type="text"
                value={editConfig.email_recipients.join(', ')}
                onChange={(e) => setEditConfig({
                  ...editConfig,
                  email_recipients: e.target.value.split(',').map(email => email.trim())
                })}
              />
            </label>
            
            <div className="button-group">
              <button 
                onClick={handleConfigUpdate}
                className="btn-save"
                disabled={isLoading}
              >
                Save Changes
              </button>
              <button 
                onClick={() => {
                  setIsEditing(false);
                  setEditConfig(alertConfig);
                }}
                className="btn-cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p>No alert configuration found</p>
        )}
      </div>

      {/* Alert History */}
      <div className="alert-history">
        <h3>Alert History</h3>
        {alertHistory.length > 0 ? (
          <div className="history-list">
            {alertHistory.map((alert, index) => (
              <div 
                key={index} 
                className={`alert-item ${alert.severity}`}
              >
                <div className="alert-header">
                  <span className="severity">{alert.severity.toUpperCase()}</span>
                  <span className="timestamp">
                    {new Date(alert.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="alert-details">
                  <p><strong>Anomaly Percentage:</strong> {alert.details.anomaly_percentage}%</p>
                  <p><strong>Anomaly Count:</strong> {alert.details.anomaly_count}</p>
                  <p><strong>Total Points:</strong> {alert.details.total_points}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No alert history found</p>
        )}
      </div>

      <style jsx>{`
        .alerts-panel {
          padding: 1rem;
          background: #f5f5f5;
          border-radius: 8px;
          margin-top: 2rem;
        }

        .alert-config, .alert-history {
          margin-top: 1rem;
          padding: 1rem;
          background: white;
          border-radius: 4px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .config-form label {
          display: block;
          margin: 1rem 0;
        }

        .config-form input[type="number"],
        .config-form input[type="text"] {
          width: 100%;
          padding: 0.5rem;
          margin-top: 0.25rem;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .button-group {
          margin-top: 1rem;
          display: flex;
          gap: 1rem;
        }

        .btn-save, .btn-edit {
          background: #2e7d32;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
        }

        .btn-cancel {
          background: #666;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
        }

        .history-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .alert-item {
          margin: 0.5rem 0;
          padding: 1rem;
          border-radius: 4px;
          border-left: 4px solid;
        }

        .alert-item.warning {
          background: #fff3e0;
          border-left-color: #ff9800;
        }

        .alert-item.critical {
          background: #fdecea;
          border-left-color: #f44336;
        }

        .alert-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .severity {
          font-weight: bold;
        }

        .timestamp {
          color: #666;
          font-size: 0.9em;
        }

        .error {
          color: #d32f2f;
          padding: 1rem;
          background: #fdecea;
          border-radius: 4px;
          margin: 1rem 0;
        }
      `}</style>
    </div>
  );
}

export default AlertsPanel; 