import React from 'react';
import { JMASeismicIntensity } from '../types';

interface Props {
  scale: JMASeismicIntensity;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'circle' | 'square';
}

export const IntensityBadge: React.FC<Props> = ({ scale, size = 'md', variant = 'square' }) => {
  let bgColor = 'bg-gray-500';
  let textColor = 'text-white';
  let label = '';

  // Colors based on standard JMA/Screenshot
  switch (scale) {
    case 10: label = '1'; bgColor = 'bg-gray-500'; textColor = 'text-white'; break; // 1
    case 20: label = '2'; bgColor = 'bg-blue-500'; textColor = 'text-white'; break; // 2
    case 30: label = '3'; bgColor = 'bg-blue-700'; textColor = 'text-white'; break; // 3
    case 40: label = '4'; bgColor = 'bg-yellow-400'; textColor = 'text-black'; break; // 4
    case 45: label = '5-'; bgColor = 'bg-orange-500'; textColor = 'text-black'; break; // 5-
    case 50: label = '5+'; bgColor = 'bg-orange-600'; textColor = 'text-black'; break; // 5+
    case 55: label = '6-'; bgColor = 'bg-red-600'; textColor = 'text-white'; break; // 6-
    case 60: label = '6+'; bgColor = 'bg-red-700'; textColor = 'text-white'; break; // 6+
    case 70: label = '7'; bgColor = 'bg-purple-800'; textColor = 'text-white'; break; // 7
    default: label = '?';
  }

  // Override for size lg (e.g. Info Panel) to always be clearer
  const sizeClass = size === 'sm' ? 'w-5 h-5 text-[10px]' : size === 'lg' ? 'w-16 h-16 text-3xl font-bold' : 'w-8 h-8 text-sm font-bold';
  
  const shapeClass = variant === 'circle' ? 'rounded-full' : 'rounded-md';

  return (
    <div className={`${sizeClass} ${bgColor} ${textColor} ${shapeClass} flex items-center justify-center shadow-md border border-black/10`}>
      {label}
    </div>
  );
};