# intelligence-core/src/python/data_processing.py
import logging
import os
import re
from pathlib import Path
from typing import List, Dict, Any, Generator, Tuple, Union

import jamo
import numpy as np
import torch

# --- Configuration & Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - [%(name)s] %(message)s')
logger = logging.getLogger(__name__)

# --- Part 1: Kaldi Speech Data Loader ---

class KaldiData:
    """
    A data loader for datasets formatted in the Kaldi speech recognition toolkit style.
    It reads `segments`, `utt2spk`, `text`, and `wav.scp` files to create a unified
    view of the dataset, which can be iterated over.
    """
    def __init__(self, data_dir: Union[str, Path]):
        self.data_dir = Path(data_dir)
        if not self.data_dir.exists():
            raise FileNotFoundError(f"Kaldi data directory not found: {self.data_dir}")

        self.segments = self._load_key_value(self.data_dir / 'segments')
        self.utt2spk = self._load_key_value(self.data_dir / 'utt2spk')
        self.text = self._load_key_value(self.data_dir / 'text')
        self.wav_scp = self._load_key_value(self.data_dir / 'wav.scp')

        logger.info(f"Loaded Kaldi data from {self.data_dir}: "
                    f"{len(self.segments)} segments, {len(self.text)} utterances.")

    @staticmethod
    def _load_key_value(file_path: Path) -> Dict[str, str]:
        """Loads a Kaldi file (e.g., utt2spk) into a dictionary."""
        data = {}
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                parts = line.strip().split(maxsplit=1)
                if len(parts) == 2:
                    data[parts[0]] = parts[1]
        return data

    def __iter__(self) -> Generator[Dict[str, Any], None, None]:
        """Iterates over the dataset, yielding a dictionary for each utterance."""
        for utt_id, text in self.text.items():
            speaker_id = self.utt2spk.get(utt_id)
            segment_info = self.segments.get(utt_id)
            
            if not speaker_id or not segment_info:
                continue

            segment_parts = segment_info.split()
            wav_file_id, start_time, end_time = segment_parts[0], float(segment_parts[2]), float(segment_parts[3])
            
            wav_path = self.wav_scp.get(wav_file_id)
            if not wav_path:
                continue

            yield {
                "utterance_id": utt_id,
                "speaker_id": speaker_id,
                "text": text,
                "wav_path": wav_path,
                "start_time": start_time,
                "end_time": end_time,
                "duration": end_time - start_time
            }

# --- Part 2: Korean Text Cleaner ---

class KoreanCleaner:
    """
    A sophisticated text cleaner for Korean, designed to normalize text for
    downstream NLP and speech tasks. It handles numbers, English characters,
    and special characters, converting them into a consistent phonetic representation.
    """
    def __init__(self):
        self._jamo_to_hcj = {j: h for h, j in jamo.jamo.hcj_map.items()}
        self._numbers = "일이삼사오육칠팔구"
        self._number_map = {str(i): self._numbers[i] for i in range(10)}
        self._english_map = {
            'A': '에이', 'B': '비', 'C': '씨', 'D': '디', 'E': '이', 'F': '에프', 'G': '지',
            'H': '에이치', 'I': '아이', 'J': '제이', 'K': '케이', 'L': '엘', 'M': '엠', 'N': '엔',
            'O': '오', 'P': '피', 'Q': '큐', 'R': '알', 'S': '에스', 'T': '티', 'U': '유',
            'V': '브이', 'W': '더블유', 'X': '엑스', 'Y': '와이', 'Z': '제트'
        }
        self._specials = ".,!?"
        self._special_map = {s: "" for s in self._specials} # Remove special characters

    def _normalize_numbers(self, text: str) -> str:
        return "".join([self._number_map.get(char, char) for char in text])

    def _normalize_english(self, text: str) -> str:
        return "".join([self._english_map.get(char.upper(), char) for char in text])

    def _normalize_specials(self, text: str) -> str:
        return "".join([self._special_map.get(char, char) for char in text])

    def clean(self, text: str) -> str:
        """Applies the full cleaning and normalization pipeline to a string."""
        text = self._normalize_numbers(text)
        text = self._normalize_english(text)
        text = self._normalize_specials(text)
        # Final Jamo decomposition and recomposition can further regularize text
        try:
            decomposed = jamo.hangul_to_jamo(text)
            recomposed = jamo.jamo_to_hangul(decomposed)
            return recomposed
        except Exception as e:
            logger.warning(f"Failed to process Jamo for text '{text}': {e}")
            return text

# --- Part 3: ILQL Data Generator ---
# ILQL (Implicit Q-Learning) is an offline RL algorithm. This generator
# prepares data for it.

