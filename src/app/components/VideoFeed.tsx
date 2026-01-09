import React, { useRef, useEffect, useState } from 'react';
import { VideoStatusData } from '../types/systemState';
import { useErrorLogger } from '../services/errorLoggingService';
import { validateVideoStatus } from '../utils/dataValidation';

interface VideoFeedProps extends VideoStatusData {
  // Additional props for future extensibility
  onStreamError?: (error: Error) => void;
  onStreamLoad?: () => void;
  enableWebcam?: boolean;
  fallbackToPlaceholder?: boolean;
}

// Stream protocol handlers for future implementation
interface StreamHandler {
  protocol: 'webrtc' | 'mjpeg' | 'rtsp' | 'webcam' | 'placeholder';
  connect: (url?: string) => Promise<void>;
  disconnect: () => void;
  isSupported: () => boolean;
}

export const VideoFeed = React.memo(function VideoFeed(props: VideoFeedProps) {
  const { logError, logWarning, logInfo } = useErrorLogger();
  
  // Validate and sanitize video status data
  const validatedProps = React.useMemo(() => {
    try {
      const validated = validateVideoStatus(props);
      return {
        ...validated,
        onStreamError: props.onStreamError,
        onStreamLoad: props.onStreamLoad,
        enableWebcam: props.enableWebcam ?? true,
        fallbackToPlaceholder: props.fallbackToPlaceholder ?? true
      };
    } catch (error) {
      logWarning('VideoFeed', 'Invalid video props received, using defaults', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        receivedProps: props 
      });
      const defaultProps = validateVideoStatus(null);
      return {
        ...defaultProps,
        onStreamError: props.onStreamError,
        onStreamLoad: props.onStreamLoad,
        enableWebcam: true,
        fallbackToPlaceholder: true
      };
    }
  }, [props, logWarning]);

  const { 
    isLive, 
    resolution, 
    latency, 
    source, 
    streamUrl, 
    frameRate, 
    bitrate,
    onStreamError,
    onStreamLoad,
    enableWebcam,
    fallbackToPlaceholder
  } = validatedProps;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streamState, setStreamState] = useState<{
    status: 'idle' | 'connecting' | 'connected' | 'error' | 'fallback';
    error?: string;
  }>({ status: 'idle' });

  // Stream handlers for different protocols (hooks for future implementation)
  const streamHandlers: Record<string, StreamHandler> = {
    webrtc: {
      protocol: 'webrtc',
      connect: async (url?: string) => {
        // WebRTC implementation placeholder
        logInfo('VideoFeed', 'WebRTC connection requested', { url });
        // Future: Implement WebRTC peer connection
        throw new Error('WebRTC not yet implemented');
      },
      disconnect: () => {
        logInfo('VideoFeed', 'WebRTC disconnect requested');
      },
      isSupported: () => {
        return typeof RTCPeerConnection !== 'undefined';
      }
    },
    mjpeg: {
      protocol: 'mjpeg',
      connect: async (url?: string) => {
        // MJPEG implementation for bridge server
        logInfo('VideoFeed', 'MJPEG connection requested', { url });
        if (url) {
          // For MJPEG, we just need to set the URL - the img element will handle it
          return Promise.resolve();
        }
        throw new Error('MJPEG URL required');
      },
      disconnect: () => {
        logInfo('VideoFeed', 'MJPEG disconnect requested');
      },
      isSupported: () => true
    },
    rtsp: {
      protocol: 'rtsp',
      connect: async (url?: string) => {
        // RTSP implementation placeholder
        logInfo('VideoFeed', 'RTSP connection requested', { url });
        // Future: Implement RTSP over WebSocket or HLS conversion
        throw new Error('RTSP not yet implemented - requires backend conversion');
      },
      disconnect: () => {
        logInfo('VideoFeed', 'RTSP disconnect requested');
      },
      isSupported: () => false // Requires backend support
    },
    webcam: {
      protocol: 'webcam',
      connect: async () => {
        if (!enableWebcam) {
          throw new Error('Webcam access disabled');
        }
        
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30 }
            } 
          });
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
          logInfo('VideoFeed', 'Webcam stream connected successfully');
        } catch (error) {
          const errorMessage = `Webcam access failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
          logError('VideoFeed', errorMessage, { error });
          throw new Error(errorMessage);
        }
      },
      disconnect: () => {
        if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          videoRef.current.srcObject = null;
        }
      },
      isSupported: () => {
        return typeof navigator !== 'undefined' && 
               typeof navigator.mediaDevices !== 'undefined' &&
               typeof navigator.mediaDevices.getUserMedia !== 'undefined';
      }
    },
    placeholder: {
      protocol: 'placeholder',
      connect: async () => {
        // Placeholder mode - no actual connection needed
        logInfo('VideoFeed', 'Placeholder mode activated');
      },
      disconnect: () => {
        logInfo('VideoFeed', 'Placeholder mode deactivated');
      },
      isSupported: () => true
    }
  };

  // Effect to handle stream connection based on source
  useEffect(() => {
    const connectStream = async () => {
      if (!isLive && source === 'placeholder') {
        setStreamState({ status: 'idle' });
        return;
      }

      if (!isLive && !fallbackToPlaceholder) {
        setStreamState({ status: 'idle' });
        return;
      }

      const handler = streamHandlers[source];
      if (!handler) {
        logWarning('VideoFeed', `Unknown stream source: ${source}`);
        if (fallbackToPlaceholder) {
          setStreamState({ status: 'fallback' });
        } else {
          setStreamState({ status: 'error', error: `Unsupported source: ${source}` });
        }
        return;
      }

      if (!handler.isSupported()) {
        logWarning('VideoFeed', `Stream source not supported: ${source}`);
        if (fallbackToPlaceholder) {
          setStreamState({ status: 'fallback' });
        } else {
          setStreamState({ status: 'error', error: `${source} not supported in this environment` });
        }
        return;
      }

      try {
        setStreamState({ status: 'connecting' });
        await handler.connect(streamUrl);
        setStreamState({ status: 'connected' });
        logInfo('VideoFeed', `Stream connected successfully`, { source, streamUrl });
        onStreamLoad?.();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Stream connection failed';
        logError('VideoFeed', `Stream connection failed for ${source}`, { 
          error: errorMessage,
          source,
          streamUrl 
        });
        
        if (fallbackToPlaceholder && source !== 'placeholder') {
          setStreamState({ status: 'fallback' });
        } else {
          setStreamState({ status: 'error', error: errorMessage });
          onStreamError?.(error instanceof Error ? error : new Error(errorMessage));
        }
      }
    };

    connectStream();

    // Cleanup on unmount or source change
    return () => {
      const handler = streamHandlers[source];
      if (handler) {
        handler.disconnect();
      }
    };
  }, [isLive, source, streamUrl, enableWebcam, fallbackToPlaceholder, onStreamError, onStreamLoad]);

  // Render stream status indicator
  const renderStreamStatus = () => {
    const getStatusInfo = () => {
      switch (streamState.status) {
        case 'connecting':
          return { color: 'text-amber-600', text: 'CONNECTING', dot: 'bg-amber-500 animate-pulse' };
        case 'connected':
          return { color: 'text-emerald-600', text: 'LIVE', dot: 'bg-emerald-500 animate-pulse' };
        case 'error':
          return { color: 'text-red-600', text: 'ERROR', dot: 'bg-red-500' };
        case 'fallback':
          return { color: 'text-blue-600', text: 'PLACEHOLDER', dot: 'bg-blue-500' };
        default:
          return { color: 'text-gray-500', text: 'OFFLINE', dot: 'bg-gray-400' };
      }
    };

    const { color, text, dot } = getStatusInfo();
    
    return (
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${dot}`}></div>
        <span className={color}>{text}</span>
      </div>
    );
  };

  // Render video content based on source and state
  const renderVideoContent = () => {
    if (streamState.status === 'error') {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-red-300 border-t-red-500 rounded-full mx-auto mb-4"></div>
            <p className="text-red-400 mb-2">Stream Error</p>
            <p className="text-sm text-gray-500">{streamState.error}</p>
          </div>
        </div>
      );
    }

    if (streamState.status === 'connecting') {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Connecting to {source}...</p>
            <p className="text-sm text-gray-500 mt-2">Establishing stream connection</p>
          </div>
        </div>
      );
    }

    if (source === 'webcam' && streamState.status === 'connected') {
      return (
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          muted
          playsInline
        />
      );
    }

    if ((source === 'mjpeg' || source === 'rtsp') && streamState.status === 'connected') {
      return (
        <img
          src={streamUrl}
          className="w-full h-full object-cover"
          alt="Live video stream"
          onError={() => {
            setStreamState({ status: 'error', error: 'Stream connection lost' });
          }}
        />
      );
    }

    // Placeholder mode or fallback
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">
            {streamState.status === 'fallback' ? 'Placeholder Mode' : 'Drone Camera Feed'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {streamState.status === 'fallback' 
              ? `${source} unavailable - using placeholder`
              : 'Waiting for video stream...'
            }
          </p>
        </div>
      </div>
    );
  };

  return (
    <div data-testid="video-feed" className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
          <h2 className="text-gray-900">Live Video Feed</h2>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {renderStreamStatus()}
          <span className="text-gray-500">{resolution}</span>
          <span className="text-gray-500">{latency}ms</span>
          {frameRate && <span className="text-gray-500">{frameRate}fps</span>}
          {bitrate && <span className="text-gray-500">{Math.round(bitrate/1000)}Mbps</span>}
          <span className="text-gray-400 text-xs">({source})</span>
        </div>
      </div>
      
      <div className="flex-1 bg-gray-900 rounded-lg overflow-hidden relative">
        {renderVideoContent()}
        
        {/* Overlay indicators - only show when connected */}
        {streamState.status === 'connected' && (
          <>
            <div className="absolute top-3 left-3 space-y-2">
              <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-md text-white text-xs">
                {source === 'webcam' ? 'Webcam - Development' : 
                 source === 'drone' ? 'Camera 1 - Primary' : 
                 `${source.toUpperCase()} Stream`}
              </div>
              {source !== 'webcam' && (
                <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-md text-white text-xs">
                  GPS: 37.7749° N, 122.4194° W
                </div>
              )}
            </div>
            
            <div className="absolute bottom-3 right-3">
              <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-md text-white text-xs">
                {source === 'webcam' ? 'Local Feed' : 'Altitude: 45m'}
              </div>
            </div>
          </>
        )}
        
        {/* Stream URL indicator for debugging */}
        {streamUrl && streamState.status === 'connected' && (
          <div className="absolute bottom-3 left-3">
            <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-md text-white text-xs">
              {streamUrl.length > 30 ? `${streamUrl.substring(0, 30)}...` : streamUrl}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
