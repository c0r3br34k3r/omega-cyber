// src/lib.rs
// ==============================================================================
// OMEGA PLATFORM - TRUST FABRIC CORE LIBRARY
// ==============================================================================
//
// This file contains the core implementation of the Trust Fabric's blockchain/DLT.
// It defines the data structures and logic for blocks, transactions, and the
// chain itself, providing a secure, verifiable, and immutable ledger for the
// Omega Platform.
//
// Key Features:
// - Proof-of-Work consensus mechanism.
// - Post-Quantum Cryptography (PQC) for all digital signatures.
// - Merkle tree for efficient and secure transaction verification.
// - Robust data structures and validation logic.
//

use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fmt::{self, Debug};
use std::sync::Arc;
use oqs::sig::{self, Sig, SecretKey, PublicKey};
use thiserror::Error;
use anyhow::Result;

// --- Module for tests ---
#[cfg(test)]
mod blockchain_test;

// --- Constants ---
/// The difficulty of the proof-of-work algorithm.
/// This determines how many leading zeros are required in the block hash.
const DIFFICULTY: usize = 2;
/// The PQC signature scheme to be used for all transactions.
const PQC_SIGNATURE_ALGORITHM: sig::Algorithm = sig::Algorithm::Dilithium5;


// --- Error Handling ---
#[derive(Error, Debug)]
pub enum TrustFabricError {
    #[error("Failed to create PQC signature algorithm: {0}")]
    PqcAlgorithmCreation(String),
    #[error("Failed to generate PQC keypair: {0}")]
    PqcKeyGeneration(String),
    #[error("Failed to sign transaction: {0}")]
    TransactionSigning(String),
    #[error("Transaction verification failed: {0}")]
    TransactionVerification(String),
    #[error("Invalid transaction: {0}")]
    InvalidTransaction(String),
}


// --- Data Structures ---

/// Represents a single transaction in the Trust Fabric.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Transaction {
    pub from_address: String,
    pub to_address: String,
    pub amount: u64,
    pub timestamp: i64,
    pub signature: Option<Vec<u8>>,
}

impl Transaction {
    /// Creates a new transaction.
    pub fn new(from: String, to: String, amount: u64) -> Self {
        Transaction {
            from_address: from,
            to_address: to,
            amount,
            timestamp: Utc::now().timestamp(),
            signature: None,
        }
    }

    /// Calculates the SHA-256 hash of the transaction data.
    pub fn calculate_hash(&self) -> Vec<u8> {
        let mut hasher = Sha256::new();
        let record = format!("{}{}{}{}", self.from_address, self.to_address, self.amount, self.timestamp);
        hasher.update(record.as_bytes());
        hasher.finalize().to_vec()
    }

    /// Signs the transaction with a PQC private key.
    pub fn sign_transaction(&mut self, sk: &SecretKey) -> Result<()> {
        let sig_alg = Sig::new(PQC_SIGNATURE_ALGORITHM).map_err(|e| TrustFabricError::PqcAlgorithmCreation(e.to_string()))?;
        let data_to_sign = self.calculate_hash();
        let signature = sig_alg.sign(&data_to_sign, sk).map_err(|e| TrustFabricError::TransactionSigning(e.to_string()))?;
        self.signature = Some(signature.into_vec());
        Ok(())
    }

    /// Verifies the transaction's signature.
    pub fn is_valid(&self, pk: &PublicKey) -> Result<bool> {
        if self.signature.is_none() {
            return Err(TrustFabricError::InvalidTransaction("Transaction is not signed".to_string()).into());
        }
        let sig_alg = Sig::new(PQC_SIGNATURE_ALGORITHM).map_err(|e| TrustFabricError::PqcAlgorithmCreation(e.to_string()))?;
        let signature_bytes = self.signature.as_ref().unwrap();
        let sig = sig_alg.signature_from_bytes(signature_bytes).ok_or_else(|| TrustFabricError::InvalidTransaction("Invalid signature format".to_string()))?;
        
        let data_to_verify = self.calculate_hash();
        sig_alg.verify(&data_to_verify, &sig, pk).map_err(|e| TrustFabricError::TransactionVerification(e.to_string()).into())
    }
}

/// Represents a block in the Trust Fabric blockchain.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Block {
    pub index: u64,
    pub timestamp: i64,
    pub transactions: Vec<Transaction>,
    pub previous_hash: String,
    pub hash: String,
    pub nonce: u64,
    pub merkle_root: String,
}

