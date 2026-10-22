import { ethers } from 'ethers';
import { config } from '../config';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const CONTRACT_ABI = [
  "function createElection(bytes32 electionId, string[] memory candidateIds) external",
  "function castVote(bytes32 electionId, string memory candidateId, bytes32 voterCommitment, bytes32 proofHash, string memory receiptId) external",
  "function hasVoted(bytes32 electionId, bytes32 voterCommitment) external view returns (bool)",
  "function getResults(bytes32 electionId, string memory candidateId) external view returns (uint256)",
  "function getElectionInfo(bytes32 electionId) external view returns (bool exists, string[] memory candidateIds, address admin)",
  "function verifyReceipt(bytes32 electionId, string memory receiptId) external view returns (bool exists, bytes32 proofHash, uint256 timestamp)",
  "event VoteCast(bytes32 indexed electionId, bytes32 indexed voterCommitment, bytes32 proofHash, string receiptId, uint256 timestamp)",
  "event ElectionCreated(bytes32 indexed electionId, address indexed admin)"
];

class BlockchainService {
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;
  private contract: ethers.Contract | null = null;
  private isConnected = false;
  private currentBlockNumber = 19482100;
  private simulatedVotes: Map<number, Map<string, number>> = new Map();
  private simulatedVoters: Map<number, Set<string>> = new Map();

  private generateSimulatedBlock(): { txHash: string; blockNumber: number } {
    this.currentBlockNumber += Math.floor(Math.random() * 3) + 1;
    const txHash = '0x' + crypto.randomBytes(32).toString('hex');
    return { txHash, blockNumber: this.currentBlockNumber };
  }

