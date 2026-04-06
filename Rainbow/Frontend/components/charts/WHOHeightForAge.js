import { useEffect, useRef } from 'react';

// WHO Height-for-Age Standards (0-60 months) - Boys (in cm)
const WHO_BOYS_DATA = {
  0: [46.1, 48.0, 49.9, 51.8, 53.7],
  1: [50.8, 52.8, 54.7, 56.7, 58.6],
  2: [54.4, 56.4, 58.4, 60.4, 62.4],
  3: [57.3, 59.4, 61.4, 63.5, 65.5],
  6: [63.3, 65.5, 67.6, 69.8, 71.9],
  9: [67.7, 70.1, 72.0, 74.2, 76.5],
  12: [71.0, 73.4, 75.7, 78.1, 80.5],
  15: [73.6, 76.1, 78.6, 81.2, 83.7],
  18: [76.0, 78.6, 81.0, 83.6, 86.2],
  24: [81.0, 83.5, 86.0, 88.9, 91.9],
  30: [85.1, 87.7, 90.3, 93.2, 96.1],
  36: [88.7, 91.4, 94.1, 97.0, 100.0],
  48: [95.0, 98.0, 101.0, 104.4, 107.8],
  60: [100.7, 103.9, 107.0, 110.5, 114.0]
};

// WHO Height-for-Age Standards (0-60 months) - Girls (in cm)
const WHO_GIRLS_DATA = {
  0: [45.4, 47.3, 49.1, 51.0, 52.9],
  1: [49.8, 51.7, 53.7, 55.6, 57.6],
  2: [53.0, 55.0, 57.1, 59.1, 61.1],
  3: [55.6, 57.7, 59.8, 61.9, 64.0],
  6: [61.2, 63.5, 65.7, 68.0, 70.3],
  9: [65.3, 67.7, 70.1, 72.6, 75.0],
  12: [68.9, 71.4, 74.0, 76.6, 79.2],
  15: [71.8, 74.5, 77.1, 79.9, 82.7],
  18: [74.5, 77.2, 80.0, 82.9, 85.7],
  24: [79.3, 82.2, 85.1, 88.3, 91.5],
  30: [83.6, 86.6, 89.6, 92.9, 96.3],
  36: [87.4, 90.5, 93.6, 97.1, 100.6],
  48: [94.1, 97.5, 100.9, 104.7, 108.5],
  60: [100.1, 103.7, 107.4, 111.5, 115.7]
};

export default function WHOHeightForAge({ childData, gender }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!childData || !childData.height) return;
    drawChart();
  }, [childData, gender]);

  const drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const padding = { top: 40, right: 40, bottom: 60, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const whoData = gender.toLowerCase() === 'girl' ? WHO_GIRLS_DATA : WHO_BOYS_DATA;
    const ages = Object.keys(whoData).map(Number);
    const maxAge = Math.max(...ages);
    const maxHeight = 120;

    const getX = (age) => padding.left + (age / maxAge) * chartWidth;
    const getY = (heightVal) => padding.top + chartHeight - (heightVal / maxHeight) * chartHeight;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;

    for (let age = 0; age <= maxAge; age += 6) {
      const x = getX(age);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
    }

    for (let heightVal = 40; heightVal <= maxHeight; heightVal += 10) {
      const y = getY(heightVal);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    // Percentile curves
    const percentiles = [
      { index: 0, color: '#ef4444', label: 'P3' },
      { index: 1, color: '#f59e0b', label: 'P15' },
      { index: 2, color: '#10b981', label: 'P50' },
      { index: 3, color: '#f59e0b', label: 'P85' },
      { index: 4, color: '#ef4444', label: 'P97' }
    ];

    percentiles.forEach(({ index, color, label }) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      ages.forEach((age, i) => {
        const heightVal = whoData[age][index];
        const x = getX(age);
        const y = getY(heightVal);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      const lastAge = ages[ages.length - 1];
      const lastHeight = whoData[lastAge][index];
      ctx.fillStyle = color;
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(label, getX(lastAge) + 5, getY(lastHeight) + 4);
    });

    // Axes
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#374151';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';

    for (let age = 0; age <= maxAge; age += 6) {
      const x = getX(age);
      ctx.fillText(age, x, height - padding.bottom + 20);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let heightVal = 40; heightVal <= maxHeight; heightVal += 10) {
      const y = getY(heightVal);
      ctx.fillText(heightVal, padding.left - 10, y);
    }

    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Age (months)', width / 2, height - 25);

    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Height (cm)', 0, 0);
    ctx.restore();

    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(
      `WHO Height-for-Age (${gender === 'girl' ? 'Girls' : 'Boys'} 0-5 years)`,
      width / 2,
      10
    );

    // Plot child's data point
    if (childData && childData.age !== undefined && childData.height !== undefined) {
      const childAge = childData.age;
      const childHeight = childData.height;
      const x = getX(childAge);
      const y = getY(childHeight);

      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI);
      ctx.fill();

      ctx.strokeStyle = '#1e40af';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#1e40af';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(
        `${childHeight}cm at ${childAge}mo`,
        x + 12,
        y - 8
      );
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={500}
      className="w-full border border-gray-300 rounded-lg"
    />
  );
}
