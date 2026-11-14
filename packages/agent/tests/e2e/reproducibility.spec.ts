import { test, expect } from '@playwright/test';
import { runBenchmark } from '../../benchmark/evaluate.js';

test('reproducible semantic task execution, safety and crash recovery', async ({}, testInfo) => {
  const report = await runBenchmark(testInfo.outputPath('evidence'));
  expect(report.checks.filter(check => !check.passed)).toEqual([]);
  expect(report.summary.total).toBe(17);
});
