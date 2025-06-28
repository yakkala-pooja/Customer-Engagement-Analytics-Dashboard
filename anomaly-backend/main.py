from fastapi import FastAPI, HTTPException, Request, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from pydantic import BaseModel, field_validator, ConfigDict
from typing import List, Optional, Dict, Any, Union
import pandas as pd
from dotenv import load_dotenv
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from contextlib import asynccontextmanager
import json
import logging
import os
import time
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
import secrets
import asyncio
import hashlib
import praw
from prometheus_client import Counter, Histogram, start_http_server, CollectorRegistry, REGISTRY
from cachetools import TTLCache
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Initialize start time for uptime calculation
start_time = time.time()

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
DATA_DIR = os.getenv('DATA_DIR', 'data')
SAMPLE_DATA_FILE = os.getenv('SAMPLE_DATA_FILE', 'sampleData.json')
ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', 'http://localhost:5173').split(',')
API_KEY = os.getenv('API_KEY', 'rIV08bJX2rEKoCeu9fGHd7XVwQkcxA')
RATE_LIMIT_PER_MINUTE = int(os.getenv('RATE_LIMIT_PER_MINUTE', 60))
MODEL_N_ESTIMATORS = int(os.getenv('MODEL_N_ESTIMATORS', 100))
MODEL_CONTAMINATION = float(os.getenv('MODEL_CONTAMINATION', 0.2))
MODEL_RANDOM_STATE = int(os.getenv('MODEL_RANDOM_STATE', 42))
CACHE_TTL = int(os.getenv('CACHE_TTL', 300))  # 5 minutes cache
METRICS_PORT = int(os.getenv('METRICS_PORT', 9090))

# Reddit API Configuration
REDDIT_CLIENT_ID = os.getenv('REDDIT_CLIENT_ID', '')
REDDIT_CLIENT_SECRET = os.getenv('REDDIT_CLIENT_SECRET', '')
REDDIT_USER_AGENT = os.getenv('REDDIT_USER_AGENT', 'CustomerEngagementBot/1.0')

# Initialize Reddit client
reddit = praw.Reddit(
    client_id=REDDIT_CLIENT_ID,
    client_secret=REDDIT_CLIENT_SECRET,
    user_agent=REDDIT_USER_AGENT
)

# Create a custom registry for Prometheus metrics
custom_registry = CollectorRegistry()

# Prometheus metrics
REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'], registry=custom_registry)
REQUEST_LATENCY = Histogram('http_request_duration_seconds', 'HTTP request latency', ['method', 'endpoint'], registry=custom_registry)
ANOMALY_DETECTION_COUNT = Counter('anomaly_detection_total', 'Total anomaly detection requests', registry=custom_registry)
CACHE_HIT_COUNT = Counter('cache_hits_total', 'Total cache hits', registry=custom_registry)
CACHE_MISS_COUNT = Counter('cache_misses_total', 'Total cache misses', registry=custom_registry)

# Start Prometheus metrics server with custom registry
start_http_server(METRICS_PORT, registry=custom_registry)

# Caching
results_cache = TTLCache(maxsize=100, ttl=CACHE_TTL)

# Alert configurations
alert_configs = {}

# Rate limiting and throttling
class ThrottlingState:
    def __init__(self):
        self.requests = {}
        self.tokens = {}

    def get_tokens(self, key: str) -> float:
        return self.tokens.get(key, RATE_LIMIT_PER_MINUTE)

    def update_tokens(self, key: str, tokens: float):
        self.tokens[key] = min(RATE_LIMIT_PER_MINUTE, tokens)

throttling = ThrottlingState()

# Security headers
SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
}

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        for key, value in SECURITY_HEADERS.items():
            response.headers[key] = value
        return response

