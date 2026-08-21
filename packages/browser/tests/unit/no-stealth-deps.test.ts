import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * No-stealth doctrine gate (BRWS-04).
 *
 * The project's Out-of-Scope doctrine forbids anti-bot evasion tooling:
 * patchright, playwright-extra, playwright-stealth, puppeteer-extra-plugin-
 * stealth, camoufox, or any dependency whose name contains 'stealth' or
 * 'camoufox'. STACK.md exclusions additionally forbid puppeteer and selenium.
 *
 * This test reads every workspace package manifest and fails the build if any
 * blocked name enters the dependency tree.
 */

const STEALTH_EXACT = new Set([
  'patchright',
  'playwright-extra',
  'playwright-stealth',
  'puppeteer-extra-plugin-stealth',
  'camoufox',
]);
const STEALTH_SUBSTRINGS = ['stealth', 'camoufox'];
const STACK_EXCLUSIONS = ['puppeteer', 'selenium'];

/** True when a dependency name violates the no-stealth doctrine. */
export function isStealthPackage(name: string): boolean {
  const lower = name.toLowerCase();
  if (STEALTH_EXACT.has(lower)) return true;
  return STEALTH_SUBSTRINGS.some((substring) => lower.includes(substring));
}

/** True when a dependency name is a STACK.md-excluded automation stack. */
export function isExcludedStack(name: string): boolean {
  const lower = name.toLowerCase();
  return STACK_EXCLUSIONS.some(
    (excluded) => lower === excluded || lower.startsWith(`${excluded}-`),
  );
}

interface Manifest {
  path: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

function collectManifests(): Manifest[] {
  // Walk up from this test file to the workspace root (marked by pnpm-workspace.yaml).
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`Could not locate the pnpm workspace root above ${dir}`);
    }
    dir = parent;
  }
  const repoRoot = dir;
  const manifestPaths = [
    path.join(repoRoot, 'package.json'),
    ...fs
      .readdirSync(path.join(repoRoot, 'packages'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(repoRoot, 'packages', entry.name, 'package.json'))
      .filter((candidate) => fs.existsSync(candidate)),
  ];
  return manifestPaths.map((manifestPath) => {
    const pkg = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return {
      path: manifestPath,
      dependencies: pkg.dependencies ?? {},
      devDependencies: pkg.devDependencies ?? {},
    };
  });
}

describe('no-stealth doctrine gate', () => {
  it('real dependency tree contains no stealth/evasion packages', () => {
    for (const manifest of collectManifests()) {
      const names = [
        ...Object.keys(manifest.dependencies),
        ...Object.keys(manifest.devDependencies),
      ];
      const violations = names.filter(isStealthPackage);
      expect(
        violations,
        `${manifest.path}: stealth/evasion packages are forbidden by project doctrine`,
      ).toEqual([]);
    }
  });

  it('real dependency tree contains no puppeteer or selenium (STACK.md exclusions)', () => {
    for (const manifest of collectManifests()) {
      const names = [
        ...Object.keys(manifest.dependencies),
        ...Object.keys(manifest.devDependencies),
      ];
      const violations = names.filter(isExcludedStack);
      expect(
        violations,
        `${manifest.path}: puppeteer/selenium are excluded by STACK.md`,
      ).toEqual([]);
    }
  });

  it('blocklist matcher flags synthetic stealth packages (proves the gate can fail)', () => {
    const syntheticDeps: Record<string, string> = {
      playwright: '1.62.1',
      zod: '4.4.3',
      'playwright-stealth': '1.0.0',
      patchright: '1.62.1',
      'puppeteer-extra-plugin-stealth': '2.0.0',
      camoufox: '0.4.0',
      'some-package-with-Camoufox-In-It': '1.0.0',
      'totally-innocent-logger': '1.0.0',
    };
    const flagged = Object.keys(syntheticDeps).filter(isStealthPackage);
    expect(flagged.sort()).toEqual(
      [
        'playwright-stealth',
        'patchright',
        'puppeteer-extra-plugin-stealth',
        'camoufox',
        'some-package-with-Camoufox-In-It',
      ].sort(),
    );
    // And the innocent names stay clean — no false positives.
    expect(isStealthPackage('playwright')).toBe(false);
    expect(isStealthPackage('yaml')).toBe(false);
    expect(isExcludedStack('playwright')).toBe(false);
    expect(isExcludedStack('puppeteer')).toBe(true);
    expect(isExcludedStack('selenium-webdriver')).toBe(true);
  });
});
