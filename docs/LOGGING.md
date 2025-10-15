# Structured Logging Guide

## Overview

The MCP server uses a structured logging system with timestamps, log levels, and contextual information for easy debugging and monitoring.

## Log Levels

Controlled via `LOG_LEVEL` environment variable:

- `DEBUG` - Detailed diagnostic information
- `INFO` - General informational messages (default)
- `WARN` - Warning messages for potentially problematic situations
- `ERROR` - Error messages for failures

```bash
# Set log level
export LOG_LEVEL=DEBUG
npm start
```

## Log Format

All logs follow this format:
```
[2025-10-14T19:30:45.123Z] [LEVEL] Message {"context": "data"}
```

Example:
```
[2025-10-14T19:30:45.123Z] [INFO] OAuth: Client registered successfully {"clientId":"client_abc123","duration":245}
```

## Specialized Logging Methods

### OAuth Events
```typescript
logger.oauth('event', { context })
```

Examples:
- Metadata discovery
- Client registration
- Authorization requests
- Token exchange
- Callback handling

### Session Management
```typescript
logger.session('event', sessionId, { context })
```

Examples:
- Session initialized
- Session closed

### Authentication
```typescript
logger.auth('event', { context })
```

Examples:
- Agent authenticated
- Token validation

### HTTP Requests/Responses
```typescript
logger.request(method, path, { context })
logger.response(method, path, statusCode, duration, { context })
```

Automatically logs:
- HTTP method and path
- Status codes
- Request duration in milliseconds
- Session IDs when available

## Context Fields

Common context fields included in logs:

- `sessionId` - MCP session identifier
- `agentId` - Agent identifier
- `agentName` - Agent display name
- `userId` - User identifier
- `clientId` - OAuth client ID
- `duration` - Operation duration in ms
- `statusCode` - HTTP status code
- `error` - Error details (message, stack, name)

## Examples

### OAuth Flow
```
[2025-10-14T19:30:45.000Z] [INFO] OAuth: Metadata discovery request
[2025-10-14T19:30:45.005Z] [INFO] Incoming request {"method":"GET","path":"/.well-known/oauth-authorization-server"}
[2025-10-14T19:30:45.010Z] [INFO] Request completed: GET /.well-known/oauth-authorization-server {"statusCode":200,"duration":10}

[2025-10-14T19:30:46.000Z] [INFO] OAuth: Client registration request {"client_name":"MCP Client","grant_types":["authorization_code"]}
[2025-10-14T19:30:46.250Z] [INFO] OAuth: Client registered successfully {"clientId":"client_abc123","duration":250}

[2025-10-14T19:30:47.000Z] [INFO] OAuth: Authorization request {"client_id":"client_abc123","response_type":"code","has_code_challenge":true}
[2025-10-14T19:30:47.100Z] [INFO] OAuth: Redirecting to authorization page {"location":"https://agent-drugs.web.app/oauth-authorize.html","duration":100}

[2025-10-14T19:31:00.000Z] [INFO] OAuth: Token exchange request {"grant_type":"authorization_code","client_id":"client_abc123"}
[2025-10-14T19:31:00.300Z] [INFO] OAuth: Token issued successfully {"hasToken":true,"duration":300}
```

### MCP Session
```
[2025-10-14T19:31:01.000Z] [INFO] Incoming request {"method":"POST","path":"/mcp","sessionId":undefined}
[2025-10-14T19:31:01.050Z] [INFO] Auth: Agent authenticated {"agentName":"My Agent","agentId":"agent_123","userId":"user_456","sessionId":undefined}
[2025-10-14T19:31:01.100Z] [INFO] Session: initialized {"sessionId":"session_1728933061100_abc","agentId":"agent_123","agentName":"My Agent"}
[2025-10-14T19:31:01.150Z] [INFO] MCP session created {"agentId":"agent_123","duration":150}
```

### Error Handling
```
[2025-10-14T19:31:05.000Z] [WARN] Client registration failed {"statusCode":400,"error":"invalid_client_metadata","duration":50}

[2025-10-14T19:31:10.000Z] [ERROR] MCP connection error {"method":"POST","sessionId":"session_123","duration":100,"error":{"message":"Invalid bearer token","stack":"Error: Invalid bearer token\n    at ...","name":"Error"}}
```

## Sensitive Data

The logger automatically redacts sensitive information:

- Bearer tokens are never logged
- Authorization codes shown as `***`
- Passwords/secrets are never logged
- Only metadata about tokens (e.g., `hasToken: true`)

## Performance Monitoring

Track operation durations using the `duration` field:

```bash
# Find slow operations (>500ms)
cat logs.txt | grep duration | awk -F'duration":' '{print $2}' | awk -F',' '{print $1}' | awk '$1 > 500'
```

## Debugging Tips

1. **Enable DEBUG level** for detailed diagnostics:
   ```bash
   LOG_LEVEL=DEBUG npm start
   ```

2. **Filter by component**:
   ```bash
   # OAuth events only
   npm start 2>&1 | grep "OAuth:"

   # Session events only
   npm start 2>&1 | grep "Session:"

   # Errors only
   npm start 2>&1 | grep "\[ERROR\]"
   ```

3. **Track a specific session**:
   ```bash
   npm start 2>&1 | grep "session_1728933061100_abc"
   ```

4. **Monitor performance**:
   ```bash
   # Show all operations with duration
   npm start 2>&1 | grep "duration"
   ```

## Production Recommendations

1. **Use INFO level** in production to balance detail with performance
2. **Integrate with log aggregation** (CloudWatch, DataDog, etc.)
3. **Set up alerts** for ERROR level logs
4. **Monitor duration metrics** for performance regression
5. **Rotate logs** to prevent disk space issues

## Future Enhancements

- JSON-only output mode for log aggregation
- Correlation IDs across requests
- Sampling for high-traffic scenarios
- Integration with OpenTelemetry