# Request logging and throttling middleware
class RequestMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Get client IP
        client_ip = request.headers.get("X-Forwarded-For", request.client.host).split(",")[0]
        path = request.url.path
        method = request.method

        # Throttling logic
        now = time.time()
        key = f"{client_ip}:{path}"
        
        # Token bucket algorithm
        last_time = throttling.requests.get(key, 0)
        time_passed = now - last_time
        tokens = throttling.get_tokens(key) + time_passed * (RATE_LIMIT_PER_MINUTE / 60.0)
        
        if tokens < 1:
            logger.warning(f"Request throttled for {client_ip}")
            return Response(
                content="Too many requests. Please slow down.",
                status_code=429,
                headers={'Retry-After': str(int(60 / RATE_LIMIT_PER_MINUTE))}
            )

        tokens -= 1
        throttling.update_tokens(key, tokens)
        throttling.requests[key] = now

        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            
            # Update metrics
            REQUEST_COUNT.labels(method=method, endpoint=path, status=response.status_code).inc()
            REQUEST_LATENCY.labels(method=method, endpoint=path).observe(process_time)
            
            # Log response
            logger.info(
                f"Response: {response.status_code} for {method} {path} "
                f"from {client_ip} took {process_time:.3f}s"
            )
            
            return response
        except Exception as e:
            logger.error(f"Request failed: {str(e)}")
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"}
            )

class AnomalyRequest(BaseModel):
    model_config = ConfigDict(strict=True)
    
    dates: List[str]
    scores: List[float]

    @field_validator('scores')
    @classmethod
    def validate_scores(cls, v):
        if not v:
            raise ValueError("Scores list cannot be empty")
        if len(v) > 1000:
            raise ValueError("Too many data points. Maximum allowed is 1000")
        if any(not isinstance(x, (int, float)) for x in v):
            raise ValueError("All scores must be numeric")
        if any(x < 0 for x in v):
            raise ValueError("Scores cannot be negative")
        return v

    @field_validator('dates')
    @classmethod
    def validate_dates(cls, v, info):
        if not v:
            raise ValueError("Dates list cannot be empty")
        if 'scores' in info.data and len(v) != len(info.data['scores']):
            raise ValueError("Number of dates must match number of scores")
        try:
            [datetime.fromisoformat(date.replace('Z', '+00:00')) for date in v]
        except ValueError as e:
            raise ValueError(f"Invalid date format. Use ISO format: {str(e)}")
        return v

def cache_key(req: AnomalyRequest) -> str:
    """Generate cache key from request data"""
    data = f"{req.dates}{req.scores}"
    return hashlib.md5(data.encode()).hexdigest()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: load customers data and alert configs from external JSON
    try:
        # Load customers data
        data_path = Path(DATA_DIR) / SAMPLE_DATA_FILE
        with open(data_path, "r") as f:
            app.state.customers_data = json.load(f)
        logger.info(f"Successfully loaded customer data from {data_path}")

        # Load alert configurations
        alert_config_path = Path(DATA_DIR) / "alert_configs.json"
        if alert_config_path.exists():
            with open(alert_config_path, "r") as f:
                configs = json.load(f)
                for customer_id, config in configs.items():
                    alert_configs[customer_id] = AlertConfig(**config)
            logger.info(f"Successfully loaded alert configurations for {len(alert_configs)} customers")
        else:
            logger.warning("Alert configuration file not found. Using empty configuration.")

        logger.info(f"API Key generated: {API_KEY}")
        logger.info(f"Metrics server started on port {METRICS_PORT}")
    except Exception as e:
        logger.error(f"Failed to load data: {e}")
        app.state.customers_data = []

    yield
    
    # Cleanup
    results_cache.clear()
    throttling.requests.clear()
    throttling.tokens.clear()

app = FastAPI(
    title="Customer Analytics API",
    description="API for analyzing customer engagement metrics",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# Add middleware
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": app.version
    }

# Models for anomaly detection input/output
class AnomalyResponse(BaseModel):
    model_config = ConfigDict(strict=True)
    
    anomalies: List[bool]
    metadata: Dict[str, Any]

class RedditMetrics(BaseModel):
    model_config = ConfigDict(strict=True)
    
    subreddit: str
    timeframe: str = 'week'
    limit: int = 100

# API Key security
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=True)

