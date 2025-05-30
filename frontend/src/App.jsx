import React, { useState } from 'react';
import CustomerAnalytics from './components/CustomerAnalytics';
import RedditAnalytics from './components/RedditAnalytics';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('customers');

  return (
    <div className="App">
      <header className="App-header">
        <h1>Customer Engagement Dashboard</h1>
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => setActiveTab('customers')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: activeTab === 'customers' ? '#1976d2' : '#e0e0e0',
              color: activeTab === 'customers' ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              marginRight: '1rem',
              cursor: 'pointer',
            }}
          >
            Customer Analytics
          </button>
          <button
            onClick={() => setActiveTab('reddit')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: activeTab === 'reddit' ? '#1976d2' : '#e0e0e0',
              color: activeTab === 'reddit' ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Reddit Analytics
          </button>
        </div>
      </header>
      <main>
        {activeTab === 'customers' ? (
          <CustomerAnalytics />
        ) : (
          <RedditAnalytics />
        )}
      </main>
    </div>
  );
}

export default App;
