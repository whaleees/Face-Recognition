// src/Dashboard.tsx
import React from 'react';

const Dashboard = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
    <div className="text-center p-8 bg-white shadow-lg rounded-xl">
        <h1 className="text-3xl font-bold mb-4">Welcome to the Dashboard</h1>
        <p className="text-gray-700">You have successfully logged in.</p>
    </div>
    </div>
  );
};

export default Dashboard;
