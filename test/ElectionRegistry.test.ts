import { expect } from "chai";
import { ethers } from "hardhat";
import { ElectionRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ElectionRegistry", function () {
  let electionRegistry: ElectionRegistry;
  let owner: SignerWithAddress;
  let otherAccount: SignerWithAddress;

  const electionId = ethers.id("ELECTION_1");
  const candidateIds = ["CANDIDATE_A", "CANDIDATE_B"];

  beforeEach(async function () {
    [owner, otherAccount] = await ethers.getSigners();
    const ElectionRegistryFactory = await ethers.getContractFactory("ElectionRegistry");
    electionRegistry = (await ElectionRegistryFactory.deploy()) as unknown as ElectionRegistry;
  });

  describe("createElection", function () {
    it("Should allow the owner to create an election", async function () {
      await expect(electionRegistry.createElection(electionId, candidateIds))
        .to.emit(electionRegistry, "ElectionCreated")
        .withArgs(electionId, owner.address);

      const info = await electionRegistry.getElectionInfo(electionId);
      expect(info.exists).to.be.true;
      expect(info.candidateIds).to.deep.equal(candidateIds);
      expect(info.admin).to.equal(owner.address);
    });

    it("Should revert if a non-owner tries to create an election", async function () {
      await expect(
        electionRegistry.connect(otherAccount).createElection(electionId, candidateIds)
      ).to.be.revertedWithCustomError(electionRegistry, "OwnableUnauthorizedAccount");
    });

    it("Should revert if the election already exists", async function () {
      await electionRegistry.createElection(electionId, candidateIds);
      await expect(electionRegistry.createElection(electionId, candidateIds))
        .to.be.revertedWith("Election already exists");
    });
  });

  describe("Voting and Results", function () {
    const candidateId = "CANDIDATE_A";
    const voterCommitment = ethers.id("VOTER_1_COMMITMENT");
    const proofHash = ethers.id("PROOF_HASH_1");
    const receiptId = "RECEIPT_1";

    beforeEach(async function () {
      await electionRegistry.createElection(electionId, candidateIds);
    });

    it("Should allow a voter to cast a vote successfully", async function () {
      const tx = await electionRegistry.castVote(
        electionId,
        candidateId,
        voterCommitment,
        proofHash,
        receiptId
      );

      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx)
        .to.emit(electionRegistry, "VoteCast")
        .withArgs(electionId, voterCommitment, proofHash, receiptId, block?.timestamp);

      const results = await electionRegistry.getResults(electionId, candidateId);
      expect(results).to.equal(1n);

      const hasVoted = await electionRegistry.hasVoted(electionId, voterCommitment);
      expect(hasVoted).to.be.true;
    });

    it("Should reject duplicate votes with the same voterCommitment", async function () {
      await electionRegistry.castVote(
        electionId,
        candidateId,
        voterCommitment,
        proofHash,
        receiptId
      );

      await expect(
        electionRegistry.castVote(
          electionId,
          "CANDIDATE_B",
          voterCommitment,
          ethers.id("PROOF_HASH_2"),
          "RECEIPT_2"
        )
      ).to.be.revertedWith("Voter has already voted");
    });

    it("Should allow getting results", async function () {
      await electionRegistry.castVote(
        electionId,
        candidateId,
        voterCommitment,
        proofHash,
        receiptId
      );

      const resultsA = await electionRegistry.getResults(electionId, candidateId);
      const resultsB = await electionRegistry.getResults(electionId, "CANDIDATE_B");

      expect(resultsA).to.equal(1n);
      expect(resultsB).to.equal(0n);
    });

    it("Should verify receipt", async function () {
      await electionRegistry.castVote(
        electionId,
        candidateId,
        voterCommitment,
        proofHash,
        receiptId
      );

      const [exists, returnedProof, timestamp] = await electionRegistry.verifyReceipt(electionId, receiptId);
      
      expect(exists).to.be.true;
      expect(returnedProof).to.equal(proofHash);
      expect(timestamp).to.be.greaterThan(0);
    });
  });
});
