// src/blockchain_test.rs
// ==============================================================================
// OMEGA PLATFORM - TRUST FABRIC BLOCKCHAIN TEST SUITE
// ==============================================================================
//
// This file contains a comprehensive suite of tests for the blockchain/DLT
// implementation of the Trust Fabric. It verifies the cryptographic integrity,
// security, and correctness of core functionalities, including block creation,
// transaction validation, PQC-based signing, and Merkle tree integrity.
//

#![cfg(test)]

// Import the main library code
use super::*;
use oqs::sig::{self, Sig};
use std::time::{SystemTime, UNIX_EPOCH};

// --- Helper Functions for Tests ---
fn create_test_keypair() -> (sig::PublicKey, sig::SecretKey) {
    let sig_alg = Sig::new(sig::Algorithm::Dilithium5).expect("Failed to create DILITHIUM5 signature algorithm");
    let (pk, sk) = sig_alg.keypair().expect("Failed to generate PQC keypair");
    (pk, sk)
}

fn create_signed_transaction(from: &str, to: &str, amount: u64, sk: &sig::SecretKey) -> Transaction {
    let mut tx = Transaction::new(from.to_string(), to.to_string(), amount);
    tx.sign_transaction(sk).expect("Failed to sign transaction");
    tx
}

// --- Test Modules ---

#[cfg(test)]
mod block_creation_tests {
    use super::*;

    #[test]
    fn test_create_genesis_block() {
        let genesis_block = Block::new_genesis();
        assert_eq!(genesis_block.index, 0);
        assert_eq!(genesis_block.previous_hash, "0");
        assert!(genesis_block.hash.starts_with("00")); // Check if it meets some difficulty
    }

    #[test]
    fn test_mine_new_block() {
        let (pk, sk) = create_test_keypair();
        let mut blockchain = Blockchain::new();
        let tx1 = create_signed_transaction("Alice", "Bob", 50, &sk);
        
        blockchain.add_transaction(tx1);
        let last_block = blockchain.get_last_block();
        let new_block = Block::mine_block(last_block, blockchain.get_pending_transactions().clone());

        assert_eq!(new_block.index, 1);
        assert_eq!(new_block.previous_hash, last_block.hash);
        assert!(new_block.hash.starts_with(&"0".repeat(DIFFICULTY)));
        assert_eq!(new_block.transactions.len(), 1);
    }
}

#[cfg(test)]
mod transaction_validation_tests {
    use super::*;

    #[test]
    fn test_create_and_verify_valid_transaction() {
        let (pk, sk) = create_test_keypair();
        let tx = create_signed_transaction("Alice", "Bob", 100, &sk);
        
        assert!(tx.is_valid(&pk).unwrap(), "Transaction signature should be valid");
    }

    #[test]
    fn test_invalid_signature_fails_validation() {
        let (pk1, sk1) = create_test_keypair(); // Keypair 1
        let (pk2, _) = create_test_keypair();    // Keypair 2 (for verification)

        let tx = create_signed_transaction("Alice", "Bob", 100, &sk1);
        
        assert!(!tx.is_valid(&pk2).unwrap(), "Transaction should be invalid with the wrong public key");
    }

    #[test]
    fn test_tampered_transaction_fails_validation() {
        let (pk, sk) = create_test_keypair();
        let mut tx = create_signed_transaction("Alice", "Bob", 100, &sk);

        // Tamper with the transaction after signing
        tx.amount = 1000;
        
        assert!(!tx.is_valid(&pk).unwrap(), "Tampered transaction should fail validation");
    }
}

#[cfg(test)]
mod blockchain_integrity_tests {
    use super::*;

    #[test]
    fn test_add_block_to_chain() {
        let (pk, sk) = create_test_keypair();
        let mut blockchain = Blockchain::new();
        
        blockchain.add_transaction(create_signed_transaction("A", "B", 10, &sk));
        let mined_block = blockchain.mine_and_add_block();

        assert!(mined_block.is_ok());
        assert_eq!(blockchain.chain.len(), 2);
        assert_eq!(blockchain.get_last_block().index, 1);
        assert_eq!(blockchain.pending_transactions.len(), 0);
    }

