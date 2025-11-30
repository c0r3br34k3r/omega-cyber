# scripts/ci_tasks.py
# A simple Python script for common CI/CD tasks

import os
import re
import sys

def check_cargo_versions(root_dir="."):
    """
    Checks if Cargo.toml files have a valid version number (e.g., "0.1.0").
    Returns True if all checked versions are valid, False otherwise.
    """
    print(f"Checking Cargo.toml versions in {root_dir}...")
    version_pattern = re.compile(r'^version\s*=\s*"(\d+\.\d+\.\d+)"$')
    all_versions_valid = True

    for dirpath, dirnames, filenames in os.walk(root_dir):
        if "Cargo.toml" in filenames:
            cargo_toml_path = os.path.join(dirpath, "Cargo.toml")
            print(f"  Processing {cargo_toml_path}")
            with open(cargo_toml_path, 'r') as f:
                found_version = False
                for line in f:
                    match = version_pattern.match(line.strip())
                    if match:
                        version = match.group(1)
                        print(f"    Found version: {version}")
                        found_version = True
                        # Basic validation: check if it's X.Y.Z format
                        if not re.fullmatch(r'\d+\.\d+\.\d+', version):
                            print(f"    ERROR: Invalid version format in {cargo_toml_path}: {version}")
                            all_versions_valid = False
                        break
                if not found_version:
                    print(f"    WARNING: No version found in {cargo_toml_path}")
                    # Decide if this should be a failure or just a warning
                    # For now, treat as warning, so doesn't fail the check
            print("-" * 40)
    
    if all_versions_valid:
        print("All Cargo.toml versions checked and found to be valid.")
    else:
        print("WARNING: Some Cargo.toml versions had issues.")
    
    return all_versions_valid

if __name__ == "__main__":
    if not check_cargo_versions("../"): # Check relative to the project root
        sys.exit(1)
    else:
        print("CI Python tasks completed successfully.")
