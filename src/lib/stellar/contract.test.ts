import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Keypair, SorobanRpc as ActualSorobanRpc } from '@stellar/stellar-sdk';

const rpc = vi.hoisted(() => ({
  getAccount: vi.fn(),
  simulateTransaction: vi.fn(),
  sendTransaction: vi.fn(),
  getTransaction: vi.fn(),
}));

vi.mock('./freighter', () => ({ signTx: vi.fn().mockResolvedValue('signed-xdr') }));

// Stub only the network/transaction plumbing; Address and nativeToScVal stay real.
vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>();
  class Server {
    getAccount = rpc.getAccount;
    simulateTransaction = rpc.simulateTransaction;
    sendTransaction = rpc.sendTransaction;
    getTransaction = rpc.getTransaction;
  }
  class TransactionBuilder {
    addOperation() { return this; }
    setTimeout() { return this; }
    build() { return {}; }
  }
  class Contract {
    call() { return {}; }
  }
  class Transaction {}
  return {
    ...actual,
    Contract,
    TransactionBuilder,
    Transaction,
    SorobanRpc: {
      ...actual.SorobanRpc,
      Server,
      Api: { ...actual.SorobanRpc.Api, isSimulationError: () => false },
      assembleTransaction: () => ({ build: () => ({ toXDR: () => 'assembled-xdr' }) }),
    },
  };
});

import { enrollInCourse, stellarExplorerTxUrl, TransactionPendingError } from './contract';

const { GetTransactionStatus } = ActualSorobanRpc.Api;
const HASH = 'a'.repeat(64);

const enroll = () =>
  enrollInCourse({ callerAddress: Keypair.random().publicKey(), courseId: 'course-1' });

describe('enrollInCourse confirmation outcomes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(rpc).forEach((fn) => fn.mockReset());
    rpc.getAccount.mockResolvedValue({});
    rpc.simulateTransaction.mockResolvedValue({});
    rpc.sendTransaction.mockResolvedValue({ status: 'PENDING', hash: HASH });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects with a TransactionPendingError carrying the hash when confirmation times out', async () => {
    rpc.getTransaction.mockResolvedValue({ status: GetTransactionStatus.NOT_FOUND });

    const result = enroll().catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(20 * 2000);
    const error = await result;

    expect(error).toBeInstanceOf(TransactionPendingError);
    expect(error).toBeInstanceOf(Error);
    expect((error as TransactionPendingError).message).toBe('Transaction not confirmed');
    expect((error as TransactionPendingError).hash).toBe(HASH);
  });

  it('keeps the on-chain failure message unchanged', async () => {
    rpc.getTransaction.mockResolvedValue({ status: GetTransactionStatus.FAILED });

    const result = enroll().catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(2000);
    const error = await result;

    expect(error).not.toBeInstanceOf(TransactionPendingError);
    expect((error as Error).message).toBe(`Transaction failed: ${HASH}`);
  });

  it('keeps the submission failure message unchanged', async () => {
    rpc.sendTransaction.mockResolvedValue({ status: 'ERROR', hash: HASH });

    await expect(enroll()).rejects.toThrow('Submission failed');
  });

  it('resolves with the hash once the transaction succeeds', async () => {
    rpc.getTransaction.mockResolvedValue({ status: GetTransactionStatus.SUCCESS });

    const result = enroll();
    await vi.advanceTimersByTimeAsync(2000);

    await expect(result).resolves.toBe(HASH);
  });
});

describe('stellarExplorerTxUrl', () => {
  it('links to the transaction on Stellar Expert', () => {
    expect(stellarExplorerTxUrl(HASH)).toMatch(
      new RegExp(`^https://stellar\\.expert/explorer/(testnet|public)/tx/${HASH}$`),
    );
  });
});
