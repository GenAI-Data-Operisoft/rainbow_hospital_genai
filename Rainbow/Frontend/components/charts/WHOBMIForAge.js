import { useEffect, useRef } from 'react';

// WHO BMI-for-Age Standards (0-60 months) - Boys
const WHO_BOYS_DATA = {
  0: [11.1, 12.2, 13.4, 14.8, 16.3],
  1: [12.4, 13.6, 14.9, 16.3, 17.8],
  2: [13.7, 14.9, 16.3, 17.8, 19.4],
  3: [14.3, 15.5, 16.9, 18.5, 20.1],
  6: [15.3, 16.5, 17.8, 19.4, 21.1],
  9: [15.6, 16.9, 18.3, 19.9, 21.7],
  12: [15.8, 17.0, 18.5, 20.1, 21.9],
  15: [15.8, 17.1, 18.6, 20.3, 22.1],
  18: [15.7, 17.0, 18.6, 20.4, 22.3],
  24: [15.3, 16.6, 18.2, 20.0, 22.0],
  30: [14.9, 16.2, 17.8, 19.7, 21.8],
  36: [14.6, 15.8, 17.5, 19.4, 21.6],
  48: [14.0, 15.2, 16.9, 18.9, 21.2],
  60: [13.6, 14.8, 16.5, 18.6, 21.0]
};

// WHO BMI-for-Age Standards (0-60 months) - Girls
const WHO_GIRLS_DATA = {
  0: [10.8, 11.9, 13.1, 14.6, 16.1],
  1: [12.1, 13.3, 14.6, 16.1, 17.7],
  2: [13.4, 14.6, 16.0, 17.6, 19.4],
  3: [14.0, 15.2, 16.7, 18.3, 20.1],
  6: [15.0, 16.2, 17.7, 19.4, 21.3],
  9: [15.3, 16.6, 18.1, 19.9, 21.9],
  12: [15.4, 16.8, 18.3, 20.2, 22.3],
  15: [15.4, 16.8, 18.4, 20.3, 22.5],
  18: [15.3, 16.7, 18.4, 20.4, 22.7],
  24: [14.8, 16.2, 18.0, 20.1, 22.6],
  30: [14.4, 15.8, 17.6, 19.8, 22.4],
  36: [14.1, 15.4, 17.2, 19.5, 22.2],
  48: [13.5, 14.8, 16.6, 19.0, 21.9],
  60: [13.1, 14.4, 16.2, 18.7, 21.8]
};

export default function WHOBMIForAge({ childData, gender, bmi }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!childData || bmi === null) return;
    drawChart();
  }, [childData, gender, bmi, childData?.age]);

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
    const maxBMI = 24;
    const minBMI = 10;

    const getX = (age) => padding.left + (age / maxAge) * chartWidth;
    const getY = (bmiVal) => padding.top + chartHeight - ((bmiVal - minBMI) / (maxBMI - minBMI)) * chartHeight;

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

    for (let bmiVal = 10; bmiVal <= maxBMI; bmiVal += 2) {
      const y = getY(bmiVal);
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
        const bmiVal = whoData[age][index];
        const x = getX(age);
        const y = getY(bmiVal);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      const lastAge = ages[ages.length - 1];
      const lastBMI = whoData[lastAge][index];
      ctx.fillStyle = color;
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(label, getX(lastAge) + 5, getY(lastBMI) + 4);
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
    for (let bmiVal = 10; bmiVal <= maxBMI; bmiVal += 2) {
      const y = getY(bmiVal);
      ctx.fillText(bmiVal.toFixed(0), padding.left - 10, y);
    }

    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Age (months)', width / 2, height - 25);

    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('BMI (kg/m²)', 0, 0);
    ctx.restore();

    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(
      `WHO BMI-for-Age (${gender === 'girl' ? 'Girls' : 'Boys'} 0-5 years)`,
      width / 2,
      10
    );

    // Plot child's data point
    if (childData && childData.age !== undefined && bmi !== null) {
      const childAge = childData.age;
      const x = getX(childAge);
      const y = getY(bmi);

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
        `BMI ${bmi.toFixed(1)} at ${childAge}mo`,
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
