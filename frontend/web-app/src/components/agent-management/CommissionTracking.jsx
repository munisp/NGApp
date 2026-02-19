import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';

const CommissionTracking = () => {
  const [commissions, setCommissions] = useState([]);

  useEffect(() => {
    // Simulate fetching commission data
    const mockCommissions = [
      { id: 1, agent: 'Agent 1', amount: 2400, date: '2023-10-27' },
      { id: 2, agent: 'Agent 2', amount: 1398, date: '2023-10-27' },
      { id: 3, agent: 'Sub-Agent 1', amount: 9800, date: '2023-10-27' },
    ];
    setCommissions(mockCommissions);
  }, []);

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Agent</TableCell>
            <TableCell align="right">Commission</TableCell>
            <TableCell>Date</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {commissions.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.agent}</TableCell>
              <TableCell align="right">{row.amount}</TableCell>
              <TableCell>{row.date}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default CommissionTracking;

