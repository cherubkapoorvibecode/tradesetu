
import React from 'react';

interface InfoTooltipProps {
  content: string;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ content }) => {
  return (
    <div className="group relative inline-block ml-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-5 h-5 text-gray-400 cursor-help hover:text-blue-500 transition-colors"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
        />
      </svg>
      <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-md w-64 text-center transition-all duration-200 shadow-lg">
        {content}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-8 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
};

export default InfoTooltip;
