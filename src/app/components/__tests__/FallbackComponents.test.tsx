import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { 
  GenericFallback,
  SystemStatusFallback,
  IntruderListFallback,
  ThreatIntelligenceFallback,
  AlertsPanelFallback,
  VideoFeedFallback,
  LoadingFallback
} from '../FallbackComponents';

describe('FallbackComponents', () => {
  describe('GenericFallback', () => {
    it('should render with default props', () => {
      render(<GenericFallback />);
      
      expect(screen.getByText('Component Unavailable')).toBeInTheDocument();
      expect(screen.getByText(/temporarily unavailable/)).toBeInTheDocument();
    });

    it('should render with custom props', () => {
      render(
        <GenericFallback 
          title="Custom Title"
          message="Custom message"
        />
      );
      
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
      expect(screen.getByText('Custom message')).toBeInTheDocument();
    });
  });

  describe('SystemStatusFallback', () => {
    it('should render system status fallback', () => {
      render(<SystemStatusFallback />);
      
      expect(screen.getByText('System Status')).toBeInTheDocument();
      expect(screen.getByText('System status unavailable')).toBeInTheDocument();
      expect(screen.getAllByText('Offline')).toHaveLength(7); // 7 status cards
    });
  });

  describe('IntruderListFallback', () => {
    it('should render no-data state by default', () => {
      render(<IntruderListFallback />);
      
      expect(screen.getByText('Active Intruders')).toBeInTheDocument();
      expect(screen.getByText('Detection Unavailable')).toBeInTheDocument();
    });

    it('should render no-data state', () => {
      render(<IntruderListFallback reason="no-data" />);
      
      expect(screen.getByText('No Active Threats')).toBeInTheDocument();
      expect(screen.getByText(/All clear/)).toBeInTheDocument();
    });

    it('should render offline state', () => {
      render(<IntruderListFallback reason="offline" />);
      
      expect(screen.getByText('System Offline')).toBeInTheDocument();
      expect(screen.getByText(/camera or processing system is offline/)).toBeInTheDocument();
    });
  });

  describe('ThreatIntelligenceFallback', () => {
    it('should render no-selection state by default', () => {
      render(<ThreatIntelligenceFallback />);
      
      expect(screen.getByText('Select an Intruder')).toBeInTheDocument();
      expect(screen.getByText(/Choose an intruder from the list/)).toBeInTheDocument();
    });

    it('should render no-data state', () => {
      render(<ThreatIntelligenceFallback reason="no-data" />);
      
      expect(screen.getByText('No Intelligence Data')).toBeInTheDocument();
    });

    it('should render offline state', () => {
      render(<ThreatIntelligenceFallback reason="offline" />);
      
      expect(screen.getByText('Analysis Offline')).toBeInTheDocument();
    });
  });

  describe('AlertsPanelFallback', () => {
    it('should render alerts panel fallback', () => {
      render(<AlertsPanelFallback />);
      
      expect(screen.getByText('ALERT LEVEL')).toBeInTheDocument();
      expect(screen.getByText('UNKNOWN')).toBeInTheDocument();
      expect(screen.getByText('SYSTEM RECOMMENDATION')).toBeInTheDocument();
      expect(screen.getByText('No alert data available')).toBeInTheDocument();
    });
  });

  describe('VideoFeedFallback', () => {
    it('should render offline state by default', () => {
      render(<VideoFeedFallback />);
      
      expect(screen.getByText('Video Offline')).toBeInTheDocument();
      expect(screen.getByText(/currently unavailable/)).toBeInTheDocument();
    });

    it('should render connecting state', () => {
      render(<VideoFeedFallback reason="connecting" />);
      
      expect(screen.getByText('Connecting...')).toBeInTheDocument();
      expect(screen.getByText(/Establishing connection/)).toBeInTheDocument();
    });

    it('should render no-camera state', () => {
      render(<VideoFeedFallback reason="no-camera" />);
      
      expect(screen.getByText('Camera Offline')).toBeInTheDocument();
      expect(screen.getByText(/not connected or has lost signal/)).toBeInTheDocument();
    });

    it('should render error state', () => {
      render(<VideoFeedFallback reason="error" />);
      
      expect(screen.getByText('Stream Error')).toBeInTheDocument();
      expect(screen.getByText(/Unable to load video stream/)).toBeInTheDocument();
    });
  });

  describe('LoadingFallback', () => {
    it('should render with default props', () => {
      render(<LoadingFallback />);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.getByText(/Please wait while we load/)).toBeInTheDocument();
    });

    it('should render with custom props', () => {
      render(
        <LoadingFallback 
          title="Custom Loading"
          message="Custom loading message"
        />
      );
      
      expect(screen.getByText('Custom Loading')).toBeInTheDocument();
      expect(screen.getByText('Custom loading message')).toBeInTheDocument();
    });
  });
});