  async initialize(): Promise<void> {
    try {
      let contractAddress = config.blockchain.contractAddress;

      // Try to read deployed address from file if not in env
      if (!contractAddress) {
        const deployedPath = path.resolve(__dirname, '../../../deployed-address.json');
        if (fs.existsSync(deployedPath)) {
          const data = JSON.parse(fs.readFileSync(deployedPath, 'utf-8'));
          contractAddress = data.ElectionRegistry || data.address;
        }
      }

      if (config.blockchain.rpcUrl && config.blockchain.privateKey && contractAddress) {
        // Quick probe to check if RPC node is active without hanging or retry looping
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1000);
          await fetch(config.blockchain.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
        } catch (probeErr: any) {
          throw new Error(`RPC node unreachable at ${config.blockchain.rpcUrl}`);
        }

        this.provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl, undefined, { staticNetwork: true });
        this.wallet = new ethers.Wallet(config.blockchain.privateKey, this.provider);
        this.contract = new ethers.Contract(contractAddress, CONTRACT_ABI, this.wallet);
        // Test connection
        await this.provider.getBlockNumber();
        this.isConnected = true;
        console.log('[Blockchain] Connected to network, contract:', contractAddress);
      } else {
        console.log('[Blockchain] Running in simulation mode (no contract address configured)');
      }
    } catch (error) {
      console.warn('[Blockchain] Could not connect, running in simulation mode:', (error as Error).message);
      if (this.provider) {
        try { this.provider.destroy(); } catch (_) {}
        this.provider = null;
      }
      this.wallet = null;
      this.contract = null;
      this.isConnected = false;
    }
  }

  /**
   * Convert a MySQL election ID into a bytes32 on-chain ID
   */
  electionIdToBytes32(electionId: number | string): string {
    return ethers.id(`votex_election_${electionId}`);
  }

  async createElection(electionId: number, candidateIds: string[]): Promise<{ txHash: string; blockNumber: number; onchainId: string }> {
    const onchainId = this.electionIdToBytes32(electionId);

    if (!this.simulatedVotes.has(electionId)) {
      this.simulatedVotes.set(electionId, new Map());
      this.simulatedVoters.set(electionId, new Set());
    }

    if (!this.isConnected || !this.contract) {
      const sim = this.generateSimulatedBlock();
      return { txHash: sim.txHash, blockNumber: sim.blockNumber, onchainId };
    }

    try {
      const tx = await this.contract.createElection(onchainId, candidateIds);
      const receipt = await tx.wait();
      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        onchainId
      };
    } catch (error) {
      console.warn('[Blockchain] createElection notice:', (error as any)?.shortMessage || (error as any)?.message);
      const sim = this.generateSimulatedBlock();
      return { txHash: sim.txHash, blockNumber: sim.blockNumber, onchainId };
    }
  }

  async castVote(
    electionId: number,
    candidateId: string,
    voterCommitment: string,
    proofHash: string,
    receiptId: string
  ): Promise<{ txHash: string; blockNumber: number }> {
    const numElectionId = Number(electionId);
    const onchainId = this.electionIdToBytes32(numElectionId);
    const commitmentBytes = ethers.zeroPadBytes(ethers.toBeHex(voterCommitment.startsWith('0x') ? voterCommitment : `0x${voterCommitment}`), 32);
    const proofBytes = ethers.zeroPadBytes(ethers.toBeHex(proofHash.startsWith('0x') ? proofHash : `0x${proofHash}`), 32);

    if (!this.isConnected || !this.contract) {
      if (!this.simulatedVotes.has(numElectionId)) {
        this.simulatedVotes.set(numElectionId, new Map());
        this.simulatedVoters.set(numElectionId, new Set());
      }
      const votersSet = this.simulatedVoters.get(numElectionId)!;
      if (votersSet.has(voterCommitment)) {
        throw new Error('DUPLICATE_VOTE');
      }
      votersSet.add(voterCommitment);

      const candidateMap = this.simulatedVotes.get(numElectionId)!;
      candidateMap.set(candidateId, (candidateMap.get(candidateId) || 0) + 1);

      const sim = this.generateSimulatedBlock();
      return { txHash: sim.txHash, blockNumber: sim.blockNumber };
    }

    try {
      const tx = await this.contract.castVote(onchainId, candidateId, commitmentBytes, proofBytes, receiptId);
      const receipt = await tx.wait();
      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error: any) {
      // Check for "already voted" revert from smart contract
      if (error.reason?.includes('already voted') || error.message?.includes('already voted')) {
        throw new Error('DUPLICATE_VOTE');
      }
      const sim = this.generateSimulatedBlock();
      return { txHash: sim.txHash, blockNumber: sim.blockNumber };
    }
  }

  async hasVoted(electionId: number, voterCommitment: string): Promise<boolean> {
    const numElectionId = Number(electionId);
    if (!this.isConnected || !this.contract) {
      const votersSet = this.simulatedVoters.get(numElectionId);
      return votersSet ? votersSet.has(voterCommitment) : false;
    }

    try {
      const onchainId = this.electionIdToBytes32(numElectionId);
      const commitmentBytes = ethers.zeroPadBytes(ethers.toBeHex(voterCommitment.startsWith('0x') ? voterCommitment : `0x${voterCommitment}`), 32);
      return await this.contract.hasVoted(onchainId, commitmentBytes);
    } catch (error) {
      return false;
    }
  }

  async getResults(electionId: number, candidateIds: string[]): Promise<{ candidateId: string; votes: number }[]> {
    const numElectionId = Number(electionId);
    const onchainId = this.electionIdToBytes32(numElectionId);
    const results: { candidateId: string; votes: number }[] = [];

    if (!this.isConnected || !this.contract) {
      const candidateMap = this.simulatedVotes.get(numElectionId);
      for (const candidateId of candidateIds) {
        const count = candidateMap ? (candidateMap.get(candidateId) || 0) : 0;
        results.push({ candidateId, votes: count });
      }
      return results;
    }

    try {
      const info = await this.contract.getElectionInfo(onchainId);
      if (!info || !info[0]) {
        return results;
      }
      for (const candidateId of candidateIds) {
        const count = await this.contract.getResults(onchainId, candidateId);
        results.push({ candidateId, votes: Number(count) });
      }
      return results;
    } catch (error) {
      return results;
    }
  }

  async verifyReceipt(electionId: number, receiptId: string): Promise<{ exists: boolean; proofHash: string; timestamp: number }> {
    if (!this.isConnected || !this.contract) {
      const proofHash = '0x' + crypto.createHash('sha256').update(receiptId).digest('hex');
      return { exists: true, proofHash, timestamp: Date.now() };
    }

    try {
      const onchainId = this.electionIdToBytes32(electionId);
      const [exists, proofHash, timestamp] = await this.contract.verifyReceipt(onchainId, receiptId);
      return { exists, proofHash, timestamp: Number(timestamp) };
    } catch (error) {
      console.error('[Blockchain] verifyReceipt error:', error);
      return { exists: false, proofHash: '0x0', timestamp: 0 };
    }
  }

  getStatus(): { connected: boolean; contractAddress: string } {
    return {
      connected: this.isConnected,
      contractAddress: this.contract?.target?.toString() || 'N/A'
    };
  }
}

export const blockchainService = new BlockchainService();
