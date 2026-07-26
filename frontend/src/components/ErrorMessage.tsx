// src/components/ErrorMessage.tsx

import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onRetry }) => {
  return (
    <div className="flex rounded-lg bg-red-50 border-l-4 border-red-400 p-4 shadow-sm">
      <div className="flex-shrink-0">
        <AlertCircle className="h-5 w-5 text-red-400" />
      </div>
      <div className="ml-3 flex-1">
        <h3 className="text-sm font-semibold text-red-800">Error</h3>
        <p className="mt-1 text-sm text-red-700">{message}</p>

        {onRetry && (
          <div className="mt-3">
            <button
              type="button"
              onClick={onRetry}
              className="btn-secondary text-red-600 border-red-300 hover:bg-red-50"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage;