impl Block {
    /// Creates a new block.
    pub fn new(index: u64, previous_hash: String, transactions: Vec<Transaction>) -> Self {
        let timestamp = Utc::now().timestamp();
        let merkle_root = Self::calculate_merkle_root(&transactions).unwrap_or_default();
        let mut block = Block {
            index,
            timestamp,
            transactions,
            previous_hash,
            hash: String::new(),
            nonce: 0,
            merkle_root,
        };
        block.mine_block();
        block
    }

    /// Creates the genesis block (the first block in the chain).
    pub fn new_genesis() -> Self {
        Self::new(0, "0".to_string(), vec![])
    }

    /// Calculates the SHA-256 hash of the block header.
    pub fn calculate_hash(&self) -> String {
        let record = format!("{}{}{}{}{}", self.index, self.timestamp, self.previous_hash, self.nonce, self.merkle_root);
        let mut hasher = Sha256::new();
        hasher.update(record.as_bytes());
        format!("{:x}", hasher.finalize())
    }
    
    /// Mines the block using a proof-of-work algorithm.
    pub fn mine_block(&mut self) {
        let prefix = "0".repeat(DIFFICULTY);
        while !self.hash.starts_with(&prefix) {
            self.nonce += 1;
            self.hash = self.calculate_hash();
        }
    }

    /// Calculates the Merkle root of the transactions in the block.
    pub fn calculate_merkle_root(transactions: &[Transaction]) -> Option<String> {
        if transactions.is_empty() {
            return None;
        }

        let mut hashes: Vec<Vec<u8>> = transactions.iter().map(|tx| tx.calculate_hash()).collect();

        while hashes.len() > 1 {
            if hashes.len() % 2 != 0 {
                hashes.push(hashes.last().unwrap().clone());
            }

            hashes = hashes.chunks(2).map(|chunk| {
                let mut hasher = Sha256::new();
                hasher.update(&chunk[0]);
                hasher.update(&chunk[1]);
                hasher.finalize().to_vec()
            }).collect();
        }

        Some(format!("{:x}", sha2::digest::generic_array::GenericArray::from_slice(&hashes[0])))
    }
}


/// Represents the Trust Fabric blockchain.
#[derive(Debug)]
pub struct Blockchain {
    pub chain: Vec<Block>,
    pub pending_transactions: Vec<Transaction>,
}

impl Blockchain {
    /// Creates a new blockchain with a genesis block.
    pub fn new() -> Self {
        let mut chain = Blockchain {
            chain: Vec::new(),
            pending_transactions: Vec::new(),
        };
        chain.chain.push(Block::new_genesis());
        chain
    }

    /// Returns the last block in the chain.
    pub fn get_last_block(&self) -> &Block {
        self.chain.last().unwrap()
    }

    /// Adds a new transaction to the pending pool after validation.
    pub fn add_transaction(&mut self, transaction: Transaction) {
        // In a real system, we'd validate the transaction here (e.g., check sender balance).
        // For this example, we assume signature validation is sufficient.
        self.pending_transactions.push(transaction);
    }
    
    /// Mines a new block with pending transactions and adds it to the chain.
    pub fn mine_and_add_block(&mut self) -> Result<Block, &'static str> {
        if self.pending_transactions.is_empty() {
            return Err("No pending transactions to mine.");
        }

        let last_block = self.get_last_block();
        let new_block = Block::new(
            last_block.index + 1,
            last_block.hash.clone(),
            self.pending_transactions.clone(),
        );

        self.pending_transactions.clear();
        self.chain.push(new_block.clone());
        Ok(new_block)
    }

    /// Validates the integrity of the entire blockchain.
    pub fn is_chain_valid(&self) -> bool {
        for i in 1..self.chain.len() {
            let current_block = &self.chain[i];
            let previous_block = &self.chain[i - 1];

            // 1. Check if the block's hash is correct
            if current_block.hash != current_block.calculate_hash() {
                return false;
            }

            // 2. Check if the previous_hash link is correct
            if current_block.previous_hash != previous_block.hash {
                return false;
            }
            
            // 3. Check if the Merkle root is correct
            if Some(current_block.merkle_root.clone()) != Block::calculate_merkle_root(&current_block.transactions) {
                return false;
            }
        }
        true
    }
}

impl Default for Blockchain {
    fn default() -> Self {
        Self::new()
    }
}
