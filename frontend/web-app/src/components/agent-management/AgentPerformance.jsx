import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const AgentPerformance = () => {
  const [performanceData, setPerformanceData] = useState([]);

  useEffect(() => {
    // Simulate fetching performance data
    const mockData = [
      { name: 'Agent 1', transactions: 4000, commission: 2400 },
      { name: 'Agent 2', transactions: 3000, commission: 1398 },
      { name: 'Sub-Agent 1', transactions: 2000, commission: 9800 },
    ];
    setPerformanceData(mockData);
  }, []);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={performanceData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="transactions" fill="#8884d8" />
        <Bar dataKey="commission" fill="#82ca9d" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default AgentPerformance;