    #[test]
    fn test_chain_validation_valid() {
        let (pk, sk) = create_test_keypair();
        let mut blockchain = Blockchain::new();
        
        blockchain.add_transaction(create_signed_transaction("A", "B", 10, &sk));
        blockchain.mine_and_add_block().unwrap();
        
        blockchain.add_transaction(create_signed_transaction("B", "C", 5, &sk));
        blockchain.mine_and_add_block().unwrap();

        assert!(blockchain.is_chain_valid(), "A valid chain should pass validation");
    }

    #[test]
    fn test_chain_with_tampered_block_is_invalid() {
        let (pk, sk) = create_test_keypair();
        let mut blockchain = Blockchain::new();
        
        blockchain.add_transaction(create_signed_transaction("A", "B", 10, &sk));
        blockchain.mine_and_add_block().unwrap();
        
        blockchain.add_transaction(create_signed_transaction("B", "C", 5, &sk));
        blockchain.mine_and_add_block().unwrap();

        // Tamper with a block in the middle of the chain
        if let Some(block) = blockchain.chain.get_mut(1) {
            block.transactions[0].amount = 9999;
            // The hash is now incorrect, which should be caught by the previous_hash check
        }

        assert!(!blockchain.is_chain_valid(), "A chain with a tampered block should be invalid");
    }

    #[test]
    fn test_chain_with_invalid_previous_hash_is_invalid() {
        let (pk, sk) = create_test_keypair();
        let mut blockchain = Blockchain::new();
        
        blockchain.add_transaction(create_signed_transaction("A", "B", 10, &sk));
        blockchain.mine_and_add_block().unwrap();
        
        blockchain.add_transaction(create_signed_transaction("B", "C", 5, &sk));
        blockchain.mine_and_add_block().unwrap();

        // Tamper with the previous_hash link
        if let Some(block) = blockchain.chain.get_mut(2) {
            block.previous_hash = "invalid_hash".to_string();
        }

        assert!(!blockchain.is_chain_valid(), "A chain with an invalid previous_hash link should be invalid");
    }
}

#[cfg(test)]
mod merkle_tree_tests {
    use super::*;

    #[test]
    fn test_merkle_root_is_correct() {
        let (pk, sk) = create_test_keypair();
        let tx1 = create_signed_transaction("A", "B", 10, &sk);
        let tx2 = create_signed_transaction("B", "C", 20, &sk);
        let transactions = vec![tx1, tx2];

        let merkle_root = Block::calculate_merkle_root(&transactions);
        assert!(merkle_root.is_some());
        
        // In a real test, we would compare against a known-good Merkle root
        // For now, just ensure it's generated
        assert!(!merkle_root.unwrap().is_empty());
    }

    #[test]
    fn test_merkle_root_changes_with_tampered_transaction() {
        let (pk, sk) = create_test_keypair();
        let tx1 = create_signed_transaction("A", "B", 10, &sk);
        let tx2 = create_signed_transaction("B", "C", 20, &sk);
        let mut transactions_original = vec![tx1, tx2];
        
        let root_original = Block::calculate_merkle_root(&transactions_original).unwrap();
        
        // Tamper one transaction
        transactions_original[0].amount = 11;
        
        let root_tampered = Block::calculate_merkle_root(&transactions_original).unwrap();
        
        assert_ne!(root_original, root_tampered, "Merkle root should change if a transaction is tampered with");
    }
    
    #[test]
    fn test_merkle_root_with_odd_number_of_transactions() {
        let (pk, sk) = create_test_keypair();
        let tx1 = create_signed_transaction("A", "B", 10, &sk);
        let tx2 = create_signed_transaction("B", "C", 20, &sk);
        let tx3 = create_signed_transaction("C", "D", 30, &sk);
        let transactions = vec![tx1, tx2, tx3];

        let merkle_root = Block::calculate_merkle_root(&transactions);
        assert!(merkle_root.is_some());
        assert!(!merkle_root.unwrap().is_empty());
    }
}