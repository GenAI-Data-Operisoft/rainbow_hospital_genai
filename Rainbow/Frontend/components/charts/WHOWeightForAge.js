import { useEffect, useRef } from 'react';

// WHO Weight-for-Age Standards (0-60 months) - Boys
const WHO_BOYS_DATA = {
  0: [2.5, 2.9, 3.3, 3.9, 4.4],
  1: [3.4, 3.9, 4.5, 5.1, 5.8],
  2: [4.3, 4.9, 5.6, 6.3, 7.1],
  3: [5.0, 5.7, 6.4, 7.2, 8.0],
  6: [6.4, 7.3, 8.0, 8.8, 9.8],
  9: [7.1, 8.0, 8.9, 9.9, 10.9],
  12: [7.7, 8.6, 9.6, 10.8, 11.8],
  15: [8.3, 9.2, 10.3, 11.5, 12.8],
  18: [8.8, 9.8, 10.9, 12.2, 13.7],
  24: [9.7, 10.8, 12.2, 13.6, 15.3],
  30: [10.5, 11.7, 13.3, 15.0, 16.9],
  36: [11.3, 12.7, 14.3, 16.2, 18.3],
  48: [12.8, 14.3, 16.3, 18.6, 21.2],
  60: [14.1, 15.9, 18.3, 21.0, 24.0]
};

// WHO Weight-for-Age Standards (0-60 months) - Girls
const WHO_GIRLS_DATA = {
  0: [2.4, 2.8, 3.2, 3.7, 4.2],
  1: [3.2, 3.6, 4.2, 4.8, 5.5],
  2: [3.9, 4.5, 5.1, 5.8, 6.6],
  3: [4.5, 5.2, 5.8, 6.6, 7.5],
  6: [5.7, 6.5, 7.3, 8.2, 9.3],
  9: [6.4, 7.3, 8.2, 9.3, 10.5],
  12: [7.0, 7.9, 8.9, 10.1, 11.5],
  15: [7.6, 8.5, 9.6, 10.9, 12.4],
  18: [8.1, 9.1, 10.2, 11.6, 13.2],
  24: [9.0, 10.2, 11.5, 13.0, 14.8],
  30: [9.9, 11.1, 12.7, 14.4, 16.5],
  36: [10.8, 12.0, 13.9, 15.8, 18.1],
  48: [12.3, 13.9, 16.1, 18.5, 21.5],
  60: [13.7, 15.6, 18.2, 21.2, 24.9]
};

export default function WHOWeightForAge({ childData, gender }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!childData || !childData.weight) return;
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
    const maxWeight = 26;

    const getX = (age) => padding.left + (age / maxAge) * chartWidth;
    const getY = (weight) => padding.top + chartHeight - (weight / maxWeight) * chartHeight;

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

      ages.forEach((age, i) => {
        const weight = whoData[age][index];
        const x = getX(age);
        const y = getY(weight);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      const lastAge = ages[ages.length - 1];
      const lastWeight = whoData[lastAge][index];
      ctx.fillStyle = color;
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(label, getX(lastAge) + 5, getY(lastWeight) + 4);
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
    for (let weight = 0; weight <= maxWeight; weight += 2) {
      const y = getY(weight);
      ctx.fillText(weight, padding.left - 10, y);
    }

    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Age (months)', width / 2, height - 25);

    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Weight (kg)', 0, 0);
    ctx.restore();

    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(
      `WHO Weight-for-Age (${gender === 'girl' ? 'Girls' : 'Boys'} 0-5 years)`,
      width / 2,
      10
    );

    // Plot child's data point
    if (childData && childData.age !== undefined && childData.weight !== undefined) {
      const childAge = childData.age;
      const childWeight = childData.weight;
      const x = getX(childAge);
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
        `${childWeight}kg at ${childAge}mo`,
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
