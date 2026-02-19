import React, { useState, useEffect } from 'react';
import { Tree, TreeNode } from 'react-organizational-chart';
import { Paper, Typography } from '@mui/material';

const AgentHierarchy = () => {
  const [hierarchy, setHierarchy] = useState(null);

  useEffect(() => {
    // Simulate fetching hierarchy data
    const mockHierarchy = {
      id: '1', name: 'Super Agent',
      children: [
        { id: '2', name: 'Agent 1' },
        { id: '3', name: 'Agent 2', children: [{ id: '4', name: 'Sub-Agent 1' }] },
      ],
    };
    setHierarchy(mockHierarchy);
  }, []);

  const renderNode = (node) => (
    <TreeNode key={node.id} label={<Paper style={{ padding: '5px 10px' }}><Typography>{node.name}</Typography></Paper>}>
      {node.children && node.children.map(renderNode)}
    </TreeNode>
  );

  return (
    <Tree
      lineWidth={'2px'}
      lineColor={'gray'}
      lineBorderRadius={'10px'}
      label={<Paper style={{ padding: '5px 10px' }}><Typography>Root</Typography></Paper>}
    >
      {hierarchy && renderNode(hierarchy)}
    </Tree>
  );
};

export default AgentHierarchy;

