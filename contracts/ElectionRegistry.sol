// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ElectionRegistry
 * @dev Manages elections, voting, and result tracking while preserving voter anonymity.
 * Voter identity is shielded by using cryptographic commitments instead of plain identifiers.
 */
contract ElectionRegistry is Ownable {
    
    struct VoteRecord {
        bool exists;
        bytes32 proofHash;
        uint256 timestamp;
    }

    struct Election {
        bool exists;
        string[] candidateIds;
        address admin;
        mapping(string => uint256) voteCounts;
        mapping(bytes32 => bool) hasVotedMapping;
        mapping(string => VoteRecord) receipts;
    }

    mapping(bytes32 => Election) private elections;

    event ElectionCreated(bytes32 indexed electionId, address indexed admin);
    event VoteCast(
        bytes32 indexed electionId,
        bytes32 indexed voterCommitment,
        bytes32 proofHash,
        string receiptId,
        uint256 timestamp
    );

    /**
     * @dev Constructor sets the owner of the contract.
     */
    constructor() Ownable(msg.sender) {}

    /**
     * @dev Creates a new election.
     * @param electionId The unique identifier for the election.
     * @param candidateIds An array of candidate identifiers.
     */
    function createElection(bytes32 electionId, string[] memory candidateIds) external onlyOwner {
        require(!elections[electionId].exists, "Election already exists");

        Election storage newElection = elections[electionId];
        newElection.exists = true;
        newElection.admin = msg.sender;
        newElection.candidateIds = candidateIds;

        emit ElectionCreated(electionId, msg.sender);
    }

    /**
     * @dev Adds a candidate to an existing election.
     * @param electionId The unique identifier for the election.
     * @param candidateId The identifier of the candidate.
     */
    function addCandidate(bytes32 electionId, string memory candidateId) external onlyOwner {
        Election storage election = elections[electionId];
        require(election.exists, "Election does not exist");
        for (uint256 i = 0; i < election.candidateIds.length; i++) {
            require(
                keccak256(bytes(election.candidateIds[i])) != keccak256(bytes(candidateId)),
                "Candidate already exists"
            );
        }
        election.candidateIds.push(candidateId);
    }

    /**
     * @dev Casts a vote in an election.
     * @param electionId The unique identifier for the election.
     * @param candidateId The identifier of the chosen candidate.
     * @param voterCommitment A cryptographic commitment representing the voter.
     * @param proofHash A hash proving the validity of the vote.
     * @param receiptId A unique identifier for the vote receipt.
     */
    function castVote(
        bytes32 electionId,
        string memory candidateId,
        bytes32 voterCommitment,
        bytes32 proofHash,
        string memory receiptId
    ) external {
        Election storage election = elections[electionId];
        require(election.exists, "Election does not exist");
        require(!election.hasVotedMapping[voterCommitment], "Voter has already voted");
        require(!election.receipts[receiptId].exists, "Receipt ID already used");

        bool validCandidate = false;
        for (uint256 i = 0; i < election.candidateIds.length; i++) {
            if (keccak256(bytes(election.candidateIds[i])) == keccak256(bytes(candidateId))) {
                validCandidate = true;
                break;
            }
        }
        require(validCandidate, "Invalid candidate");

        election.hasVotedMapping[voterCommitment] = true;
        election.voteCounts[candidateId] += 1;
        
        uint256 currentTime = block.timestamp;
        election.receipts[receiptId] = VoteRecord({
            exists: true,
            proofHash: proofHash,
            timestamp: currentTime
        });

        emit VoteCast(electionId, voterCommitment, proofHash, receiptId, currentTime);
    }

    /**
     * @dev Checks if a voter has already cast a vote in an election.
     * @param electionId The unique identifier for the election.
     * @param voterCommitment The cryptographic commitment of the voter.
     * @return bool True if the voter has already voted, false otherwise.
     */
    function hasVoted(bytes32 electionId, bytes32 voterCommitment) external view returns (bool) {
        return elections[electionId].hasVotedMapping[voterCommitment];
    }

    /**
     * @dev Retrieves the vote count for a specific candidate in an election.
     * @param electionId The unique identifier for the election.
     * @param candidateId The identifier of the candidate.
     * @return The number of votes the candidate has received.
     */
    function getResults(bytes32 electionId, string memory candidateId) external view returns (uint256) {
        require(elections[electionId].exists, "Election does not exist");
        return elections[electionId].voteCounts[candidateId];
    }

    /**
     * @dev Retrieves information about an election.
     * @param electionId The unique identifier for the election.
     * @return exists Boolean indicating if the election exists.
     * @return candidateIds Array of candidate identifiers.
     * @return admin Address of the election administrator.
     */
    function getElectionInfo(bytes32 electionId) external view returns (bool exists, string[] memory candidateIds, address admin) {
        Election storage election = elections[electionId];
        return (election.exists, election.candidateIds, election.admin);
    }

    /**
     * @dev Verifies a vote receipt.
     * @param electionId The unique identifier for the election.
     * @param receiptId The unique identifier for the vote receipt.
     * @return exists Boolean indicating if the receipt exists.
     * @return proofHash The proof hash associated with the vote.
     * @return timestamp The timestamp when the vote was cast.
     */
    function verifyReceipt(bytes32 electionId, string memory receiptId) external view returns (bool exists, bytes32 proofHash, uint256 timestamp) {
        require(elections[electionId].exists, "Election does not exist");
        VoteRecord memory record = elections[electionId].receipts[receiptId];
        return (record.exists, record.proofHash, record.timestamp);
    }
}
