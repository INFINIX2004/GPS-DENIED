# Welcome to this project

## Project info

This is a GPS-Denied Drone Dashboard that displays real-time telemetry data, obstacle detection, system logs, and flight status.

**⚠️ Important: Currently Using Demo Data**
The dashboard currently connects to a mock WebSocket server (`server/websocket-server.js`) that generates simulated drone data for demonstration purposes. See the "Replacing Demo Data with Real Backend" section below for production deployment instructions.

## Demo Data vs Real Backend

### Current Demo Data Setup
- **Mock Server**: `server/websocket-server.js` generates fake telemetry and log data
- **WebSocket Connection**: Frontend connects to `ws://localhost:8081`
- **Data Flow**: Mock server broadcasts telemetry every 1 second and logs every 2-5 seconds
- **Connect/Disconnect**: Button in dashboard controls connection to mock server

### Replacing Demo Data with Real Backend

To connect this dashboard to your real drone backend:

#### 1. Update WebSocket Connection
Edit `src/hooks/useWebSocket.ts`:
```typescript
// Change this line (around line 35):
export const useWebSocket = (url: string = 'ws://localhost:8081') => {
// To your real WebSocket endpoint:
export const useWebSocket = (url: string = 'wss://your-drone-api.com/telemetry') => {
```

#### 2. Data Structure Requirements
Your real backend must send WebSocket messages in this format:
```json
// Telemetry data message
{
  "type": "telemetry",
  "payload": {
    "battery": 85,
    "mode": "Auto",
    "connectivity": "Connected",
    "signal_strength": 78,
    "altitude": 25.3,
    "speed": 12.5,
    "heading": 45,
    "pitch": 2.1,
    "roll": -1.8,
    "yaw": 45.2,
    "position": {
      "latitude": 37.7749,
      "longitude": -122.4194,
      "heading": 45
    },
    "obstacles": [
      {"id": "1", "angle": 30, "distance": 45, "type": "static"}
    ]
  }
}

// Log message
{
  "type": "log",
  "payload": {
    "level": "info", // "info" | "warning" | "error"
    "category": "NAVIGATION", // or any category
    "message": "Your log message here"
  }
}
```

#### 3. Environment Variables (Optional)
Create a `.env` file in your project root for configuration:
```env
VITE_WEBSOCKET_URL=wss://your-drone-api.com/telemetry
VITE_API_KEY=your_api_key_here
```

Then update `src/hooks/useWebSocket.ts`:
```typescript
const defaultUrl = import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:8081';
export const useWebSocket = (url: string = defaultUrl) => {
```

#### 4. Authentication (If Required)
If your backend requires authentication, modify the WebSocket connection in `src/hooks/useWebSocket.ts`:
```typescript
const connect = () => {
  const wsUrl = new URL(url);
  wsUrl.searchParams.append('token', 'your-auth-token');
  wsRef.current = new WebSocket(wsUrl.toString());
  // ... rest of connection logic
};
```

#### 5. Files You Need to Modify
- `src/hooks/useWebSocket.ts` - Change WebSocket URL and add auth if needed
- `.env` (create new) - Add environment variables for your backend
- `src/components/Dashboard/DroneStatusCard.tsx` - Modify error handling if your error format differs
- `server/websocket-server.js` - Replace entirely with your real backend (or delete)

#### 6. Backend API Requirements
Your real backend WebSocket server should:
- Accept WebSocket connections on your chosen endpoint
- Send initial telemetry data when client connects
- Broadcast telemetry updates at regular intervals (recommended: 1-2 seconds)
- Send log messages as they occur
- Handle connection/disconnection gracefully

#### 7. Testing Your Integration
1. Update the WebSocket URL in `useWebSocket.ts`
2. Start your real backend WebSocket server
3. Run `npm run dev` (without the mock server)
4. Use the Connect/Disconnect button to test the connection
5. Verify telemetry data displays correctly
6. Check that logs appear in the logs panel

## Production Deployment on Raspberry Pi 5

### Architecture Overview

When deployed in production, this dashboard connects to a **Raspberry Pi 5 backend** that interfaces directly with drone hardware. The Pi acts as the central hub for processing real-time telemetry, managing system logs, and streaming data to the dashboard via WebSocket.

<lov-mermaid>
graph TD
    A[Drone Hardware] -->|MAVLink/Serial| B[Raspberry Pi 5]
    B -->|WebSocket| C[Dashboard Frontend]
    
    subgraph "Raspberry Pi 5 Backend"
        D[MAVLink Parser]
        E[WebSocket Server]
        F[Error Handler]
        G[Log Manager]
        H[System Monitor]
        
        D --> E
        F --> E
        G --> E
        H --> E
    end
    
    subgraph "Dashboard Components"
        I[Telemetry Display]
        J[Error Panel]
        K[Logs Panel]
        L[Map/Radar]
    end
    
    B --> D
    C --> I
    C --> J
    C --> K
    C --> L
</lov-mermaid>

### Configuration Modes

The dashboard supports two distinct operation modes:

#### Demo Mode (Default)
- **Purpose**: Development, testing, and demonstration
- **Backend**: Mock WebSocket server (`server/websocket-server.js`)
- **Data Source**: Simulated telemetry, logs, and errors
- **Connection**: `ws://localhost:8081`
- **Use Case**: Local development without drone hardware

