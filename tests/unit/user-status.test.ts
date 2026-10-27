import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateUserAccountAccess,
} from '../../src/domain/identity/user-status.ts';
import type { UserStatus } from '../../src/domain/identity/user-status.ts';

describe('Domain: user-status & account access rules', () => {
  it('permits access only for ACTIVE status', () => {
    const active = evaluateUserAccountAccess('ACTIVE');
    assert.equal(active.canAccess, true);
    assert.equal(active.status, 'ACTIVE');
  });

  it('blocks access for PENDING_VERIFICATION with clear verification prompt', () => {
    const pending = evaluateUserAccountAccess('PENDING_VERIFICATION');
    assert.equal(pending.canAccess, false);
    assert.equal(pending.status, 'PENDING_VERIFICATION');
    assert.match(pending.reason || '', /pending verification.*verify your email/i);
  });

  it('blocks access for INVITED status', () => {
    const invited = evaluateUserAccountAccess('INVITED');
    assert.equal(invited.canAccess, false);
    assert.equal(invited.status, 'INVITED');
    assert.match(invited.reason || '', /invitation has not yet been claimed/i);
  });

  it('blocks access for SUSPENDED status', () => {
    const suspended = evaluateUserAccountAccess('SUSPENDED');
    assert.equal(suspended.canAccess, false);
    assert.equal(suspended.status, 'SUSPENDED');
    assert.match(suspended.reason || '', /suspended by administration/i);
  });
});
