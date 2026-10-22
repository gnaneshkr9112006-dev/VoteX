# 🗳️ VoteX — Secure Blockchain-Powered Digital Voting System

VoteX is a full-stack, mobile-first digital voting platform that ensures election integrity through Ethereum smart contracts, secure voter authentication via WebAuthn/Passkeys biometric verification, and real-time result publication via Socket.IO.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React + TypeScript + Vite                 │
│                  (Mobile-First Dark Theme UI)                │
│  Landing → Admin Login → Dashboard → Elections → Candidates  │
│  Landing → Voter Login → Biometric → Ballot → Receipt       │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP API + Socket.IO
┌─────────────────────┴───────────────────────────────────────┐
│              Express + TypeScript API Server                 │
│     JWT HTTP-only Cookies · Rate Limiting · Helmet          │
│   Auth · Elections · Candidates · Voters · Voting · Audit    │
└──────┬──────────────────────────────────┬───────────────────┘
       │                                  │
┌──────┴──────┐                ┌──────────┴──────────┐
│    MySQL    │                │  Hardhat Blockchain  │
│  8 Tables   │                │ ElectionRegistry.sol │
│  Audit Logs │                │   Smart Contract     │
└─────────────┘                └─────────────────────┘
```

## ✨ Features

- **Dual Login Portal** — Administrator and Voter access with distinct, secure workflows
- **Dual Biometric Verification**:
  - **Neural Face Recognition** — Real-time webcam face capture using SSD MobileNet V1, 68-point facial landmarks, and 128D feature embedding matching with anti-spoofing and Euclidean distance verification against the voter's registered photo.
  - **WebAuthn / Passkeys** — Hardware-grade fingerprint & device biometric authentication.
- **Admin Photo & ID Enrollment** — Administrators can enroll voter ID photos during registration or CSV import; voter facial login is strictly validated against this verified reference.
- **Zero-Config In-Memory DB Fallback** — Automatically connects to MySQL if available, or seamlessly initializes an embedded in-memory SQL database (AlaSQL) pre-seeded with sample elections, candidates, and voters.
- **Multi-Election Support** — Multiple admins running independent elections simultaneously with auto room codes (e.g., `VOTEX-2026`).
- **Blockchain-Anchored Voting** — Every vote recorded on Ethereum smart contract (with cryptographic simulation fallback).
- **Double-Vote Prevention** — Enforced at DB level (`has_voted` flag + unique constraint), API level, and smart contract level (`hasVoted` mapping).
- **Voter Privacy & Secrecy** — Vote choices are NEVER linked to voter identity; ballots use cryptographic salted commitments.
- **CSV Voter Import** — Bulk import with duplicate detection and schema validation.
- **Real-Time Live Analytics** — Socket.IO pushes live voter turnout and tally charts.
- **Comprehensive Audit Trail** — Every action logged with timestamps and IP addresses.
- **Mobile-First Design** — Glassmorphic dark theme optimized for both desktop and mobile devices.

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **MySQL** 8.0+ *(Optional — system automatically activates zero-config in-memory database if MySQL is not running)*
- **Webcam** *(Optional — for live facial biometric recognition demo)*

## 🚀 Quick Start

### 1. Clone & Install

```bash
cd voteX

# Install root dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..

