import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Import WHOGrowthChart with no SSR to avoid localStorage issues
const WHOGrowthChart = dynamic(() => import('../components/WHOGrowthChart'), {
  ssr: false,
  loading: () => <div className="text-center p-8">Loading charts...</div>
});

export default function GrowthChartPage() {
  const [childData, setChildData] = useState(null);
  const [gender, setGender] = useState('boy');
  const [s3Url, setS3Url] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState(null); // Track data source
  const [isMounted, setIsMounted] = useState(false); // Track if mounted

  // Set mounted flag
  useEffect(() => {
    setIsMounted(true);
    console.log('🔍 [GROWTH CHART PAGE] Component mounted');
  }, []);

  // Load extracted growth data from localStorage on mount
  useEffect(() => {
    if (!isMounted) return; // Only run on client
    
    console.log('🔍 [GROWTH CHART] Component mounted, checking localStorage...');
    console.log('🔍 [GROWTH CHART] isMounted:', isMounted);
    console.log('🔍 [GROWTH CHART] typeof window:', typeof window);
    
    // Force a fresh read from localStorage
    const storedData = localStorage.getItem('growthData');
    console.log('📦 [GROWTH CHART] Raw localStorage data:', storedData);
    
    if (storedData) {
      try {
        const data = JSON.parse(storedData);
        console.log('✅ [GROWTH CHART] Parsed growth data:', data);
        console.log('  - Name:', data.name);
        console.log('  - Age:', data.age, 'months');
        console.log('  - Weight:', data.weight, 'kg');
        console.log('  - Height:', data.height, 'cm');
        console.log('  - Gender:', data.gender);
        console.log('  - Extracted at:', data.extractedAt);
        
        // CRITICAL: Set the data immediately
        setChildData(data);
        setDataSource('extracted'); // Mark as extracted from transcript
        if (data.gender) {
          setGender(data.gender.toLowerCase());
        }
        
        console.log('✅ [GROWTH CHART] State updated with extracted data');
      } catch (e) {
        console.error('❌ [GROWTH CHART] Failed to parse localStorage data:', e);
      }
    } else {
      console.log('ℹ️ [GROWTH CHART] No growth data found in localStorage');
    }
  }, [isMounted]);

  const handleS3Load = async (e) => {
    e.preventDefault();
    if (!s3Url) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(s3Url);
      if (!response.ok) throw new Error('Failed to fetch data from S3');
      const data = await response.json();
      
      // Validate data
      if (!data.age) {
        throw new Error('JSON must contain "age" field');
      }
      if (!data.weight && !data.height) {
        throw new Error('JSON must contain at least "weight" or "height" field');
      }

      setChildData(data);
      if (data.gender) {
        setGender(data.gender.toLowerCase());
      }
      setDataSource('s3'); // Mark as loaded from S3
    } catch (err) {
      setError(err.message);
      setChildData(null);
    } finally {
      setLoading(false);
    }
  };

  const loadSampleData = (sample) => {
    setChildData(sample);
    if (sample.gender) {
      setGender(sample.gender.toLowerCase());
    }
    setDataSource('sample'); // Mark as sample data
    setError(null);
  };

  return (
    <>
      <Head>
        <title>WHO Growth Charts - Rainbow Hospital</title>
        <meta name="description" content="WHO Growth Charts" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          {/* Navigation */}
          <div className="mb-6 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium">WHO Growth Charts</span>
              {childData && (
                <span className="ml-2">
                  • Viewing: {childData.name || 'Child'} 
                  {childData.age && ` (${childData.age} months)`}
                </span>
              )}
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            WHO Growth Charts
          </h1>

          {/* DEBUG: Show what data is being used */}
          {isMounted && process.env.NODE_ENV === 'development' && (
            <div className="mb-4 p-3 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
              <div className="font-bold mb-2">🔍 DEBUG: Current Data State</div>
              <div>isMounted: {isMounted ? 'true' : 'false'}</div>
              <div>childData: {childData ? JSON.stringify(childData) : 'null'}</div>
              <div>dataSource: {dataSource || 'not set'}</div>
              <div>gender: {gender}</div>
              <div className="mt-2">
                <button 
                  onClick={() => {
                    const data = localStorage.getItem('growthData');
                    console.log('Manual check:', data);
                    alert('Check console for localStorage data');
                  }}
                  className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
                >
                  Check localStorage
                </button>
              </div>
            </div>
          )}

          {/* Data Source Indicator */}
          {childData && dataSource && (
            <div className={`mb-6 p-4 rounded-lg border-2 ${
              dataSource === 'extracted' 
                ? 'bg-green-50 border-green-300' 
                : dataSource === 'sample'
                ? 'bg-yellow-50 border-yellow-300'
                : 'bg-blue-50 border-blue-300'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <span className="font-semibold text-gray-800 text-lg">
                    {dataSource === 'extracted' && '✅ Showing Extracted Data from Transcript'}
                    {dataSource === 'sample' && '⚠️ Showing Sample Data (Click Clear to Remove)'}
                    {dataSource === 's3' && '📦 Showing Data from S3'}
                  </span>
                  <div className="text-sm text-gray-600 mt-2 space-y-1">
                    <div className="font-medium">
                      <span className="inline-block w-24">Child:</span> {childData.name || 'Unknown'}
                    </div>
                    <div>
                      <span className="inline-block w-24">Age:</span> {childData.age} months ({Math.floor(childData.age / 12)} years {childData.age % 12} months)
                    </div>
                    {childData.weight && (
                      <div>
                        <span className="inline-block w-24">Weight:</span> {childData.weight} kg
                      </div>
                    )}
                    {childData.height && (
                      <div>
                        <span className="inline-block w-24">Height:</span> {childData.height} cm
                      </div>
                    )}
                    <div>
                      <span className="inline-block w-24">Gender:</span> {childData.gender}
                    </div>
                    {childData.extractedAt && (
                      <div className="text-xs text-gray-500 mt-2">
                        Extracted at: {new Date(childData.extractedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Clear this data and start fresh?')) {
                      localStorage.removeItem('growthData');
                      setChildData(null);
                      setDataSource(null);
                    }
                  }}
                  className="ml-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded font-medium"
                >
                  Clear Data
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* S3 URL Input */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">
                Load from S3
              </h2>
              <form onSubmit={handleS3Load} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    S3 JSON URL
                  </label>
                  <input
                    type="url"
                    value={s3Url}
                    onChange={(e) => setS3Url(e.target.value)}
                    placeholder="https://your-bucket.s3.amazonaws.com/data.json"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gender (optional - can be in JSON)
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="boy">Boy</option>
                    <option value="girl">Girl</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
                >
                  {loading ? 'Loading...' : 'Load from S3'}
                </button>
              </form>

              <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-600">
                <p className="font-medium mb-1">Expected JSON format:</p>
                <pre className="overflow-x-auto">
{`{
  "name": "Child Name",
  "age": 24,
  "weight": 12.5,
  "height": 85.5,
  "gender": "boy"
}`}
                </pre>
                <p className="mt-2 text-xs">
                  • Required: age<br/>
                  • Optional: weight, height, name, gender
                </p>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-300 rounded text-sm text-red-700">
                  Error: {error}
                </div>
              )}
            </div>

            {/* Sample Data */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">
                Quick Examples
              </h2>
              <div className="space-y-2">
                <button
                  onClick={() => loadSampleData({ 
                    name: 'Newborn', 
                    age: 0, 
                    weight: 3.3, 
                    gender: 'boy' 
                  })}
                  className="w-full text-left px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm transition-colors"
                >
                  Weight Only: Newborn Boy (0mo, 3.3kg)
                </button>
                <button
                  onClick={() => loadSampleData({ 
                    name: '6 Month Old', 
                    age: 6, 
                    height: 67.6, 
                    gender: 'boy' 
                  })}
                  className="w-full text-left px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm transition-colors"
                >
                  Height Only: 6 Month Boy (6mo, 67.6cm)
                </button>
                <button
                  onClick={() => loadSampleData({ 
                    name: '1 Year Old', 
                    age: 12, 
                    weight: 9.6, 
                    height: 75.7, 
                    gender: 'boy' 
                  })}
                  className="w-full text-left px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm transition-colors"
                >
                  Both: 1 Year Boy (12mo, 9.6kg, 75.7cm)
                </button>
                <button
                  onClick={() => loadSampleData({ 
                    name: '2 Year Old', 
                    age: 24, 
                    weight: 12.2, 
                    height: 86.8, 
                    gender: 'boy' 
                  })}
                  className="w-full text-left px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm transition-colors"
                >
                  Both: 2 Year Boy (24mo, 12.2kg, 86.8cm)
                </button>
                <button
                  onClick={() => loadSampleData({ 
                    name: 'Toddler Girl', 
                    age: 18, 
                    weight: 10.2, 
                    height: 80.7, 
                    gender: 'girl' 
                  })}
                  className="w-full text-left px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm transition-colors"
                >
                  Both: 18 Month Girl (18mo, 10.2kg, 80.7cm)
                </button>
              </div>
            </div>
          </div>

          {/* Chart Display */}
          {childData && (
            <div className="space-y-6">
              <WHOGrowthChart
                childData={childData}
                gender={gender}
              />
            </div>
          )}

          {!childData && !error && (
            <div className="bg-white p-12 rounded-lg shadow-md text-center">
              <p className="text-gray-500 text-lg">
                Load data from S3 or select a quick example to view growth charts
              </p>
            </div>
          )}

          {/* Information Section */}
          <div className="mt-6 bg-blue-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              About WHO Growth Charts
            </h3>
            <div className="text-sm text-gray-700 space-y-2">
              <p>
                The WHO Child Growth Standards are based on data from healthy children
                from diverse ethnic backgrounds and cultural settings.
              </p>
              <p>
                <strong>Charts displayed based on available data:</strong>
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Weight only → Weight-for-Age chart</li>
                <li>Height only → Height-for-Age chart</li>
                <li>Both → Weight-for-Age, Height-for-Age, Weight-for-Height, and BMI-for-Age charts</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
