// Mock MCP server for testing StdioMcpTransport
// Reads JSON-RPC from stdin, writes responses to stdout

const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin });

function sendResponse(id, result) {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, result });
  process.stdout.write(msg + '\n');
}

function sendError(id, code, message) {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
  process.stdout.write(msg + '\n');
}

rl.on('line', (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }

  if (msg.method === 'initialize') {
    sendResponse(msg.id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'mock-server', version: '1.0.0' },
    });
    return;
  }

  if (msg.method === 'notifications/initialized') {
    // No response needed for notifications
    return;
  }

  if (msg.method === 'tools/list') {
    sendResponse(msg.id, {
      tools: [
        {
          name: 'search',
          description: 'Search files',
          annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false },
        },
        {
          name: 'delete',
          description: 'Delete a file',
          annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true },
        },
      ],
    });
    return;
  }

  if (msg.method === 'tools/call') {
    const { name, arguments: args } = msg.params;

    if (name === 'search') {
      if (!args.query) {
        sendResponse(msg.id, {
          content: [{ type: 'text', text: 'Missing query parameter. Try providing a search term.' }],
          isError: true,
        });
      } else if (args.query.includes('NONEXISTENT')) {
        sendResponse(msg.id, {
          content: [{ type: 'text', text: 'No results found. Try broadening your search.' }],
          isError: false,
        });
      } else {
        sendResponse(msg.id, {
          content: [{ type: 'text', text: 'Found 3 results.' }],
          isError: false,
        });
      }
      return;
    }

    if (name === 'delete') {
      sendResponse(msg.id, {
        content: [{ type: 'text', text: 'Deleted successfully.' }],
        isError: false,
      });
      return;
    }

    sendError(msg.id, -32602, `Unknown tool: ${name}`);
    return;
  }

  // Unknown method
  sendError(msg.id, -32601, `Method not found: ${msg.method}`);
});

// Keep process alive until stdin closes
rl.on('close', () => {
  process.exit(0);
});
