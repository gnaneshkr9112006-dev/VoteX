import React from 'react';

const StatusBadge = ({ status }: { status: string }) => {
  return <span className={`badge badge-${status}`}>{status.toUpperCase()}</span>;
};
export default StatusBadge;
