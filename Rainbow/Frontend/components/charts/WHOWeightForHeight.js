import { useEffect, useRef } from 'react';

// WHO Weight-for-Height Standards - Boys (height in cm: [P3, P15, P50, P85, P97] weight in kg)
const WHO_BOYS_DATA = {
  45: [1.9, 2.1, 2.3, 2.6, 2.9],
  50: [2.6, 2.9, 3.2, 3.6, 4.0],
  55: [3.5, 3.9, 4.3, 4.8, 5.3],
  60: [4.5, 5.0, 5.5, 6.1, 6.8],
  65: [5.5, 6.1, 6.7, 7.5, 8.3],
  70: [6.5, 7.2, 7.9, 8.8, 9.7],
  75: [7.4, 8.2, 9.0, 10.0, 11.1],
  80: [8.3, 9.1, 10.1, 11.2, 12.4],
  85: [9.1, 10.0, 11.1, 12.3, 13.7],
  90: [9.8, 10.8, 12.0, 13.4, 14.9],
  95: [10.5, 11.6, 12.9, 14.4, 16.1],
  100: [11.2, 12.4, 13.7, 15.4, 17.2],
  105: [11.9, 13.1, 14.6, 16.4, 18.4],
  110: [12.6, 13.9, 15.5, 17.4, 19.6],
  115: [13.4, 14.8, 16.4, 18.5, 20.9],
  120: [14.3, 15.7, 17.5, 19.7, 22.3]
};

// WHO Weight-for-Height Standards - Girls
const WHO_GIRLS_DATA = {
  45: [1.8, 2.0, 2.2, 2.5, 2.8],
  50: [2.5, 2.8, 3.1, 3.5, 3.9],
  55: [3.4, 3.7, 4.1, 4.6, 5.1],
  60: [4.3, 4.8, 5.3, 5.9, 6.5],
  65: [5.3, 5.8, 6.4, 7.1, 7.9],
  70: [6.2, 6.8, 7.5, 8.3, 9.3],
  75: [7.0, 7.7, 8.5, 9.5, 10.5],
  80: [7.7, 8.5, 9.5, 10.5, 11.7],
  85: [8.4, 9.3, 10.3, 11.5, 12.8],
  90: [9.0, 10.0, 11.2, 12.5, 14.0],
  95: [9.7, 10.7, 12.0, 13.5, 15.1],
  100: [10.3, 11.5, 12.8, 14.4, 16.2],
  105: [11.0, 12.2, 13.7, 15.4, 17.4],
  110: [11.7, 13.0, 14.6, 16.5, 18.7],
  115: [12.5, 13.9, 15.6, 17.7, 20.1],
  120: [13.3, 14.8, 16.7, 19.0, 21.6]
};

export default function WHOWeightForHeight({ childData, gender }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!childData || !childData.weight || !childData.height) return;
    drawChart();
  }, [childData, gender, childData?.weight, childData?.height]);

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
    const heights = Object.keys(whoData).map(Number);
    const minHeight = Math.min(...heights);
    const maxHeight = Math.max(...heights);
    const maxWeight = 24;

    const getX = (heightVal) => padding.left + ((heightVal - minHeight) / (maxHeight - minHeight)) * chartWidth;
    const getY = (weight) => padding.top + chartHeight - (weight / maxWeight) * chartHeight;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;

    for (let heightVal = 50; heightVal <= maxHeight; heightVal += 10) {
      const x = getX(heightVal);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
    }

    for (let weight = 0; weight <= maxWeight; weight += 2) {
      const y = getY(weight);
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

      heights.forEach((heightVal, i) => {
        const weight = whoData[heightVal][index];
        const x = getX(heightVal);
        const y = getY(weight);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      const lastHeight = heights[heights.length - 1];
      const lastWeight = whoData[lastHeight][index];
      ctx.fillStyle = color;
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(label, getX(lastHeight) + 5, getY(lastWeight) + 4);
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

    for (let heightVal = 50; heightVal <= maxHeight; heightVal += 10) {
      const x = getX(heightVal);
      ctx.fillText(heightVal, x, height - padding.bottom + 20);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let weight = 0; weight <= maxWeight; weight += 4) {
      const y = getY(weight);
      ctx.fillText(weight, padding.left - 10, y);
    }

    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Height (cm)', width / 2, height - 25);

    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Weight (kg)', 0, 0);
    ctx.restore();

    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(
      `WHO Weight-for-Height (${gender === 'girl' ? 'Girls' : 'Boys'})`,
      width / 2,
      10
    );

    // Plot child's data point
    if (childData && childData.height !== undefined && childData.weight !== undefined) {
      const childHeight = childData.height;
      const childWeight = childData.weight;
      const x = getX(childHeight);
      const y = getY(childWeight);

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
        `${childWeight}kg at ${childHeight}cm`,
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
