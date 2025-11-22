// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title FHEBandChoice - Encrypted Favorite Band Selector
/// @notice Users can privately choose the music band they love the most using Fully Homomorphic Encryption.
contract FHEBandChoice is ZamaEthereumConfig {
    mapping(address => euint32) private _encryptedChoices;
    mapping(address => bool) private _hasChosen;

    /// @notice Make your encrypted choice for your favorite band.
    /// @param inputEuint32 Encrypted band ID (1–6)
    /// @param inputProof FHE input proof
    function makeChoice(externalEuint32 inputEuint32, bytes calldata inputProof) external {
        require(!_hasChosen[msg.sender], "Already chosen");

        euint32 encryptedChoice = FHE.fromExternal(inputEuint32, inputProof);
        _encryptedChoices[msg.sender] = encryptedChoice;
        _hasChosen[msg.sender] = true;

        FHE.allowThis(encryptedChoice);
        FHE.allow(encryptedChoice, msg.sender);
    }

    /// @notice Change your previous encrypted choice.
    /// @param inputEuint32 New encrypted band ID
    /// @param inputProof FHE input proof
    function changeChoice(externalEuint32 inputEuint32, bytes calldata inputProof) external {
        require(_hasChosen[msg.sender], "No previous choice found");

        euint32 encryptedChoice = FHE.fromExternal(inputEuint32, inputProof);
        _encryptedChoices[msg.sender] = encryptedChoice;

        FHE.allowThis(encryptedChoice);
        FHE.allow(encryptedChoice, msg.sender);
    }

    /// @notice Retrieve your encrypted band choice.
    function viewMyChoice() external view returns (euint32) {
        return _encryptedChoices[msg.sender];
    }

    /// @notice Retrieve another user's encrypted band choice (still encrypted).
    function viewUserChoice(address user) external view returns (euint32) {
        return _encryptedChoices[user];
    }

    /// @notice Check whether a user has already made a choice.
    function hasChosen(address user) external view returns (bool) {
        return _hasChosen[user];
    }
}
