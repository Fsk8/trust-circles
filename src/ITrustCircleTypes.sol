// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITrustCircleTypes
 * @notice Tipos compartidos entre TrustCircle y TrustCircleFactory.
 *         Al tener el enum en un archivo independiente, ambos contratos
 *         lo importan directamente y el compilador lo resuelve sin ambigüedad.
 */
interface ITrustCircleTypes {
    /// @notice Niveles de confianza que determinan quórum y duración de votación.
    enum TrustLevel {
        High, // 50% quórum, 24 h
        Medium, // 67% quórum, 48 h
        Low // 80% quórum, 72 h

    }
}
