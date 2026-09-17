import { describe, it, expect } from 'bun:test';

/**
 * Shell Verification: waitlist service
 *
 * service.ts is pure imperative shell (FCIS Zone 2): zero branching,
 * single DB upsert, static return. Per the architecture handbook,
 * shell code gets integration tests (real DB), not unit tests.
 *
 * Integration test requires: DB running + migration applied.
 * Run `bun dev:db:up && bun run --cwd packages/db drizzle-kit push` first.
 *
 * This file validates the module contract (export shape) only.
 * Full integration coverage is deferred to CI with DB fixture.
 */

describe('waitlist service module', () => {
  it('exports upsertWaitlistEntry as a function', async () => {
    const mod = await import('./service');
    expect(mod.upsertWaitlistEntry).toBeDefined();
    expect(typeof mod.upsertWaitlistEntry).toBe('function');
  });
});
