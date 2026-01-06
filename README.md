# AeroVision Dashboard

A real-time surveillance dashboard for the AeroVision drone-based intelligent surveillance system. This dashboard displays live system intelligence, threat analysis, and behavioral predictions from the AeroVision computer vision pipeline.

## Features

- **Real-time System Status**: Power consumption, battery life, FPS, camera status
- **Live Threat Detection**: Dynamic threat list with automatic highest-threat highlighting
- **Behavioral Analysis**: Loitering detection, speed anomalies, trajectory analysis
- **Predictive Intelligence**: Near/medium/far-term trajectory predictions
- **Alert Management**: Real-time alert timeline with severity levels
- **Video Feed Integration**: Live drone camera feed display
- **Automatic Failover**: WebSocket with HTTP polling fallback

## Architecture

The dashboard follows a clean, modular architecture:

```
src/app/
├── components/          # UI components
│   ├── SystemStatus.tsx    # System metrics display
│   ├── IntruderList.tsx    # Threat list with selection
│   ├── ThreatIntelligence.tsx # Detailed threat analysis
│   ├── AlertsPanel.tsx     # Alert timeline
│   └── VideoFeed.tsx       # Live video display
├── services/            # Data services
│   └── aeroVisionService.ts # WebSocket/API integration
├── hooks/               # React hooks
│   └── useAeroVision.ts    # Data management hook
├── config/              # Configuration
│   └── aeroVisionConfig.ts # System settings
└── App.tsx             # Main application
```

## Data Integration

The dashboard is designed to receive structured JSON data from AeroVision at 5-10 Hz via:
- **Primary**: WebSocket connection (`ws://localhost:8080/aerovision/stream`)
- **Fallback**: HTTP polling (`http://localhost:8080/aerovision/data`)

### Expected Data Format

```json
{
  "system": {
    "power_mode": "ACTIVE",
    "power_w": 8.6,
    "battery_minutes": 420,
    "fps": 24.7,
    "camera_status": "CONNECTED",
    "timestamp": "HH:MM:SS"
  },
  "tracks": [
    {
      "id": 3,
      "zone": "RESTRICTED",
      "threat_score": 72,
      "threat_level": "HIGH",
      "detection_time": 18,
      "behavior": {
        "loitering": { "active": true, "duration": 96 },
        "speed_anomaly": false,
        "trajectory_confidence": 0.84
      },
      "prediction": {
        "near": { "zone": "RESTRICTED", "confidence": 0.84 },
        "medium": { "zone": "CRITICAL", "confidence": 0.71 },
        "far": { "zone": "CRITICAL", "confidence": 0.55 }
      },
      "explanation": [
        { "factor": "Zone violation", "points": 30 },
        { "factor": "Loitering detected", "points": 15 },
        { "factor": "Speed anomaly", "points": 10 }
      ]
    }
  ],
  "alerts": [
    { "time": "12:03:21", "message": "Entered RESTRICTED zone", "level": "WARNING" }
  ]
}
```

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- AeroVision system (optional - includes mock data)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd aerovision-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure connection** (optional)
   
   Edit `src/app/config/aeroVisionConfig.ts`:
   ```typescript
   export const aeroVisionConfig = {
     useMockData: false, // Set to false for real AeroVision
     websocketUrl: 'ws://your-aerovision-host:8080/aerovision/stream',
     apiUrl: 'http://your-aerovision-host:8080/aerovision/data',
     // ... other settings
   };
   ```

4. **Start the dashboard**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   
   Navigate to `http://localhost:5173`

## Configuration

### Environment Variables

Create a `.env` file for production deployment:

```env
REACT_APP_AEROVISION_WS_URL=ws://production-host:8080/aerovision/stream
REACT_APP_AEROVISION_API_URL=http://production-host:8080/aerovision/data
```

### Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| `useMockData` | Use simulated data instead of real AeroVision | `true` |
| `websocketUrl` | WebSocket endpoint for real-time data | `ws://localhost:8080/aerovision/stream` |
| `apiUrl` | HTTP API endpoint for data polling | `http://localhost:8080/aerovision/data` |
| `mockUpdateInterval` | Mock data update frequency (ms) | `200` |
| `autoSelectHighestThreat` | Auto-select highest threat score | `true` |
| `maxReconnectAttempts` | Max WebSocket reconnection attempts | `5` |

## Development

### Mock Data Mode

By default, the dashboard runs with realistic mock data that simulates:
- Dynamic threat scores and behaviors
- System status changes
- Camera connection states
- Real-time alerts

This allows development and testing without a live AeroVision system.

### Real Data Integration

To connect to a live AeroVision system:

1. Set `useMockData: false` in config
2. Update WebSocket and API URLs
3. Ensure AeroVision system is running and accessible
4. Dashboard will automatically handle connection and failover

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory, ready for deployment.

## API Integration

### WebSocket Protocol

The dashboard expects real-time JSON messages via WebSocket:

```javascript
// Connect to AeroVision stream
const ws = new WebSocket('ws://aerovision-host:8080/aerovision/stream');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Dashboard automatically processes this format
};
```

### HTTP API

Fallback HTTP endpoint should return the same JSON structure:

```bash
GET /aerovision/data
Content-Type: application/json

{
  "system": { ... },
  "tracks": [ ... ],
  "alerts": [ ... ]
}
```

## Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

### Environment Setup

For production deployment:

1. **Configure endpoints** in environment variables
2. **Set `useMockData: false`** in production config
3. **Ensure network access** to AeroVision system
4. **Monitor connection status** via dashboard header

## Troubleshooting

### Connection Issues

- **WebSocket fails**: Dashboard automatically falls back to HTTP polling
- **No data received**: Check AeroVision system status and network connectivity
- **Mock data only**: Verify `useMockData` setting in config

### Performance

- **High CPU usage**: Reduce update frequency in config
- **Memory leaks**: Dashboard automatically cleans up connections
- **Slow rendering**: Check browser developer tools for performance bottlenecks

### Common Issues

| Issue | Solution |
|-------|----------|
| "System Offline" status | Check WebSocket URL and AeroVision system |
| Empty threat list | Verify data format matches expected structure |
| No video feed | Video component is placeholder - integrate with your video system |
| Connection errors | Check network access and CORS settings |

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For technical support or integration questions:
- Check the troubleshooting section above
- Review configuration options
- Ensure AeroVision system compatibility
  