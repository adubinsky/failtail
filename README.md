# failtail

An MCP (Model Context Protocol) server for tailing logs from multiple cloud platforms and services. Provides a unified interface for Claude and other MCP clients to stream and retrieve logs.

## Supported Platforms

- **Heroku** - Stream logs from Heroku applications
- **Fly.io** - Tail logs from Fly.io apps
- **Render** - Access logs from Render services
- **Docker** - View container logs
- **ngrok** - Inspect ngrok tunnel requests
- **Rails** - Tail local or remote Rails log files

## Installation

```bash
npm install -g failtail
```

Or clone and build from source:

```bash
git clone https://github.com/adubinsky/failtail.git
cd failtail
npm install
npm run build
```

## Configuration

### Claude Desktop

Add to your Claude Desktop MCP configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "failtail": {
      "command": "npx",
      "args": ["-y", "failtail"]
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "failtail": {
      "command": "failtail"
    }
  }
}
```

## Prerequisites

Install the CLI tools for the platforms you want to use:

| Platform | CLI Tool | Installation |
|----------|----------|--------------|
| Heroku | `heroku` | `brew install heroku/brew/heroku` |
| Fly.io | `flyctl` | `brew install flyctl` |
| Render | `render` | `brew install render-oss/render/render` |
| Docker | `docker` | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| ngrok | `ngrok` | `brew install ngrok/ngrok/ngrok` |

## Authentication

Each platform requires its own authentication:

- **Heroku**: `heroku login`
- **Fly.io**: `fly auth login`
- **Render**: `render login`
- **Docker**: `docker login` (if using private registries)
- **ngrok**: `ngrok config add-authtoken <token>`

The server will detect authentication errors and provide helpful guidance.

## Available Tools

### `heroku_logs`

Tail logs from a Heroku application.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `app` | string | Yes | Heroku app name |
| `tail` | boolean | No | Stream continuously (default: true) |
| `tail_seconds` | number | No | Seconds to collect (default: 10) |
| `source` | string | No | Filter: "app" or "heroku" |
| `process_type` | string | No | Filter by process (e.g., "web") |
| `num_lines` | number | No | Historical lines to fetch |

### `fly_logs`

Tail logs from a Fly.io application.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `app` | string | Yes | Fly.io app name |
| `tail` | boolean | No | Stream continuously (default: true) |
| `tail_seconds` | number | No | Seconds to collect (default: 10) |
| `region` | string | No | Filter by region |
| `instance` | string | No | Filter by instance ID |

### `render_logs`

Tail logs from a Render service.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `service` | string | Yes | Render service name or ID |
| `tail` | boolean | No | Stream continuously (default: true) |
| `tail_seconds` | number | No | Seconds to collect (default: 10) |

### `docker_logs`

View logs from a Docker container.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `container` | string | Yes | Container name or ID |
| `tail` | boolean | No | Stream continuously (default: true) |
| `tail_seconds` | number | No | Seconds to collect (default: 10) |
| `since` | string | No | Show logs since (e.g., "1h", "2024-01-01") |
| `until` | string | No | Show logs until timestamp |
| `timestamps` | boolean | No | Show timestamps |

### `ngrok_logs`

Inspect requests through ngrok tunnels via the local inspection API.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Number of requests to fetch (default: 20) |
| `tunnel_name` | string | No | Filter by tunnel name |

### `rails_logs`

Tail Rails application logs from local or remote servers.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `environment` | string | No | Rails environment (default: "development") |
| `log_path` | string | No | Custom log file path |
| `remote_host` | string | No | SSH host for remote logs |
| `tail` | boolean | No | Stream continuously (default: true) |
| `tail_seconds` | number | No | Seconds to collect (default: 10) |
| `num_lines` | number | No | Historical lines to fetch |

### `stop_tail`

Stop an active log tailing session.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `session_id` | string | Yes | Session ID to stop |

### `list_sessions`

List all active log tailing sessions. Takes no parameters.

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode for development
npm run dev

# Run the server
npm start
```

## Roadmap

Future platform support planned:

- AWS CloudWatch Logs
- Google Cloud Logging
- Azure Monitor Logs

## License

MIT License - see [LICENSE](LICENSE) for details.
