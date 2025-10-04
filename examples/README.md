# Examples

This directory contains example scripts demonstrating various features of memory-mcp.

## Available Examples

### demo-scorers.mjs

Demonstrates the modular relevance scoring system without requiring MongoDB or external services.

**Run it:**
```bash
npm run build
node examples/demo-scorers.mjs
```

**What it shows:**
- Keyword scoring using Jaccard similarity
- Vector similarity calculations with cosine similarity
- How different memories score against a query
- Configuration options for switching scorers

**Output:**
The script scores sample memories against a query and visualizes the results with score bars.

## Creating Your Own Examples

Examples should:
1. Be runnable without modifying the main codebase
2. Demonstrate a specific feature or use case
3. Include clear output and explanations
4. Use `.mjs` extension for ES modules

Example template:

```javascript
#!/usr/bin/env node
import { SomeThing } from '../build/module.js';

console.log('Example: My Feature');
// Your example code here
```

Make it executable:
```bash
chmod +x examples/my-example.mjs
```

## Contributing Examples

When adding new examples:
1. Create a new `.mjs` file in this directory
2. Add documentation in this README
3. Make sure it works after `npm run build`
4. Keep it simple and focused on one feature
