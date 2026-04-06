import { useEffect, useRef, useState } from 'react';
import WHOWeightForAge from './charts/WHOWeightForAge';
import WHOHeightForAge from './charts/WHOHeightForAge';
import WHOWeightForHeight from './charts/WHOWeightForHeight';
import WHOBMIForAge from './charts/WHOBMIForAge';

export default function WHOGrowthChart({ childData, gender = 'boy' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(childData);

  // Fetch data from S3 if URL is provided
  useEffect(() => {
    if (typeof childData === 'string') {
      fetchDataFromS3(childData);
    } else {
      setData(childData);
    }
  }, [childData]);

  const fetchDataFromS3 = async (url) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch data');
      const jsonData = await response.json();
      setData(jsonData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading chart data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const hasWeight = data.weight !== undefined && data.weight !== null;
  const hasHeight = data.height !== undefined && data.height !== null;

  // Calculate BMI if both weight and height are available
  let bmi = null;
  if (hasWeight && hasHeight) {
    // BMI = weight (kg) / (height (m))^2
    const heightInMeters = data.height / 100;
    bmi = data.weight / (heightInMeters * heightInMeters);
  }

  return (
    <div className="w-full space-y-6">
      {/* Child Information */}
      {data && (
        <div className="bg-gradient-to-r from-red-500 to-blue-700 p-6 rounded-lg shadow-lg">
          <h3 className="font-bold text-white text-lg mb-3">Child Information</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {data.name && (
              <div className="bg-white bg-opacity-20 backdrop-blur-sm p-3 rounded-lg">
                <span className="text-red-500 text-xs block mb-1">Name</span>
                <span className="font-semibold text-black text-base block">{data.name}</span>
              </div>
            )}
            <div className="bg-white bg-opacity-20 backdrop-blur-sm p-3 rounded-lg">
              <span className="text-red-500 text-xs block mb-1">Age</span>
              <span className="font-semibold text-black text-base block">{data.age} months</span>
            </div>
            {hasWeight && (
              <div className="bg-white bg-opacity-20 backdrop-blur-sm p-3 rounded-lg">
                <span className="text-red-500 text-xs block mb-1">Weight</span>
                <span className="font-semibold text-black text-base block">{data.weight} kg</span>
              </div>
            )}
            {hasHeight && (
              <div className="bg-white bg-opacity-20 backdrop-blur-sm p-3 rounded-lg">
                <span className="text-red-500 text-xs block mb-1">Height</span>
                <span className="font-semibold text-black text-base block">{data.height} cm</span>
              </div>
            )}
            {bmi && (
              <div className="bg-white bg-opacity-20 backdrop-blur-sm p-3 rounded-lg">
                <span className="text-red-500 text-xs block mb-1">BMI</span>
                <span className="font-semibold text-black text-base block">{bmi.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* First Row: Weight-for-Age and Height-for-Age */}
      {(hasWeight || hasHeight) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weight-for-Age Chart */}
          {hasWeight && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                Weight-for-Age Chart
              </h3>
              <WHOWeightForAge childData={data} gender={gender} />
            </div>
          )}

          {/* Height-for-Age Chart */}
          {hasHeight && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                Height-for-Age Chart
              </h3>
              <WHOHeightForAge childData={data} gender={gender} />
            </div>
          )}
        </div>
      )}

      {/* Second Row: Weight-for-Height and BMI-for-Age (only if both available) */}
      {hasWeight && hasHeight && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weight-for-Height Chart */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">
              Weight-for-Height Chart
            </h3>
            <WHOWeightForHeight childData={data} gender={gender} />
          </div>

          {/* BMI-for-Age Chart */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">
              BMI-for-Age Chart
            </h3>
            <WHOBMIForAge childData={data} gender={gender} bmi={bmi} />
          </div>
        </div>
      )}
    </div>
  );
}
