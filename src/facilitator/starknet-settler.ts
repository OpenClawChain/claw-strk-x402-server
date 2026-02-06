/**
 * Starknet Payment Settler
 * 
 * Handles settlement of verified payments on the Starknet blockchain
 * by submitting transactions through the PaymentProcessor contract.
 */

import {
  StarknetExactPayload,
  PaymentRequirements,
  SettleResponse,
  FacilitatorConfig,
  SettlementError,
} from '../types/x402.js';
import { Account, CallData, RpcProvider, Signer, uint256 } from 'starknet';

export class StarknetSettler {
  private config: FacilitatorConfig;
  private provider: RpcProvider;
  private account: Account | null = null;

  constructor(config: FacilitatorConfig) {
    this.config = config;
    this.provider = new RpcProvider({ nodeUrl: config.rpcUrl });
    this.initializeAccount();
  }

  /**
   * Initializes the facilitator's Starknet account
   */
  private async initializeAccount(): Promise<void> {
    try {
      if (!this.config.privateKey || !this.config.accountAddress) {
        console.warn('Missing facilitator accountAddress/privateKey; settlement will not be available');
        return;
      }

      const signer = new Signer(this.config.privateKey);
      this.account = new Account({
        provider: this.provider,
        address: this.config.accountAddress,
        signer,
      });

      console.log('Facilitator account initialized');
    } catch (error) {
      console.error('Failed to initialize facilitator account:', error);
      this.account = null;
    }
  }

  /**
   * Settles an exact payment on Starknet
   */
  async settleExactPayment(
    payload: StarknetExactPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse> {
    try {
      if (!this.account) {
        throw new SettlementError('Facilitator account not initialized');
      }

      // Prepare the transaction to call the PaymentProcessor contract
      const txHash = await this.executePayment(payload);

      // Wait for transaction confirmation
      await this.provider.waitForTransaction(txHash);

      return {
        success: true,
        error: null,
        txHash: txHash,
        networkId: requirements.network,
      };
    } catch (error) {
      console.error('Settlement error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Settlement failed',
        txHash: null,
        networkId: requirements.network,
      };
    }
  }

  /**
   * Executes the payment by calling the PaymentProcessor contract
   */
  private async executePayment(payload: StarknetExactPayload): Promise<string> {
    if (!this.account) throw new SettlementError('Account not initialized');

    // Settle by pulling funds from payer using ERC20 transfer_from.
    // Requires the payer to have approved the facilitator account as spender.
    const call = {
      contractAddress: payload.token,
      entrypoint: 'transfer_from',
      calldata: CallData.compile({
        sender: payload.from,
        recipient: payload.to,
        amount: uint256.bnToUint256(BigInt(payload.amount)),
      }),
    } as any;

    const res: any = await this.account.execute(call);
    const txHash = res.transaction_hash ?? res.transactionHash;
    if (!txHash) throw new Error(`No tx hash returned from account.execute: ${JSON.stringify(res)}`);

    console.log(`Settlement transaction submitted: ${txHash}`);
    return txHash;
  }

  /**
   * Waits for a transaction to be confirmed on Starknet
   */
  private async waitForTransaction(
    txHash: string,
    maxWaitTimeMs: number = 60000
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTimeMs) {
      try {
        const receipt = await this.provider.getTransactionReceipt(txHash);

        const execStatus = (receipt as any)?.execution_status;

        if (receipt && execStatus === 'SUCCEEDED') {
          console.log(`Transaction ${txHash} confirmed`);
          return;
        }

        if (receipt && execStatus === 'REVERTED') {
          const revertReason = (receipt as any)?.revert_reason;
          throw new SettlementError(
            `Transaction reverted: ${revertReason || 'Unknown reason'}`
          );
        }

        // Wait before checking again
        await this.sleep(2000);
      } catch (error) {
        // Transaction might not be found yet, continue waiting
        if ((error as any)?.message?.includes('Transaction hash not found')) {
          await this.sleep(2000);
          continue;
        }
        throw error;
      }
    }

    throw new SettlementError('Transaction confirmation timeout');
  }

  /**
   * Helper function to sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Estimates gas for a payment transaction
   */
  async estimateGas(payload: StarknetExactPayload): Promise<bigint> {
    try {
      // In production, estimate the gas required for the transaction
      // For now, return a reasonable estimate
      return BigInt(100000); // ~100k gas units
    } catch (error) {
      console.error('Gas estimation error:', error);
      return BigInt(150000); // Default higher estimate if estimation fails
    }
  }

  /**
   * Gets the current gas price on the network
   */
  async getGasPrice(): Promise<bigint> {
    try {
      // Query the current gas price from the network
      // For now, return a mock value
      return BigInt(1000000000); // 1 gwei equivalent
    } catch (error) {
      console.error('Gas price query error:', error);
      return BigInt(1000000000);
    }
  }
}

/**
 * Payment Processor Contract ABI (partial)
 * This would be the full ABI in production
 */
export const PAYMENT_PROCESSOR_ABI = [
  {
    name: 'execute_payment',
    type: 'function',
    inputs: [
      { name: 'from', type: 'felt' },
      { name: 'to', type: 'felt' },
      { name: 'token', type: 'felt' },
      { name: 'amount', type: 'u256' },
      { name: 'nonce', type: 'u256' },
      { name: 'deadline', type: 'u64' },
      { name: 'signature_r', type: 'felt' },
      { name: 'signature_s', type: 'felt' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  {
    name: 'verify_payment',
    type: 'function',
    inputs: [
      { name: 'from', type: 'felt' },
      { name: 'to', type: 'felt' },
      { name: 'token', type: 'felt' },
      { name: 'amount', type: 'u256' },
      { name: 'nonce', type: 'u256' },
      { name: 'deadline', type: 'u64' },
      { name: 'signature_r', type: 'felt' },
      { name: 'signature_s', type: 'felt' },
    ],
    outputs: [{ name: 'is_valid', type: 'bool' }],
  },
  {
    name: 'get_nonce',
    type: 'function',
    inputs: [{ name: 'account', type: 'felt' }],
    outputs: [{ name: 'nonce', type: 'u256' }],
  },
];

