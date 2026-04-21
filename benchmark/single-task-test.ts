import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { StandaloneExecutor } from './benchmark/dist/runner/standalone-executor.js';
import { createProvider } from './benchmark/dist/runner/providers.js';

async function runSingleTask() {
  const resultDir = resolve('benchmark', 'results', 'deepseek-single-task-' + new Date().toISOString().slice(0, 10));
  mkdirSync(resultDir, { recursive: true });

  // 读取最简单的任务
  const taskFile = resolve('benchmark', 'tasks', 'task-code-review-automation.json');
  const task = JSON.parse(readFileSync(taskFile, 'utf-8'));

  console.log('Running single task benchmark with DeepSeek...');
  console.log('Task:', task.id);
  console.log('Model:', process.env.DEEPSEEK_MODEL || 'deepseek-chat');
  console.log('Timeout: 300 seconds');
  console.log('');

  const provider = createProvider('deepseek');
  const executor = new StandaloneExecutor(provider);

  // Run bloated variant
  console.log('=== BLOATED variant ===');
  const start1 = Date.now();
  const result1 = await executor.runTask(task, 'bloated', {
    outputDir: resolve(resultDir, 'bloated'),
    disableMcp: true,
  });
  const elapsed1 = Date.now() - start1;
  console.log('Turns:', result1.turns);
  console.log('Input tokens:', result1.inputTokens);
  console.log('Output tokens:', result1.outputTokens);
  console.log('Pass:', result1.pass);
  console.log('Time:', Math.round(elapsed1 / 1000) + 's');
  console.log('');

  // Run talking variant
  console.log('=== TALKING variant ===');
  const start2 = Date.now();
  const result2 = await executor.runTask(task, 'talking', {
    outputDir: resolve(resultDir, 'talking'),
    disableMcp: true,
  });
  const elapsed2 = Date.now() - start2;
  console.log('Turns:', result2.turns);
  console.log('Input tokens:', result2.inputTokens);
  console.log('Output tokens:', result2.outputTokens);
  console.log('Pass:', result2.pass);
  console.log('Time:', Math.round(elapsed2 / 1000) + 's');
  console.log('');

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    task: task.id,
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    timeout: '300s',
    results: {
      bloated: {
        turns: result1.turns,
        inputTokens: result1.inputTokens,
        outputTokens: result1.outputTokens,
        pass: result1.pass,
        timeMs: elapsed1,
      },
      talking: {
        turns: result2.turns,
        inputTokens: result2.inputTokens,
        outputTokens: result2.outputTokens,
        pass: result2.pass,
        timeMs: elapsed2,
      },
    },
  };

  writeFileSync(resolve(resultDir, 'report.json'), JSON.stringify(report, null, 2));

  console.log('? Single task benchmark completed!');
  console.log('Results saved to:', resultDir);
}

runSingleTask().catch(err => {
  console.error('? Error:', err.message);
  process.exit(1);
});
