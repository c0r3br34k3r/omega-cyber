// trust-fabric/src/blockchain_test.rs

#[cfg(test)]
mod tests {
    use super::super::blockchain_dag::{Block, Dag};
    use super::super::post_quantum_crypto;

    #[test]
    fn test_block_creation_and_hash() {
        let block = Block::new("genesis".to_string(), vec![], "initial data".to_string());
        assert!(!block.hash.is_empty());
        let recalculated_hash = block.calculate_hash();
        assert_eq!(block.hash, recalculated_hash);
    }

    #[test]
    fn test_dag_add_block() {
        let mut dag = Dag::new();
        let genesis_block = Block::new("genesis".to_string(), vec![], "initial data".to_string());
        dag.add_block(genesis_block.clone()).unwrap();
        assert!(dag.get_block("genesis").is_some());

        let child_block = Block::new("child1".to_string(), vec!["genesis".to_string()], "more data".to_string());
        dag.add_block(child_block.clone()).unwrap();
        assert!(dag.get_block("child1").is_some());

        let invalid_block = Block::new("invalid".to_string(), vec!["non_existent".to_string()], "bad parent".to_string());
        assert!(dag.add_block(invalid_block).is_err());
    }

    #[test]
    fn test_dag_verify_integrity() {
        let mut dag = Dag::new();
        let genesis_block = Block::new("genesis".to_string(), vec![], "initial data".to_string());
        dag.add_block(genesis_block.clone()).unwrap();
        assert!(dag.verify_integrity());

        let child_block = Block::new("child1".to_string(), vec!["genesis".to_string()], "more data".to_string());
        dag.add_block(child_block.clone()).unwrap();
        assert!(dag.verify_integrity());
    }

    #[test]
    fn test_pqc_encryption_decryption() {
        let (public_key, private_key) = post_quantum_crypto::generate_keypair();
        let original_data = "sensitive info";
        let encrypted = post_quantum_crypto::encrypt(original_data, &public_key);
        let decrypted = post_quantum_crypto::decrypt(&encrypted, &private_key);
        assert_eq!(decrypted, original_data);
    }
}