async def verify_api_key(api_key: str = Depends(api_key_header)):
    if api_key != API_KEY:
        logger.warning(f"Invalid API key attempt: {api_key[:10]}...")
        raise HTTPException(
            status_code=403,
            detail="Invalid API key"
        )
    return api_key

# Endpoint to get customers data
@app.get("/customers", tags=["Customers"], dependencies=[Depends(verify_api_key)])
async def get_customers():
    if not app.state.customers_data:
        logger.warning("No customer data available")
        raise HTTPException(status_code=404, detail="No customer data available")
    return app.state.customers_data

# Alert System Configuration
SMTP_SERVER = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', 587))
SMTP_USERNAME = os.getenv('SMTP_USERNAME', '')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
ALERT_FROM_EMAIL = os.getenv('ALERT_FROM_EMAIL', 'alerts@customerengagement.com')

# Alert metrics
ALERT_COUNT = Counter('anomaly_alerts_total', 'Total anomaly alerts sent', ['severity'], registry=custom_registry)

# Alert Models
class AlertThreshold(BaseModel):
    model_config = ConfigDict(strict=True)
    
    warning_threshold: float = 0.15  # 15% of points are anomalies
    critical_threshold: float = 0.30  # 30% of points are anomalies
    min_anomaly_points: int = 3  # Minimum number of anomaly points to trigger alert
    cooldown_minutes: int = 60  # Minimum time between alerts

class AlertConfig(BaseModel):
    model_config = ConfigDict(strict=True)
    
    enabled: bool = True
    email_recipients: List[str]
    thresholds: AlertThreshold = AlertThreshold()
    last_alert_time: Optional[datetime] = None

class AlertResponse(BaseModel):
    model_config = ConfigDict(strict=True)
    
    alert_sent: bool
    severity: Optional[str]
    message: str
    timestamp: datetime

# Alert state storage
alert_history: List[Dict[str, Any]] = []

# Default alert configuration
DEFAULT_ALERT_CONFIG = AlertConfig(
    enabled=True,
    email_recipients=[ALERT_FROM_EMAIL],  # Default to system alert email
    thresholds=AlertThreshold(
        warning_threshold=0.15,
        critical_threshold=0.30,
        min_anomaly_points=3,
        cooldown_minutes=60
    )
)

async def send_email_alert(recipients: List[str], subject: str, body: str):
    """Send email alert using configured SMTP server"""
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        logger.warning("SMTP credentials not configured. Email alert not sent.")
        return
    
    try:
        msg = MIMEMultipart()
        msg['From'] = ALERT_FROM_EMAIL
        msg['To'] = ', '.join(recipients)
        msg['Subject'] = subject
        
        msg.attach(MIMEText(body, 'plain'))
        
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
            
        logger.info(f"Alert email sent to {recipients}")
    except Exception as e:
        logger.error(f"Failed to send email alert: {str(e)}")
        raise

