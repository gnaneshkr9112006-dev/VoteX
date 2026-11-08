CREATE TABLE IF NOT EXISTS administrators (
  id INT AUTO_INCREMENT PRIMARY KEY,
  login_id VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS election_rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_number VARCHAR(20) UNIQUE NOT NULL,
  admin_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  status ENUM('draft','active','closed','published') DEFAULT 'draft',
  onchain_election_id VARCHAR(66),
  results_published TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES administrators(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS candidates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  election_id INT NOT NULL,
  candidate_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  party VARCHAR(255),
  bio TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(election_id, candidate_code),
  FOREIGN KEY (election_id) REFERENCES election_rooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS voters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  voter_id VARCHAR(100) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone_number VARCHAR(50),
  face_descriptor TEXT,
  face_photo LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_voter_email (email)
);

CREATE TABLE IF NOT EXISTS room_voters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  election_id INT NOT NULL,
  voter_id INT NOT NULL,
  verification_proof_hash VARCHAR(255),
  has_voted TINYINT DEFAULT 0,
  voted_at DATETIME,
  webauthn_credential_id VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(election_id, voter_id),
  FOREIGN KEY (election_id) REFERENCES election_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (voter_id) REFERENCES voters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vote_receipts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  election_id INT NOT NULL,
  receipt_code VARCHAR(100) UNIQUE NOT NULL,
  voter_commitment VARCHAR(66) NOT NULL,
  tx_hash VARCHAR(66),
  block_number BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (election_id) REFERENCES election_rooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS blockchain_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  election_id INT,
  tx_hash VARCHAR(66) NOT NULL,
  block_number BIGINT,
  action_type VARCHAR(50) NOT NULL,
  voter_commitment VARCHAR(66),
  proof_hash VARCHAR(66),
  gas_used BIGINT,
  timestamp DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (election_id) REFERENCES election_rooms(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT,
  election_id INT,
  action VARCHAR(100) NOT NULL,
  details TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES administrators(id) ON DELETE SET NULL,
  FOREIGN KEY (election_id) REFERENCES election_rooms(id) ON DELETE CASCADE
);