@dataclass
class TokenTrajectory:
    """Represents a single trajectory of tokenized observations and actions."""
    tokens: List[int]
    rewards: List[float]
    ends: List[bool]

class TokenTrajectoryChain:
    """A chain of trajectories, typically for a single episode."""
    def __init__(self, token_trajectories: List[TokenTrajectory]):
        self.token_trajectories = token_trajectories

    def to_ilql_data(self) -> Dict[str, torch.Tensor]:
        """Converts the chain of trajectories into a dictionary of tensors for ILQL."""
        observations = torch.cat([torch.tensor(t.tokens, dtype=torch.long) for t in self.token_trajectories])
        rewards = torch.cat([torch.tensor(t.rewards, dtype=torch.float32) for t in self.token_trajectories])
        # 'ends' are terminal flags, but ILQL uses 'dones' at the end of trajectories
        # and 'timeouts' for other ends.
        dones = torch.zeros_like(rewards, dtype=torch.bool)
        for t in self.token_trajectories:
            if t.ends and t.ends[-1]:
                # Find the corresponding position in the concatenated tensor
                pos = len(t.tokens) - 1
                # This logic is simplified; a real implementation would need to track indices
                # dones[pos] = True 
        
        # ILQL also requires actions and next_observations, which are derived from observations
        actions = observations
        next_observations = torch.roll(observations, shifts=-1, dims=0)
        next_observations[-1] = 0 # Or a padding token

        return {
            "observations": observations,
            "actions": actions,
            "next_observations": next_observations,
            "rewards": rewards,
            "dones": dones
        }

class ILQLDataGenerator:
    """
    Generates data formatted for Implicit Q-Learning (ILQL) from raw trajectories.
    """
    def __call__(self, trajectories: List[Dict]) -> Generator[TokenTrajectoryChain, None, None]:
        for episode in trajectories:
            # This assumes `episode` is a list of turns/steps.
            # In a real scenario, this would involve complex tokenization and reward calculation.
            token_trajectories = []
            for step in episode.get("steps", []):
                # Dummy tokenization and reward
                tokens = [ord(c) for c in step.get("text", "")]
                rewards = [step.get("reward", 0.0)] * len(tokens)
                ends = [False] * (len(tokens) - 1) + [step.get("is_terminal", False)]
                token_trajectories.append(TokenTrajectory(tokens=tokens, rewards=rewards, ends=ends))
            
            if token_trajectories:
                yield TokenTrajectoryChain(token_trajectories)

# --- Example Usage ---
if __name__ == "__main__":
    # 1. Korean Cleaner Example
    cleaner = KoreanCleaner()
    original_text = "Omega-1에서 탐지된 위협 level은 5입니다. 확인 바랍니다!"
    cleaned_text = cleaner.clean(original_text)
    logger.info("--- Korean Cleaner Example ---")
    logger.info(f"Original: {original_text}")
    logger.info(f"Cleaned:  {cleaned_text}")

    # 2. Kaldi Data Loader Example (requires mock files)
    logger.info("\n--- Kaldi Data Loader Example ---")
    mock_data_dir = Path("./mock_kaldi_data")
    mock_data_dir.mkdir(exist_ok=True)
    try:
        with open(mock_data_dir / "text", "w") as f:
            f.write("utt1 Hello world\n")
        with open(mock_data_dir / "segments", "w") as f:
            f.write("utt1 wav1 0.5 2.5\n")
        with open(mock_data_dir / "utt2spk", "w") as f:
            f.write("utt1 spk1\n")
        with open(mock_data_dir / "wav.scp", "w") as f:
            f.write("wav1 /path/to/wav1.wav\n")

        kaldi_loader = KaldiData(mock_data_dir)
        for item in kaldi_loader:
            logger.info(f"Loaded from Kaldi: {item}")
    except Exception as e:
        logger.error(f"Kaldi example failed: {e}")
    finally:
        # Cleanup mock files
        for f in mock_data_dir.glob("*"):
            f.unlink()
        mock_data_dir.rmdir()

    # 3. ILQL Data Generator Example
    logger.info("\n--- ILQL Data Generator Example ---")
    raw_trajectories = [
        {"steps": [
            {"text": "identify target", "reward": 0.1, "is_terminal": False},
            {"text": "launch exploit", "reward": 0.9, "is_terminal": True}
        ]},
        {"steps": [
            {"text": "scan network", "reward": 0.0, "is_terminal": False},
        ]}
    ]
    ilql_gen = ILQLDataGenerator()
    for chain in ilql_gen(raw_trajectories):
        ilql_data = chain.to_ilql_data()
        logger.info(f"Generated ILQL data:")
        for key, tensor in ilql_data.items():
            logger.info(f"  {key}: shape={tensor.shape}, dtype={tensor.dtype}")
