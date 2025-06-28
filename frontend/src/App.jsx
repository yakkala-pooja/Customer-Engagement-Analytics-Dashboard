import React, { useState } from 'react';
import CustomerAnalytics from './components/CustomerAnalytics';
import RedditAnalytics from './components/RedditAnalytics';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('customers');

  return (
    <div className="app">
      <header className="app-header">
        <div className="container">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold">
              <span className="text-primary">Customer</span> Engagement Dashboard
            </h1>
            <nav className="main-nav">
              <button
                onClick={() => setActiveTab('customers')}
                className={`nav-link ${activeTab === 'customers' ? 'active' : ''}`}
              >
                <i className="icon">📊</i>
                Customer Analytics
              </button>
              <button
                onClick={() => setActiveTab('reddit')}
                className={`nav-link ${activeTab === 'reddit' ? 'active' : ''}`}
              >
                <i className="icon">🌐</i>
                Reddit Analytics
              </button>
            </nav>
          </div>
        </div>
      </header>
      
      <main className="app-main container">
        <div className="content-wrapper">
          {activeTab === 'customers' ? (
            <CustomerAnalytics />
          ) : (
            <RedditAnalytics />
          )}
        </div>
      </main>
      
      <footer className="app-footer">
        <div className="container">
          <p className="text-center text-sm">
            &copy; {new Date().getFullYear()} Customer Engagement Dashboard
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
