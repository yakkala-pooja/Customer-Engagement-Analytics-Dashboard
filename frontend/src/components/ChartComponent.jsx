import React from 'react';
import PropTypes from 'prop-types';
import ChartWrapper from './ChartWrapper';

const ChartComponent = ({ data }) => {
  if (!data || !data.dates || !data.engagement_score || !data.anomalies) {
    console.error('Incomplete data:', data);
    return <div>Customer data is incomplete</div>;
  }

  return <ChartWrapper data={data} />;
};

ChartComponent.propTypes = {
  data: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
    subscription_type: PropTypes.string.isRequired,
    dates: PropTypes.arrayOf(PropTypes.string).isRequired,
    engagement_score: PropTypes.arrayOf(PropTypes.number).isRequired,
    anomalies: PropTypes.arrayOf(PropTypes.bool).isRequired
  }).isRequired
};

export default ChartComponent;