# Install client dependencies
cd client && npm install && cd ..
```

### 2. Start Application (Single Command)

```bash
npm run dev
```

> 💡 **Zero-Config Ready:** If you don't have MySQL or a local Hardhat blockchain running, VoteX automatically falls back to an embedded SQL database and cryptographic receipts!

Open **http://localhost:5173** in your browser.

---

### 🔑 Default Credentials & Demo Accounts

| Role | Room Code | Login ID / Voter ID | Password | Notes |
|------|-----------|---------------------|----------|-------|
| **Admin** | — | `admin` | `admin123` | Full administrative control |
| **Voter** | `VOTEX-2026` | `VTR-003` | — | Pre-registered voter (Gnaneshwar) |

---

### ⛓️ Optional: Connect Real MySQL & Local Blockchain

1. **MySQL Setup**:
   ```bash
   cp .env.example .env
   # Set DB_HOST, DB_USER, DB_PASSWORD in .env
   ```
2. **Local Hardhat Node**:
   ```bash
   npx hardhat node
   npm run hardhat:compile
   npm run hardhat:deploy
   ```

## 📁 Project Structure

```
voteX/
├── contracts/
│   └── ElectionRegistry.sol       # Solidity smart contract
├── scripts/
│   └── deploy.ts                  # Hardhat deployment script
├── test/
│   └── ElectionRegistry.test.ts   # Smart contract tests
├── server/
│   ├── src/
│   │   ├── config/index.ts        # Environment configuration
│   │   ├── db/
│   │   │   ├── schema.sql         # MySQL schema (8 tables)
│   │   │   ├── connection.ts      # MySQL pool + auto-init
│   │   │   └── seedAdmin.ts       # Admin seeder
│   │   ├── middleware/
│   │   │   ├── auth.ts            # JWT cookie verification
│   │   │   ├── rateLimiter.ts     # Rate limiting
│   │   │   └── validation.ts      # Input validation
│   │   ├── controllers/
│   │   │   ├── authController.ts
│   │   │   ├── electionController.ts
│   │   │   ├── candidateController.ts
│   │   │   ├── voterController.ts
│   │   │   ├── voteController.ts
│   │   │   ├── resultsController.ts
│   │   │   └── auditController.ts
│   │   ├── routes/                # Express routers
│   │   ├── services/
│   │   │   ├── blockchainService.ts   # Ethers.js contract wrapper
│   │   │   ├── socketService.ts       # Socket.IO events
│   │   │   └── webauthnService.ts     # WebAuthn + DEMO_MODE
│   │   ├── utils/
│   │   │   ├── generateRoomNumber.ts
│   │   │   └── voterCommitment.ts
│   │   └── index.ts               # Server entry point
│   └── tests/
│       ├── voting.test.ts         # Duplicate vote prevention tests
│       └── permissions.test.ts    # Authorization tests
├── client/
│   ├── src/
│   │   ├── index.css              # Design system (glassmorphism)
│   │   ├── App.tsx                # Router + Protected Routes
│   │   ├── api/                   # API client modules
│   │   ├── contexts/              # Auth + Socket contexts
│   │   ├── components/            # Shared UI components
│   │   └── pages/                 # 13 page components
│   └── index.html
├── .env.example                   # Environment template
├── sample_voters.csv              # CSV import sample
├── hardhat.config.ts              # Blockchain config
├── package.json                   # Monorepo scripts
└── README.md                      # This file
```

## 🔐 Security Architecture

| Layer | Mechanism |
|-------|-----------|
| **Passwords** | bcrypt hash (cost factor 10) |
| **Auth Tokens** | JWT in HTTP-only secure cookies |
| **Rate Limiting** | express-rate-limit (configurable window) |
| **Admin Isolation** | Every query filters by `admin_id` |
| **Vote Integrity** | MySQL `FOR UPDATE` lock + `UNIQUE` constraint + Smart contract `hasVoted` mapping |
| **Voter Privacy** | Vote choice never stored with voter identity in MySQL |
| **Biometric Data** | Only non-reversible SHA-256 proof hash stored; no raw biometric data |
| **Blockchain** | Salted commitment hashes; no PII on-chain |
| **Input Validation** | Server-side validation on all endpoints |
| **CORS** | Locked to `CLIENT_URL` origin only |

## 📊 MySQL Schema

8 tables with foreign keys and constraints:

| Table | Purpose |
|-------|---------|
| `administrators` | Admin accounts with bcrypt password hashes |
| `election_rooms` | Elections with room codes, timing, status |
| `candidates` | Election candidates (unique per room) |
| `voters` | Global voter registry |
| `room_voters` | Voter-to-election mapping with `has_voted` flag |
| `vote_receipts` | Cryptographic vote receipts (no candidate link) |
| `blockchain_transactions` | On-chain transaction audit trail |
| `audit_logs` | All admin actions with IP addresses |

## ⛓️ Smart Contract

`ElectionRegistry.sol` (Solidity ^0.8.20):

- `createElection(bytes32 electionId, string[] candidateIds)` — Owner-only
- `castVote(bytes32 electionId, string candidateId, bytes32 voterCommitment, bytes32 proofHash, string receiptId)` — Rejects duplicates
- `hasVoted(bytes32 electionId, bytes32 voterCommitment)` — Check vote status
- `getResults(bytes32 electionId, string candidateId)` — Vote count per candidate
- `verifyReceipt(bytes32 electionId, string receiptId)` — On-chain receipt verification

## 🧪 Testing

```bash
# Smart contract tests
npx hardhat test

# Backend API tests
cd server && npm test
```

Tests cover:
- ✅ Duplicate vote prevention (API + smart contract)
- ✅ Election timing enforcement
- ✅ Admin cannot access another admin's election
- ✅ Results publication only when closed/ended
- ✅ Voter can only access their registered room

## 📱 CSV Import Format

```csv
voter_id,full_name,email
VOTER-101,Alice Johnson,alice.johnson@example.com
VOTER-102,Bob Smith,bob.smith@example.com
```

See `sample_voters.csv` for a complete example.

## 🌐 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/admin/login` | Admin login |
| POST | `/api/auth/voter/login` | Voter login (room + voter ID) |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Current user |

### Elections
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/elections` | Create election |
| GET | `/api/elections` | List admin's elections |
| GET | `/api/elections/:id` | Get election details |
| PUT | `/api/elections/:id` | Update election |
| POST | `/api/elections/:id/close` | Close election early |
| POST | `/api/elections/:id/publish` | Publish results |
| GET | `/api/elections/:id/stats` | Election statistics |

### Candidates
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/elections/:id/candidates` | Add candidate |
| PUT | `/api/elections/:id/candidates/:cid` | Edit candidate |
| DELETE | `/api/elections/:id/candidates/:cid` | Remove candidate |
| GET | `/api/elections/:id/candidates` | List candidates |

### Voters
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/elections/:id/voters` | Register voter |
| POST | `/api/elections/:id/voters/import` | CSV import |
| GET | `/api/elections/:id/voters` | List voters |
| DELETE | `/api/elections/:id/voters/:vid` | Remove voter |

### Voting
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/vote/verify` | Biometric verification |
| POST | `/api/vote/cast` | Cast vote |
| GET | `/api/vote/receipt/:code` | Get receipt |
| GET | `/api/vote/status` | Check vote status |

### Results & Audit
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/elections/:id/results` | Get results (if published) |
| GET | `/api/elections/room/:room/results` | Public results by room |
| GET | `/api/elections/:id/audit` | Audit log |
| GET | `/api/audit/verify/:code` | Verify receipt on-chain |

## 🔧 Environment Variables

See `.env.example` for the complete list. Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | MySQL host | `localhost` |
| `DB_PASSWORD` | MySQL password | (required) |
| `JWT_SECRET` | JWT signing secret | (required for production) |
| `DEMO_MODE` | Mock biometric flow | `true` |
| `CONTRACT_ADDRESS` | Deployed contract | Auto-read from `deployed-address.json` |
| `ADMIN_LOGIN_ID` | Seed admin username | `admin` |
| `ADMIN_PASSWORD` | Seed admin password | `admin123` |

## 📜 License

MIT
