// GrowthChartModal.js
'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import WHOGrowthChart from './WHOGrowthChart';

export default function GrowthChartModal({ isOpen, onClose, growthData }) {
  const [gender, setGender] = useState('boy');

  useEffect(() => {
    if (growthData?.gender) {
      setGender(growthData.gender.toLowerCase());
    }
  }, [growthData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-cyan-600">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  WHO Growth Charts
                </h2>
                {growthData && (
                  <p className="text-sm text-blue-100 mt-1">
                    {growthData.name || 'Child'} • {growthData.age} months ({Math.floor(growthData.age / 12)} years {growthData.age % 12} months)
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {growthData ? (
                <div className="space-y-6">
                  {/* Data Info Banner */}
                  <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-green-800 text-lg">
                          ✅ Showing Extracted Data from Transcript
                        </span>
                        <div className="text-sm text-gray-700 mt-2 space-y-1">
                          <div>
                            <span className="font-medium">Child:</span> {growthData.name || 'Unknown'}
                          </div>
                          <div>
                            <span className="font-medium">Age:</span> {growthData.age} months ({Math.floor(growthData.age / 12)} years {growthData.age % 12} months)
                          </div>
                          {growthData.weight && (
                            <div>
                              <span className="font-medium">Weight:</span> {growthData.weight} kg
                            </div>
                          )}
                          {growthData.height && (
                            <div>
                              <span className="font-medium">Height:</span> {growthData.height} cm
                            </div>
                          )}
                          <div>
                            <span className="font-medium">Gender:</span> {growthData.gender}
                          </div>
                          {growthData.extractedAt && (
                            <div className="text-xs text-gray-500 mt-2">
                              Extracted at: {new Date(growthData.extractedAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Charts */}
                  <WHOGrowthChart
                    childData={growthData}
                    gender={gender}
                  />
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">
                    No growth data available. Please generate a prescription first.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
