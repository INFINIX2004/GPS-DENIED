import React from 'react';

interface VideoFeedProps {
  isLive: boolean;
  resolution: string;
  latency: number;
}

export function VideoFeed({ isLive, resolution, latency }: VideoFeedProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
          <h2 className="text-gray-900">Live Video Feed</h2>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            {isLive ? (
              <>
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-red-600">LIVE</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span className="text-gray-500">OFFLINE</span>
              </>
            )}
          </div>
          <span className="text-gray-500">{resolution}</span>
          <span className="text-gray-500">{latency}ms</span>
        </div>
      </div>
      
      <div className="flex-1 bg-gray-900 rounded-lg overflow-hidden relative">
        {/* Video placeholder - replace with actual video element */}
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Drone Camera Feed</p>
            <p className="text-sm text-gray-500 mt-2">Waiting for video stream...</p>
          </div>
        </div>
        
        {/* Overlay indicators */}
        <div className="absolute top-3 left-3 space-y-2">
          <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-md text-white text-xs">
            Camera 1 - Primary
          </div>
          <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-md text-white text-xs">
            GPS: 37.7749° N, 122.4194° W
          </div>
        </div>
        
        <div className="absolute bottom-3 right-3">
          <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-md text-white text-xs">
            Altitude: 45m
          </div>
        </div>
      </div>
    </div>
  );
}