async def check_and_send_alerts(customer_id: str, anomaly_data: Dict[str, Any]) -> AlertResponse:
    """Check if alerts should be triggered and send them if necessary"""
    # Use customer-specific config if exists, otherwise use default
    config = alert_configs.get(customer_id, DEFAULT_ALERT_CONFIG)
    
    if not config.enabled:
        return AlertResponse(
            alert_sent=False,
            severity=None,
            message="Alerts disabled for customer",
            timestamp=datetime.now(timezone.utc)
        )
    
    # Check cooldown period
    if config.last_alert_time:
        cooldown = timedelta(minutes=config.thresholds.cooldown_minutes)
        if datetime.now(timezone.utc) - config.last_alert_time < cooldown:
            return AlertResponse(
                alert_sent=False,
                severity=None,
                message="Alert cooldown period active",
                timestamp=datetime.now(timezone.utc)
            )
    
    anomaly_percentage = anomaly_data['metadata']['anomaly_percentage'] / 100
    anomaly_count = anomaly_data['metadata']['anomaly_count']
    
    if anomaly_count < config.thresholds.min_anomaly_points:
        return AlertResponse(
            alert_sent=False,
            severity=None,
            message="Not enough anomaly points to trigger alert",
            timestamp=datetime.now(timezone.utc)
        )
    
    # Determine alert severity
    severity = None
    if anomaly_percentage >= config.thresholds.critical_threshold:
        severity = "critical"
    elif anomaly_percentage >= config.thresholds.warning_threshold:
        severity = "warning"
    
    if severity:
        # Prepare alert message
        subject = f"{severity.upper()} Alert: Anomaly Detection for Customer {customer_id}"
        body = f"""
Anomaly Alert Details:
---------------------
Severity: {severity.upper()}
Customer ID: {customer_id}
Anomaly Percentage: {anomaly_percentage:.2%}
Number of Anomalies: {anomaly_count}
Total Data Points: {anomaly_data['metadata']['total_points']}
Mean Score: {anomaly_data['metadata']['mean_score']}
Standard Deviation: {anomaly_data['metadata']['std_score']}
Detected at: {anomaly_data['metadata']['processed_at']}

Please review the customer engagement dashboard for more details.
"""
        
        try:
            await send_email_alert(config.email_recipients, subject, body)
            
            # Update alert history and metrics
            alert_history.append({
                "customer_id": customer_id,
                "severity": severity,
                "timestamp": datetime.now(timezone.utc),
                "details": anomaly_data['metadata']
            })
            
            ALERT_COUNT.labels(severity=severity).inc()
            
            # Update last alert time
            config.last_alert_time = datetime.now(timezone.utc)
            if customer_id in alert_configs:  # Only save if it's a custom config
                alert_configs[customer_id] = config
            
            return AlertResponse(
                alert_sent=True,
                severity=severity,
                message=f"{severity.upper()} alert sent successfully",
                timestamp=datetime.now(timezone.utc)
            )
            
        except Exception as e:
            logger.error(f"Failed to send alert: {str(e)}")
            return AlertResponse(
                alert_sent=False,
                severity=severity,
                message=f"Failed to send alert: {str(e)}",
                timestamp=datetime.now(timezone.utc)
            )
    
    return AlertResponse(
        alert_sent=False,
        severity=None,
        message="No alert conditions met",
        timestamp=datetime.now(timezone.utc)
    )

async def save_alert_configs():
    """Save alert configurations to file"""
    try:
        config_path = Path(DATA_DIR) / "alert_configs.json"
        configs_dict = {
            customer_id: config.dict() 
            for customer_id, config in alert_configs.items()
        }
        with open(config_path, "w") as f:
            json.dump(configs_dict, f, indent=2)
        logger.info(f"Saved alert configurations for {len(configs_dict)} customers")
    except Exception as e:
        logger.error(f"Failed to save alert configurations: {e}")

@app.post("/alerts/config/{customer_id}", response_model=AlertConfig, tags=["Alerts"])
async def set_alert_config(
    customer_id: str,
    config: AlertConfig,
    api_key: str = Depends(verify_api_key)
):
    """Set alert configuration for a customer"""
    alert_configs[customer_id] = config
    await save_alert_configs()
    return config

@app.get("/alerts/config/{customer_id}", response_model=AlertConfig, tags=["Alerts"])
async def get_alert_config(
    customer_id: str,
    api_key: str = Depends(verify_api_key)
):
    """Get alert configuration for a customer"""
    # Return customer-specific config if exists, otherwise return default
    return alert_configs.get(customer_id, DEFAULT_ALERT_CONFIG)

@app.get("/alerts/history", response_model=List[Dict[str, Any]], tags=["Alerts"])
async def get_alert_history(
    customer_id: Optional[str] = None,
    limit: int = 100,
    api_key: str = Depends(verify_api_key)
):
    """Get alert history, optionally filtered by customer ID"""
    history = alert_history
    if customer_id:
        history = [alert for alert in history if alert["customer_id"] == customer_id]
    return sorted(history, key=lambda x: x["timestamp"], reverse=True)[:limit]

