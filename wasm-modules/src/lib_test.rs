// wasm-modules/src/lib_test.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add() {
        assert_eq!(add(2, 3), 5);
        assert_eq!(add(-1, 1), 0);
    }

    #[test]
    fn test_filter_positive_numbers() {
        let mut numbers = vec![-1, 2, -3, 4, 0, 5];
        let new_len = unsafe {
            filter_positive_numbers(numbers.as_mut_ptr(), numbers.len())
        };
        assert_eq!(new_len, 3);
        assert_eq!(&numbers[0..new_len], &[2, 4, 5]);

        let mut empty_numbers: Vec<i32> = vec![];
        let new_len_empty = unsafe {
            filter_positive_numbers(empty_numbers.as_mut_ptr(), empty_numbers.len())
        };
        assert_eq!(new_len_empty, 0);

        let mut all_negative = vec![-1, -2, -3];
        let new_len_negative = unsafe {
            filter_positive_numbers(all_negative.as_mut_ptr(), all_negative.len())
        };
        assert_eq!(new_len_negative, 0);
    }
}
