import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';

const ChartWrapper = ({ data }) => {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) {
      console.error('Failed to get canvas context');
      return;
    }

    try {
      // Convert dates and prepare data points
      const dataPoints = data.dates.map((date, i) => ({
        x: new Date(date),
        y: data.engagement_score[i],
        isAnomaly: data.anomalies[i]
      })).sort((a, b) => a.x - b.x);

      // Split into normal and anomaly datasets
      const normalPoints = dataPoints.filter(point => !point.isAnomaly);
      const anomalyPoints = dataPoints.filter(point => point.isAnomaly);

      // Cleanup previous chart instance
      if (chartRef.current) {
        chartRef.current.destroy();
      }

      // Create new chart
      chartRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'Normal Engagement',
              data: normalPoints,
              borderColor: '#2196f3',
              backgroundColor: 'rgba(33, 150, 243, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.4,
              pointRadius: 4,
              pointHoverRadius: 6
            },
            {
              label: 'Anomalies',
              data: anomalyPoints,
              borderColor: '#f44336',
              backgroundColor: '#f44336',
              borderWidth: 0,
              pointRadius: 8,
              pointHoverRadius: 10,
              pointStyle: 'circle',
              showLine: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 750
          },
          interaction: {
            intersect: false,
            mode: 'nearest'
          },
          plugins: {
            title: {
              display: true,
              text: 'Engagement Score Over Time',
              font: {
                size: 16,
                weight: 'bold'
              },
              padding: 20
            },
            tooltip: {
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              titleColor: '#000',
              bodyColor: '#000',
              borderColor: '#ddd',
              borderWidth: 1,
              padding: 10,
              displayColors: true,
              callbacks: {
                title: (context) => {
                  return context[0].raw.x.toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                },
                label: (context) => {
                  const score = context.raw.y;
                  const isAnomaly = context.raw.isAnomaly;
                  return `${isAnomaly ? '⚠️ ' : ''}Score: ${score.toLocaleString()}`;
                }
              }
            },
            legend: {
              position: 'top',
              labels: {
                usePointStyle: true,
                padding: 15
              }
            }
          },
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'day',
                displayFormats: {
                  day: 'MMM d'
                }
              },
              title: {
                display: true,
                text: 'Date',
                padding: 10
              },
              grid: {
                display: true,
                drawBorder: true,
                drawOnChartArea: true,
                drawTicks: true
              }
            },
            y: {
              title: {
                display: true,
                text: 'Engagement Score',
                padding: 10
              },
              beginAtZero: true,
              grid: {
                display: true,
                drawBorder: true,
                drawOnChartArea: true,
                drawTicks: true
              }
            }
          }
        }
      });
    } catch (err) {
      console.error('Error creating chart:', err);
    }

    // Cleanup
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [data]);

  return (
    <div style={{
      height: '400px',
      width: '100%',
      position: 'relative',
      backgroundColor: '#fff',
      padding: '1rem',
      borderRadius: '4px'
    }}>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default ChartWrapper; 