# Anomaly detection endpoint
class CombinedResponse(BaseModel):
    model_config = ConfigDict(strict=True)
    
    anomaly_detection: AnomalyResponse
    alert: Optional[AlertResponse] = None

@app.post("/detect", response_model=Union[AnomalyResponse, CombinedResponse], tags=["Anomaly Detection"])
async def detect_anomalies(req: AnomalyRequest, customer_id: Optional[str] = None):
    """Detect anomalies in the provided data and optionally trigger alerts"""
    try:
        # Check cache
        cache_hash = cache_key(req)
        if cache_hash in results_cache:
            CACHE_HIT_COUNT.inc()
            response = results_cache[cache_hash]
            logger.info(f"Cache hit. Response data: {response}")
        else:
            CACHE_MISS_COUNT.inc()
            ANOMALY_DETECTION_COUNT.inc()

        df = pd.DataFrame({"value": req.scores})
        logger.info(f"Processing data: {len(req.scores)} points")

        # Feature engineering: rolling mean, rolling std, diff
        df['rolling_mean'] = df['value'].rolling(window=3, min_periods=1).mean()
        df['rolling_std'] = df['value'].rolling(window=3, min_periods=1).std().fillna(0)
        df['diff'] = df['value'].diff().fillna(0)

        X = df[['value', 'rolling_mean', 'rolling_std', 'diff']]

        # Scale features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

                # Isolation Forest
        model = IsolationForest(
                    n_estimators=MODEL_N_ESTIMATORS,
            max_samples='auto',
                    contamination=MODEL_CONTAMINATION,
            max_features=1.0,
            bootstrap=False,
            n_jobs=-1,
                    random_state=MODEL_RANDOM_STATE
        )

        model.fit(X_scaled)
        preds = model.predict(X_scaled)
        anomalies = [bool(p == -1) for p in preds]

        # Calculate metadata
        metadata = {
            "total_points": len(req.scores),
            "anomaly_count": sum(anomalies),
            "anomaly_percentage": round(sum(anomalies) / len(anomalies) * 100, 2),
            "processed_at": datetime.now().isoformat(),
            "mean_score": round(float(df['value'].mean()), 2),
            "std_score": round(float(df['value'].std()), 2)
        }

        response = AnomalyResponse(anomalies=anomalies, metadata=metadata)
        results_cache[cache_hash] = response
        logger.info(f"Generated new response: {response}")

        # Check and send alerts if customer_id is provided
        if customer_id:
            alert_response = await check_and_send_alerts(customer_id, {
                "anomalies": response.anomalies,
                "metadata": response.metadata
            })
            
            combined_response = CombinedResponse(
                anomaly_detection=response,
                alert=alert_response
            )
            logger.info(f"Combined response with alerts: {combined_response}")
            return combined_response

        logger.info(f"Returning anomaly response: {response}")
        return response

    except Exception as e:
        logger.error(f"Error in anomaly detection: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing anomaly detection: {str(e)}"
        )

@app.get("/metrics/summary", tags=["Monitoring"])
async def get_metrics_summary(api_key: str = Depends(verify_api_key)):
    """Get a summary of API metrics"""
    try:
        # Get metrics from custom registry
        get_requests = REQUEST_COUNT.labels(method="GET", endpoint="/customers", status=200)._value.get()
        post_requests = REQUEST_COUNT.labels(method="POST", endpoint="/detect", status=200)._value.get()
        cache_hits = CACHE_HIT_COUNT._value.get()
        cache_misses = CACHE_MISS_COUNT._value.get()
        anomaly_detections = ANOMALY_DETECTION_COUNT._value.get()
        
        # Handle potential None values
        get_requests = int(get_requests) if get_requests is not None else 0
        post_requests = int(post_requests) if post_requests is not None else 0
        cache_hits = int(cache_hits) if cache_hits is not None else 0
        cache_misses = int(cache_misses) if cache_misses is not None else 0
        anomaly_detections = int(anomaly_detections) if anomaly_detections is not None else 0
        
        # Calculate hit ratio safely
        total_cache_requests = cache_hits + cache_misses
        hit_ratio = round((cache_hits / max(1, total_cache_requests)) * 100, 2)
        
        return {
            "total_requests": {
                    "get": get_requests,
                    "post": post_requests
            },
            "cache_performance": {
                    "hits": cache_hits,
                    "misses": cache_misses,
                    "hit_ratio": hit_ratio
            },
                "anomaly_detections": anomaly_detections,
            "current_cache_size": len(results_cache),
            "uptime": time.time() - start_time
        }
    except Exception as e:
        logger.error(f"Error getting metrics summary: {str(e)}")
        return {
            "error": "Failed to retrieve metrics",
            "detail": str(e)
        }

