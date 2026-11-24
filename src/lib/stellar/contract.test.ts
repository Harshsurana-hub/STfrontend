import { describe, it, expect, beforeEach, vi } from 'vitest';

const { getAccount, signTx } = vi.hoisted(() => ({
  getAccount: vi.fn(),
  signTx: vi.fn(),
}));

vi.mock('./freighter', () => ({ signTx }));

vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>();
  class MockServer {
    getAccount = getAccount;
  }
  return {
    ...actual,
    SorobanRpc: { ...actual.SorobanRpc, Server: MockServer },
  };
});

import { enrollInCourse, registerCourseOnChain } from './contract';

const VALID_TOKEN = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

describe('contract address validation', () => {
  beforeEach(() => {
    getAccount.mockReset();
    signTx.mockReset();
  });

  it.each(['', 'not-an-address', 'GABC', VALID_TOKEN])(
    'enrollInCourse rejects invalid callerAddress %j without RPC or signing',
    async (callerAddress) => {
      await expect(enrollInCourse({ callerAddress, courseId: 'course-1' })).rejects.toThrow(
        'Invalid Stellar address for callerAddress',
      );
      expect(getAccount).not.toHaveBeenCalled();
      expect(signTx).not.toHaveBeenCalled();
    },
  );

  it('registerCourseOnChain rejects invalid callerAddress without RPC or signing', async () => {
    await expect(
      registerCourseOnChain({
        callerAddress: 'bad',
        courseId: 'course-1',
        price: 100n,
        tokenAddress: VALID_TOKEN,
      }),
    ).rejects.toThrow('Invalid Stellar address for callerAddress');
    expect(getAccount).not.toHaveBeenCalled();
    expect(signTx).not.toHaveBeenCalled();
  });

  it('registerCourseOnChain rejects invalid tokenAddress without RPC or signing', async () => {
    const { Keypair } = await import('@stellar/stellar-sdk');
    await expect(
      registerCourseOnChain({
        callerAddress: Keypair.random().publicKey(),
        courseId: 'course-1',
        price: 100n,
        tokenAddress: 'not-a-token',
      }),
    ).rejects.toThrow('Invalid Stellar address for tokenAddress');
    expect(getAccount).not.toHaveBeenCalled();
    expect(signTx).not.toHaveBeenCalled();
  });
});
