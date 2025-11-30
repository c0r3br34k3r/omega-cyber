// wasm-modules/src/lib.rs
// This will contain functions to be exposed to WASM

#[no_mangle]
pub extern "C" fn greet() {
    // In a real scenario, this might interact with other host functions
    // or perform some computation.
    // For now, we'll just have a placeholder.
}

// Example of a function that could be compiled to WASM
#[no_mangle]
pub extern "C" fn add(a: i32, b: i32) -> i32 {
    a + b
}

/// A more complex function that processes an array of integers
/// This simulates a simple filter operation.
/// The input and output would typically be handled through shared memory in WASM.
#[no_mangle]
pub extern "C" fn filter_positive_numbers(ptr: *mut i32, len: usize) -> usize {
    if ptr.is_null() || len == 0 {
        return 0;
    }

    let slice = unsafe { std::slice::from_raw_parts_mut(ptr, len) };
    let mut write_idx = 0;
    for i in 0..len {
        if slice[i] > 0 {
            slice[write_idx] = slice[i];
            write_idx += 1;
        }
    }
    write_idx // Return the new length
}

// Helper for memory management for the host environment.
// In a real WASM application, memory allocation/deallocation
// would be carefully managed by the host or a WASM-specific allocator.
#[no_mangle]
pub extern "C" fn allocate(size: usize) -> *mut u8 {
    let mut vec = Vec::with_capacity(size);
    let ptr = vec.as_mut_ptr();
    std::mem::forget(vec); // Crucial to prevent deallocation
    ptr
}

#[no_mangle]
pub extern "C" fn deallocate(ptr: *mut u8, capacity: usize) {
    unsafe {
        let _ = Vec::from_raw_parts(ptr, 0, capacity);
    }
}