# New Reddit data endpoint
@app.get("/reddit/metrics/{subreddit}", response_model=Dict[str, Any], tags=["Reddit"])
async def get_reddit_metrics(
    subreddit: str,
    timeframe: str = 'week',
    limit: int = 100,
    api_key: str = Depends(verify_api_key)
):
    """Get engagement metrics for a subreddit"""
    try:
        cache_key = f"reddit:{subreddit}:{timeframe}:{limit}"
        
        # Check cache
        if cache_key in results_cache:
            CACHE_HIT_COUNT.inc()
            return results_cache[cache_key]
            
        CACHE_MISS_COUNT.inc()
        
        try:
            # Get subreddit data
            subreddit_obj = reddit.subreddit(subreddit)
            
            # Verify the subreddit exists by accessing a property
            _ = subreddit_obj.created_utc
            
        except Exception as e:
            logger.error(f"Error accessing subreddit {subreddit}: {str(e)}")
            raise HTTPException(
                status_code=404,
                detail=f"Subreddit '{subreddit}' not found or is private"
            )
        
        # Get posts based on timeframe
        if timeframe == 'day':
            posts = list(subreddit_obj.top('day', limit=limit))
        elif timeframe == 'week':
            posts = list(subreddit_obj.top('week', limit=limit))
        elif timeframe == 'month':
            posts = list(subreddit_obj.top('month', limit=limit))
        else:
            posts = list(subreddit_obj.top('all', limit=limit))
            
        if not posts:
            raise HTTPException(
                status_code=404,
                detail=f"No posts found in r/{subreddit} for the selected timeframe"
            )

        # Get current time for relative time calculation
        current_time = datetime.now(timezone.utc)
            
        # Calculate metrics
        metrics = {
            "post_count": len(posts),
            "total_score": sum(post.score for post in posts),
            "total_comments": sum(post.num_comments for post in posts),
            "average_score": round(sum(post.score for post in posts) / len(posts), 2) if posts else 0,
            "average_comments": round(sum(post.num_comments for post in posts) / len(posts), 2) if posts else 0,
            "top_posts": [{
                "title": post.title,
                "score": post.score,
                "comments": post.num_comments,
                "url": post.url,
                "created_utc": (current_time - timedelta(seconds=current_time.timestamp() - post.created_utc)).isoformat()
            } for post in sorted(posts, key=lambda x: x.score, reverse=True)[:5]],
            "metadata": {
                "subreddit": subreddit_obj.display_name,
                "subscribers": subreddit_obj.subscribers,
                "active_users": getattr(subreddit_obj, 'active_user_count', 0),
                "created_utc": (current_time - timedelta(seconds=current_time.timestamp() - subreddit_obj.created_utc)).isoformat(),
                "timeframe": timeframe,
                "processed_at": current_time.isoformat()
            }
        }
        
        # Validate data for anomaly detection
        if len(posts) < 5:
            metrics["warning"] = "Not enough data points for reliable anomaly detection"
        
        # Cache results
        results_cache[cache_key] = metrics
        return metrics
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching Reddit metrics: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing Reddit metrics: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv('PORT', 8000))
    
    # In development mode, don't start the metrics server again
    # as it will be started by the FastAPI app
    if os.getenv('ENVIRONMENT') != 'development':
        start_http_server(METRICS_PORT, registry=custom_registry)
        logger.info(f"Metrics server started on port {METRICS_PORT}")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )
