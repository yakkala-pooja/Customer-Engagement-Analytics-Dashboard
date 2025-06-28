# 📊 Customer Engagement Dashboard

> *Transforming data into actionable insights with AI-powered anomaly detection*

A comprehensive analytics platform for monitoring customer engagement metrics and social media sentiment with real-time anomaly detection and alerting capabilities.

![Dashboard Preview](https://via.placeholder.com/800x400?text=Customer+Engagement+Dashboard)

## ✨ Key Features

- **🔍 Anomaly Detection** - AI-powered identification of unusual patterns in engagement data
- **📱 Multi-source Analytics** - Unified view of customer and Reddit community metrics
- **📈 Interactive Visualizations** - Dynamic charts with connected data points and anomaly highlighting
- **🔔 Smart Alerts** - Configurable email notifications when anomalies are detected
- **📊 Data Export** - One-click CSV exports for further analysis
- **🌙 Light/Dark Mode** - Automatic theme switching based on system preferences

## 🧠 Smart Anomaly Detection

The platform uses advanced machine learning algorithms (Isolation Forest) to identify unusual patterns in engagement data that might indicate opportunities or issues requiring attention.

```
Customer engagement spikes on April 15 detected
⚠️ 30% higher than normal activity
📧 Alert sent to team@company.com
```

## 🚀 Project Architecture

The application consists of three main components working together seamlessly:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  React Frontend │────▶│  Express.js API │────▶│  FastAPI Engine │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ▲                       ▲                       ▲
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Interactive   │     │  Customer Data  │     │ ML Models and   │
│    UI/UX        │     │    Services     │     │ Data Processing │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Frontend (React + Vite)
- Modern, responsive UI with component-based architecture
- Real-time data visualization with Chart.js
- Modal-based detailed views for deeper analysis

### Backend (Node.js)
- RESTful API for customer data
- Integration with Azure Anomaly Detector
- Scheduled tasks and email notifications

### Anomaly Engine (Python)
- FastAPI service for high-performance anomaly detection
- Reddit API integration for social sentiment analysis
- Prometheus metrics for system monitoring

## 🔧 Tech Stack

### Frontend
- **React 19** - Latest React features with hooks and functional components
- **Chart.js & Recharts** - Beautiful, responsive data visualizations
- **Vite** - Lightning-fast build tooling and HMR

### Backend
- **Express.js** - Robust, scalable API framework
- **Azure Anomaly Detector** - Cloud-based anomaly detection
- **Node-cron** - Scheduled tasks and alerts
- **Nodemailer** - Email notification system

### Anomaly Backend
- **FastAPI** - High-performance Python web framework
- **scikit-learn** - Machine learning algorithms
- **Pandas** - Data processing and analysis
- **PRAW** - Reddit API wrapper for Python

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- npm or yarn

### Quick Start

1. **Clone and Install**
   ```bash
   git clone https://github.com/yourusername/customer-engagement-dashboard.git
   cd customer-engagement-dashboard
   
   # Setup Node.js backend
   cd backend && npm install
   
   # Setup React frontend
   cd ../frontend && npm install
   
   # Setup Python anomaly detection backend
   cd ../anomaly-backend
   python -m venv ../anomaly-env
   source ../anomaly-env/bin/activate  # On Windows: ..\anomaly-env\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Configure Environment**
   Create a `.env` file in the `anomaly-backend` directory:
   ```
   DATA_DIR=data
   SAMPLE_DATA_FILE=sampleData.json
   ALLOWED_ORIGINS=http://localhost:5173
   API_KEY=your_api_key
   REDDIT_CLIENT_ID=your_reddit_client_id
   REDDIT_CLIENT_SECRET=your_reddit_client_secret
   ```

3. **Start the Services**
   ```bash
   # Terminal 1: Start the Node.js backend
   cd backend && node server.js
   
   # Terminal 2: Start the anomaly detection backend
   cd anomaly-backend && uvicorn main:app --reload
   
   # Terminal 3: Start the frontend
   cd frontend && npm run dev
   ```

4. **Open your browser** and navigate to `http://localhost:5173`

## 📱 Usage Examples

### Customer Engagement Analysis
1. Select a customer from the dropdown
2. View their engagement metrics and anomaly patterns
3. Configure alert thresholds for automatic notifications
4. Export data for reporting

### Reddit Community Analysis
1. Enter a subreddit name and timeframe
2. Analyze community engagement metrics and sentiment
3. Click on posts to view detailed information
4. Set up alerts for unusual community activity

## 🔒 Security Features

- API key authentication
- Rate limiting and throttling
- Security headers implementation
- Input validation and sanitization

## 📈 Future Roadmap

- [ ] Sentiment analysis for customer feedback
- [ ] Integration with additional social platforms
- [ ] Advanced anomaly classification
- [ ] Mobile app with push notifications
- [ ] Custom dashboard layouts

## 📄 License

This project is licensed under the ISC License.

---

<p align="center">
  Made with ❤️ for data-driven decisions
</p> 