import React, { useState } from 'react';
import API from '../services/api';
import ChartComponent from './ChartComponent';
import ErrorBoundary from './ErrorBoundary';
import { CSVLink } from 'react-csv';

const RedditAnalytics = () => {
  const [subreddit, setSubreddit] = useState('');
  const [timeframe, setTimeframe] = useState('week');
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [anomalyData, setAnomalyData] = useState(null);
  const [chartKey, setChartKey] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setData(null);
    setAnomalyData(null);
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

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Reddit Engagement Analytics</h2>
      
      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="subreddit" style={{ marginRight: '1rem' }}>
            Subreddit:
          </label>
          <input
            id="subreddit"
            type="text"
            value={subreddit}
            onChange={(e) => setSubreddit(e.target.value.trim())}
            placeholder="e.g., programming"
            required
            style={{ padding: '0.5rem' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="timeframe" style={{ marginRight: '1rem' }}>
            Timeframe:
          </label>
          <select
            id="timeframe"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            style={{ padding: '0.5rem' }}
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
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'wait' : 'pointer',
          }}
        >
          {isLoading ? 'Loading...' : 'Analyze'}
        </button>
      </form>

      {error && (
        <div role="alert" style={{ color: '#d32f2f', marginBottom: '1rem', padding: '1rem', backgroundColor: '#ffebee', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {data && (
        <div style={{ marginBottom: '2rem' }}>
          <h3>Subreddit Statistics</h3>
          <ul>
            <li>Subscribers: {formatNumber(data.metadata.subscribers)}</li>
            <li>Active Users: {formatNumber(data.metadata.active_users)}</li>
            <li>Total Posts Analyzed: {formatNumber(data.post_count)}</li>
            <li>Average Score: {formatNumber(Math.round(data.average_score))}</li>
            <li>Average Comments: {formatNumber(Math.round(data.average_comments))}</li>
          </ul>

          {data.top_posts && data.top_posts.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h4>Top Posts</h4>
              <ul>
                {data.top_posts.map((post, index) => (
                  <li key={index}>
                    <div>
                      <strong>{post.title}</strong>
                    </div>
                    <div style={{ fontSize: '0.9em', color: '#666' }}>
                      Score: {formatNumber(post.score)} | Comments: {formatNumber(post.comments)} | Posted: {formatDate(post.created_utc)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {anomalyData && (
        <div>
          <h3>Engagement Anomaly Analysis</h3>
          <div style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '1rem', marginBottom: '1rem' }}>
            <ErrorBoundary>
              <ChartComponent key={chartKey} data={anomalyData} />
            </ErrorBoundary>
          </div>
          
          <div style={{ marginTop: '1rem' }}>
            <CSVLink
              data={anomalyData.dates.map((d, i) => ({
                date: formatDate(d),
                score: anomalyData.engagement_score[i],
                anomaly: anomalyData.anomalies[i] ? 'Yes' : 'No',
              }))}
              filename={`${subreddit}-engagement.csv`}
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

export default RedditAnalytics; 