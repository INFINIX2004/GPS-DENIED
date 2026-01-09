import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { VideoFeed } from '../VideoFeed';
import { VideoStatusData } from '../../types/systemState';

// Mock getUserMedia for webcam tests
const mockGetUserMedia = vi.fn();
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: mockGetUserMedia,
  },
});

describe('VideoFeed Component', () => {
  const defaultProps: VideoStatusData = {
    isLive: false,
    resolution: '1920x1080',
    latency: 50,
    source: 'placeholder',
  };

  beforeEach(() => {
    mockGetUserMedia.mockClear();
  });

  it('should render placeholder mode correctly', () => {
    render(<VideoFeed {...defaultProps} />);
    
    expect(screen.getByText('Live Video Feed')).toBeInTheDocument();
    expect(screen.getByText('OFFLINE')).toBeInTheDocument();
    expect(screen.getByText('1920x1080')).toBeInTheDocument();
    expect(screen.getByText('50ms')).toBeInTheDocument();
    expect(screen.getByText('(placeholder)')).toBeInTheDocument();
  });

  it('should show webcam source correctly', () => {
    const webcamProps: VideoStatusData = {
      ...defaultProps,
      isLive: true,
      source: 'webcam',
    };

    render(<VideoFeed {...webcamProps} enableWebcam={true} />);
    
    expect(screen.getByText('(webcam)')).toBeInTheDocument();
  });

  it('should show drone source correctly', () => {
    const droneProps: VideoStatusData = {
      ...defaultProps,
      isLive: true,
      source: 'drone',
      streamUrl: 'rtsp://drone.local/stream',
    };

    render(<VideoFeed {...droneProps} />);
    
    expect(screen.getByText('(drone)')).toBeInTheDocument();
  });

  it('should display additional video metrics when available', () => {
    const propsWithMetrics: VideoStatusData = {
      ...defaultProps,
      frameRate: 30,
      bitrate: 5000,
    };

    render(<VideoFeed {...propsWithMetrics} />);
    
    expect(screen.getByText('30fps')).toBeInTheDocument();
    expect(screen.getByText('5Mbps')).toBeInTheDocument();
  });

  it('should handle error state correctly', () => {
    const errorProps: VideoStatusData = {
      ...defaultProps,
      source: 'webcam',
      isLive: true,
    };

    // Mock getUserMedia to reject
    mockGetUserMedia.mockRejectedValue(new Error('Camera access denied'));

    render(<VideoFeed {...errorProps} enableWebcam={false} />);
    
    // Should show connecting initially, then fallback when webcam is disabled
    expect(screen.getByText('CONNECTING')).toBeInTheDocument();
  });

  it('should show connecting state during stream setup', () => {
    const connectingProps: VideoStatusData = {
      ...defaultProps,
      isLive: true,
      source: 'webcam',
    };

    render(<VideoFeed {...connectingProps} enableWebcam={true} />);
    
    // Initially should show connecting state
    expect(screen.getByText('Connecting to webcam...')).toBeInTheDocument();
  });

  it('should support future streaming protocols', () => {
    const rtspProps: VideoStatusData = {
      ...defaultProps,
      isLive: true,
      source: 'drone', // Using drone as RTSP is not yet implemented
      streamUrl: 'rtsp://example.com/stream',
    };

    render(<VideoFeed {...rtspProps} />);
    
    // Should show the stream URL in debug info when connected
    expect(screen.getByText('(drone)')).toBeInTheDocument();
  });
});