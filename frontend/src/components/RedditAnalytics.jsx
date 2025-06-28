import React, { useState } from 'react';
import API from '../services/api';
import ChartComponent from './ChartComponent';
import ErrorBoundary from './ErrorBoundary';
import AlertsPanel from './AlertsPanel';
import Modal from './ui/Modal';
import { CSVLink } from 'react-csv';

const RedditAnalytics = () => {
  const [subreddit, setSubreddit] = useState('');
  const [timeframe, setTimeframe] = useState('week');
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [anomalyData, setAnomalyData] = useState(null);
  const [chartKey, setChartKey] = useState(0);
  const [showAlerts, setShowAlerts] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setData(null);
    setAnomalyData(null);
    setShowAlerts(false);
    setSelectedPost(null);
    setChartKey(prev => prev + 1);

    try {
      // Fetch Reddit metrics
      const redditData = await API.getRedditMetrics(subreddit, timeframe);
      setData(redditData);

      // Check if we have enough data for anomaly detection
      if (!redditData || !redditData.top_posts || redditData.top_posts.length === 0) {
        throw new Error('No posts available for analysis');
      }

      if (redditData.warning) {
        setError(redditData.warning);
        return;
      }

      // Prepare data for anomaly detection
      const posts = redditData.top_posts;
      
      // Ensure dates are valid
      const dates = posts.map(post => {
        const date = new Date(post.created_utc);
        if (isNaN(date.getTime())) {
          throw new Error('Invalid date received from server');
        }
        return post.created_utc;
      });
      
      const scores = posts.map(post => post.score);

      if (scores.some(score => typeof score !== 'number')) {
        setError('Invalid score data received');
        return;
      }

      // Detect anomalies in post scores
      const anomalyResponse = await API.detectAnomalies({
        dates,
        scores,
      });

      if (!anomalyResponse || !Array.isArray(anomalyResponse.anomalies)) {
        setError('Invalid anomaly detection response');
        return;
      }

      // Sort data chronologically
      const sortedIndices = dates.map((_, i) => i).sort((a, b) => new Date(dates[a]) - new Date(dates[b]));
      const sortedDates = sortedIndices.map(i => dates[i]);
      const sortedScores = sortedIndices.map(i => scores[i]);
      const sortedAnomalies = sortedIndices.map(i => anomalyResponse.anomalies[i]);

      // Combine data for visualization
      const chartData = {
        dates: sortedDates,
        engagement_score: sortedScores,
        anomalies: sortedAnomalies
      };

      setAnomalyData(chartData);

    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      console.error('Error formatting date:', e);
      return dateString;
    }
  };

  const toggleAlerts = () => {
    setShowAlerts(!showAlerts);
  };

  // Generate a consistent ID for the subreddit
  const getSubredditId = () => {
    return `reddit-${subreddit}`;
  };

  const handlePostClick = (post) => {
    setSelectedPost(post);
    setShowPostModal(true);
  };

  const closePostModal = () => {
    setShowPostModal(false);
  };

  return (
    <div>
      <h2 className="text-xl mb-lg">Reddit Engagement Analytics</h2>
      
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Search Subreddit</h3>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="subreddit" className="form-label">
                Subreddit Name:
              </label>
              <input
                id="subreddit"
                type="text"
                className="form-control"
                value={subreddit}
                onChange={(e) => setSubreddit(e.target.value.trim())}
                placeholder="e.g., programming"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="timeframe" className="form-label">
                Timeframe:
              </label>
              <select
                id="timeframe"
                className="form-control"
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
              >
                <option value="day">Last 24 hours</option>
                <option value="week">Last week</option>
                <option value="month">Last month</option>
                <option value="year">Last year</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn"
            >
              {isLoading ? 'Loading...' : 'Analyze'}
            </button>
          </form>
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

      {data && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">r/{data.metadata.subreddit} Statistics</h3>
          </div>
          <div className="card-body">
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{formatNumber(data.metadata.subscribers)}</div>
                <div className="stat-label">Subscribers</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{formatNumber(data.metadata.active_users)}</div>
                <div className="stat-label">Active Users</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{formatDate(data.metadata.created_utc).split(',')[0]}</div>
                <div className="stat-label">Created</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{formatNumber(data.post_count)}</div>
                <div className="stat-label">Posts Analyzed</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{formatNumber(Math.round(data.average_score))}</div>
                <div className="stat-label">Average Score</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{formatNumber(Math.round(data.average_comments))}</div>
                <div className="stat-label">Average Comments</div>
              </div>
            </div>

            {data.top_posts && data.top_posts.length > 0 && (
              <div>
                <div className="section-header">
                  <h4>Top Posts</h4>
                </div>
                <div className="post-list">
                  {data.top_posts.slice(0, 5).map((post, index) => (
                    <div 
                      key={index} 
                      className="post-item"
                      onClick={() => handlePostClick(post)}
                      style={{ cursor: 'pointer' }}
                    >
                      <h5 className="post-title">
                        {post.title}
                      </h5>
                      <div className="post-meta">
                        <span className="post-score">{formatNumber(post.score)}</span>
                        <span className="post-comments">{formatNumber(post.comments)}</span>
                        <span className="post-date">{formatDate(post.created_utc)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {anomalyData && (
        <>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Engagement Anomaly Analysis</h3>
            </div>
            <div className="card-body">
              <ErrorBoundary>
                <ChartComponent key={chartKey} data={anomalyData} />
              </ErrorBoundary>
            </div>
            <div className="card-footer">
              <div className="flex justify-between">
                <CSVLink
                  data={anomalyData.dates.map((d, i) => ({
                    date: formatDate(d),
                    score: anomalyData.engagement_score[i],
                    anomaly: anomalyData.anomalies[i] ? 'Yes' : 'No',
                  }))}
                  filename={`${subreddit}-engagement.csv`}
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

          {showAlerts && subreddit && (
            <AlertsPanel 
              customerId={getSubredditId()} 
              customerName={`r/${subreddit}`}
            />
          )}
        </>
      )}

      {/* Post Detail Modal */}
      <Modal 
        isOpen={showPostModal} 
        onClose={closePostModal}
        title={`Post from r/${subreddit}`}
      >
        {selectedPost && (
          <div className="post-detail">
            <div className="post-detail-header">
              <h2 className="post-detail-title">{selectedPost.title}</h2>
            </div>
            
            <div className="post-detail-meta">
              <div className="post-detail-meta-item">
                <span>📅</span>
                <span>Posted: {formatDate(selectedPost.created_utc)}</span>
              </div>
              <div className="post-detail-meta-item">
                <span>⬆️</span>
                <span>Score: {formatNumber(selectedPost.score)}</span>
              </div>
              <div className="post-detail-meta-item">
                <span>💬</span>
                <span>Comments: {formatNumber(selectedPost.comments)}</span>
              </div>
            </div>
            
            {selectedPost.url && (
              <div className="post-detail-actions">
                <a 
                  href={selectedPost.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="post-detail-link"
                >
                  <span>🔗</span>
                  <span>View on Reddit</span>
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RedditAnalytics; 