#### Production Mode (Pi Backend)
- **Purpose**: Live drone operations
- **Backend**: Raspberry Pi 5 with real drone interface
- **Data Source**: Live MAVLink telemetry from drone autopilot
- **Connection**: `ws://[PI_IP_ADDRESS]:8081` or custom port
- **Use Case**: Field operations with actual drone

### Raspberry Pi Backend Components

The Pi backend is designed to be **lightweight and focused** on real-time data processing:

#### Core Components
```
pi-drone-backend/
├── src/
│   ├── mavlink-parser.js      # MAVLink protocol handler
│   ├── websocket-server.js    # WebSocket streaming server
│   ├── error-manager.js       # Error detection & categorization
│   ├── telemetry-processor.js # Data validation & formatting
│   └── system-monitor.js      # Pi health monitoring
├── config/
│   ├── drone-config.json      # Drone-specific parameters
│   ├── port-config.json       # Serial/USB port settings
│   └── websocket-config.json  # Server configuration
├── services/
│   └── drone-backend.service  # Systemd service definition
└── package.json               # Node.js dependencies
```

#### Backend Functionality
- **MAVLink Communication**: Reads telemetry from drone autopilot via serial/USB
- **Real-time Processing**: Validates, filters, and formats incoming data
- **WebSocket Streaming**: Broadcasts telemetry, logs, and errors to dashboard
- **Error Detection**: Monitors for EKF failures, sensor faults, preflight issues
- **System Health**: Tracks Pi performance, connectivity, and resource usage
- **Reconnection Logic**: Handles drone disconnections and automatic recovery

#### Technology Stack
- **Runtime**: Node.js (lightweight, single process)
- **Protocol**: MAVLink parsing via `node-mavlink` or custom parser
- **Communication**: WebSocket server (`ws` library)
- **Process Management**: PM2 or systemd service
- **Storage**: Minimal (log files only, no database)
- **Architecture**: Fully headless (no GUI on Pi)

### Data Flow Architecture

#### Real-time Data Pipeline
1. **Drone Hardware** → Sends MAVLink messages via serial/USB
2. **MAVLink Parser** → Decodes binary telemetry into JSON objects
3. **Telemetry Processor** → Validates data ranges and formats
4. **Error Manager** → Detects critical issues (EKF, sensors, GPS)
5. **WebSocket Server** → Broadcasts processed data to dashboard
6. **Dashboard Frontend** → Receives and displays real-time updates

#### Error Handling Flow
```json
// Pi Backend Error Detection
{
  "type": "error",
  "payload": {
    "category": "EKF",
    "severity": "critical",
    "code": "EKF_VARIANCE_HIGH",
    "message": "EKF horizontal position variance exceeds threshold",
    "timestamp": "2024-01-15T10:30:45.123Z",
    "source": "autopilot"
  }
}
```

### Developer Setup for Pi Backend

#### System Requirements
- **Hardware**: Raspberry Pi 5 (4GB+ RAM recommended)
- **OS**: Raspberry Pi OS Lite (headless)
- **Node.js**: v18+ (via NodeSource or NVM)
- **Dependencies**: MAVLink libraries, WebSocket support
- **Connectivity**: Wi-Fi or Ethernet for dashboard connection

#### Deployment Process
1. **Pi Preparation**
   - Install Raspberry Pi OS Lite
   - Enable SSH for remote access
   - Configure Wi-Fi/Ethernet with static IP

2. **Backend Installation**
   - Clone backend repository to Pi
   - Install Node.js dependencies
   - Configure drone connection parameters
   - Set up systemd service for auto-start

3. **Network Configuration**
   - Configure Pi as Wi-Fi hotspot (optional)
   - Set static IP for reliable dashboard connection
   - Open firewall ports for WebSocket (8081)

4. **Service Management**
   - Use PM2 or systemd for process management
   - Configure auto-restart on Pi boot
   - Set up log rotation for system logs

#### Performance Characteristics
- **CPU Usage**: ~5-10% on Pi 5 (single core)
- **Memory**: ~50-100MB RAM footprint
- **Network**: ~1-5 KB/s WebSocket data transmission
- **Latency**: <50ms telemetry update rate
- **Reliability**: Auto-reconnect on drone/network failures

### Environment Configuration

#### Frontend Configuration (Dashboard)
```env
# .env file for dashboard
VITE_MODE=production
VITE_WEBSOCKET_URL=ws://192.168.1.100:8081
VITE_RECONNECT_INTERVAL=3000
VITE_FALLBACK_TO_DEMO=false
```

#### Backend Configuration (Pi)
```json
// config/websocket-config.json
{
  "port": 8081,
  "host": "0.0.0.0",
  "pingInterval": 30000,
  "maxClients": 5,
  "corsOrigins": ["*"]
}

// config/drone-config.json
{
  "serialPort": "/dev/ttyUSB0",
  "baudRate": 57600,
  "mavlinkVersion": 2,
  "systemId": 1,
  "componentId": 1
}
```

### Switching Between Modes

#### Development to Production
1. Update `VITE_WEBSOCKET_URL` in `.env` to Pi IP address
2. Deploy Pi backend and start service
3. Rebuild dashboard with production config
4. Test connection using Connect/Disconnect button

#### Fallback to Demo Mode
- Set `VITE_FALLBACK_TO_DEMO=true` in environment
- Dashboard automatically switches if Pi backend unavailable
- Useful for development when Pi is offline

#### Hybrid Development
- Run both demo server and Pi backend simultaneously
- Switch between endpoints using environment variables
- Compare real vs simulated data for testing

## How can I edit this code?

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

