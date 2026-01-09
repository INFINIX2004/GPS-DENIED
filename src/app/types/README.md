# TypeScript Interface Documentation

This directory contains comprehensive TypeScript interfaces for the AeroVision Dashboard Integration system. The interfaces establish a structured data flow between the Python AeroVision backend and the React TypeScript dashboard.

## File Structure

### `systemState.ts`
**Central System State Management**

Contains the core `SystemState` interface that serves as the single source of truth for all dashboard components. This satisfies **Requirements 7.1, 7.3, 7.5** by providing:

- **Structured data containers** for systemStatus, intruders, threatIntelligence, alerts, and videoStatus
- **Type safety** for all component props through TypeScript interfaces
- **Consistent property naming** conventions across all components
- **Default empty states** for graceful degradation when data is unavailable

Key interfaces:
- `SystemState` - Central state container
- `SystemStatusData` - Power management and system metrics
- `IntruderData` - Individual tracked objects with threat assessment
- `ThreatIntelligenceData` - Detailed behavioral analysis and predictions
- `AlertsData` - System-wide alert status and recent activity
- `VideoStatusData` - Video feed metadata and connection status

### `pythonInterfaces.ts`
**Python Backend Data Structures**

Defines interfaces that match the exact format sent by the AeroVision Python system. This enables accurate data transformation and validation:

- `PythonSystemData` - Root data structure from Python backend
- `PythonTrack` - Individual track/intruder data from Python
- `PythonBehaviorData` - Behavioral analysis from Python
- `PythonPredictionData` - Trajectory predictions from Python
- `PythonAlert` - Alert data from Python
- `PythonVideoStatus` - Video stream metadata from Python

Includes type guards for runtime validation:
- `isPythonSystemData()` - Validates incoming Python data
- `isPythonTrack()` - Validates individual track data
- `isPythonWebSocketMessage()` - Validates WebSocket messages

### `serviceInterfaces.ts`
**Service Layer Abstractions**

Defines interfaces for the backend communication and data transformation services:

- `BackendService` - Main interface for communicating with Python backend
- `DataTransformer` - Interface for converting Python data to TypeScript
- `SystemStateManager` - Interface for centralized state management
- `WebSocketHandler` - Interface for real-time WebSocket communication
- `RestApiHandler` - Interface for HTTP API communication
- `ConnectionManager` - Interface for handling connection fallbacks and retries

### `index.ts`
**Central Export Hub**

Provides a single import point for all types and includes:
- All interface exports from other files
- Legacy compatibility types for existing components
- Utility types for enhanced type safety
- Runtime type guards for data validation

## Requirements Mapping

### Requirement 7.1: TypeScript Interfaces for Data Structures
✅ **Satisfied** - All data structures have comprehensive TypeScript interfaces:
- `SystemState` defines the central state structure
- Component-specific interfaces (`SystemStatusData`, `IntruderData`, etc.)
- Python backend interfaces for accurate data mapping
- Service layer interfaces for backend communication

### Requirement 7.3: Consistent Property Naming
✅ **Satisfied** - Consistent naming conventions established:
- **camelCase** for TypeScript interfaces (e.g., `powerConsumption`, `threatScore`)
- **snake_case** for Python interfaces (e.g., `power_w`, `threat_score`)
- Clear mapping between Python and TypeScript property names
- Standardized enums for status values (`'IDLE' | 'ACTIVE' | 'ALERT'`)

### Requirement 7.5: Type Safety for Component Props
✅ **Satisfied** - Complete type safety provided:
- Each dashboard component has a corresponding data interface
- All optional properties clearly marked with `?`
- Enum types for constrained values (zones, threat levels, etc.)
- Default values provided in `DEFAULT_SYSTEM_STATE`

## Data Flow Architecture

```
Python Backend → PythonSystemData → DataTransformer → SystemState → Dashboard Components
```

1. **Python Backend** sends data matching `PythonSystemData` interface
2. **DataTransformer** converts Python data to `SystemState` format
3. **SystemStateManager** maintains the central `SystemState`
4. **Dashboard Components** receive typed data through props

## Usage Examples

### Importing Types
```typescript
import { 
  SystemState, 
  IntruderData, 
  SystemStatusData,
  BackendService 
} from '@/app/types';
```

### Type Guards
```typescript
import { isPythonSystemData, isSystemState } from '@/app/types';

// Validate incoming data
if (isPythonSystemData(receivedData)) {
  // Safe to use as PythonSystemData
  const transformedState = transformer.transformSystemData(receivedData);
}
```

### Default States
```typescript
import { DEFAULT_SYSTEM_STATE } from '@/app/types';

// Use for initialization or fallback
const [state, setState] = useState<SystemState>(DEFAULT_SYSTEM_STATE);
```

## Backward Compatibility

The interfaces maintain backward compatibility with existing components through:
- Legacy type aliases (`Intruder` → `IntruderData`)
- Compatibility exports for existing service interfaces
- Gradual migration path from old to new interfaces

## Future Extensions

The interface structure supports future enhancements:
- Additional video stream protocols (WebRTC, RTSP, MJPEG)
- Extended behavioral analysis metrics
- Multi-camera support
- Enhanced prediction algorithms
- Real-time performance monitoring

## Type Safety Features

- **Strict null checks** - All optional properties explicitly marked
- **Enum constraints** - Limited value sets for status fields
- **Runtime validation** - Type guards for data validation
- **Generic utilities** - Helper types for enhanced type safety
- **Interface inheritance** - Shared properties through base interfaces