// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ITrustCircleTypes.sol";
import "./TrustCircle.sol";
import "./ReputationManager.sol";

/**
 * @title TrustCircleFactory
 * @author Trust Circles Protocol — Aleph Hackathon
 * @notice Despliega y registra instancias de TrustCircle.
 *         La lógica de reputación fue movida a ReputationManager
 *         para mantener el bytecode bajo el límite Spurious Dragon (24 KB).
 *
 * ARQUITECTURA DESACOPLADA:
 *
 *  ┌──────────────────────┐     setFactory()    ┌────────────────────┐
 *  │  TrustCircleFactory  │ ──────────────────► │  ReputationManager │
 *  │  - circleRegistry    │ ◄── increase/        │  - score[]         │
 *  │  - kill switch       │     decrease         │  - INITIAL_REP     │
 *  └──────────┬───────────┘                      └────────────────────┘
 *             │ deploy
 *     ┌───────┴────────┐
 *     ▼                ▼
 * TrustCircle      TrustCircle
 * (AVAX pool)      (USDC pool)
 *
 * ORDEN DE DESPLIEGUE:
 *  1. deploy ReputationManager
 *  2. deploy TrustCircleFactory(_reputationManager)
 *  3. ReputationManager.setFactory(factoryAddress)
 */
contract TrustCircleFactory is Ownable, ReentrancyGuard, ITrustCircleTypes {
    // ─────────────────────────────────────────────
    //  STATE
    // ─────────────────────────────────────────────

    /// @notice Contrato externo que gestiona toda la lógica de reputación.
    ReputationManager public immutable reputation;

    /// @notice Lista de todos los círculos desplegados por esta Factory.
    address[] public circles;

    /// @notice true si una dirección es un círculo registrado en esta Factory.
    mapping(address => bool) public isRegisteredCircle;

    /// @notice Metadatos de cada círculo desplegado.
    struct CircleInfo {
        address circleAddress;
        address admin;
        string name;
        bool isNative;
        address tokenAddress;
        TrustLevel trustLevel;
        uint256 createdAt;
    }

    mapping(address => CircleInfo) public circleInfo;

    // ─────────────────────────────────────────────
    //  EVENTS
    // ─────────────────────────────────────────────

    event CircleCreated(
        address indexed circleAddress,
        address indexed admin,
        string name,
        bool isNative,
        address tokenAddress,
        TrustLevel trustLevel
    );
    event CirclePausedByFactory(address indexed circle, address indexed by);
    event CircleUnpausedByFactory(address indexed circle, address indexed by);
    event AdminRecoveryInitiated(address indexed circle, address indexed proposed);

    // ─────────────────────────────────────────────
    //  MODIFIERS
    // ─────────────────────────────────────────────

    /// @dev Solo círculos desplegados por esta Factory pueden notificar callbacks.
    modifier onlyCircle() {
        require(isRegisteredCircle[msg.sender], "Factory: not a circle");
        _;
    }

    // ─────────────────────────────────────────────
    //  CONSTRUCTOR
    // ─────────────────────────────────────────────

    /**
     * @param _reputation Dirección del ReputationManager ya desplegado.
     */
    constructor(address _reputation) Ownable(msg.sender) {
        require(_reputation != address(0), "Factory: zero reputation");
        reputation = ReputationManager(_reputation);
    }

    // ─────────────────────────────────────────────
    //  CIRCLE CREATION
    // ─────────────────────────────────────────────

    /**
     * @notice Despliega un nuevo TrustCircle y lo registra.
     * @param name            Nombre del círculo.
     * @param isNative        true = AVAX, false = ERC20.
     * @param tokenAddress    Token ERC20 (address(0) si isNative).
     * @param trustLevel      High / Medium / Low.
     * @param initialMembers  Miembros adicionales al admin.
     * @param minContribution Mínimo de depósito para ser válido (anti-farming).
     * @return circleAddress  Dirección del nuevo TrustCircle.
     */
    function createCircle(
        string calldata name,
        bool isNative,
        address tokenAddress,
        TrustLevel trustLevel,
        address[] calldata initialMembers,
        uint256 minContribution
    ) external nonReentrant returns (address circleAddress) {
        require(bytes(name).length > 0, "Factory: empty name");
        require(minContribution > 0, "Factory: min=0");

        if (isNative) {
            require(tokenAddress == address(0), "Factory: token!=0 for AVAX");
        } else {
            require(tokenAddress != address(0), "Factory: token=0 for ERC20");
            uint256 sz;
            assembly {
                sz := extcodesize(tokenAddress)
            }
            require(sz > 0, "Factory: token not contract");
        }

        TrustCircle circle =
            new TrustCircle(msg.sender, address(this), isNative, tokenAddress, trustLevel, name, minContribution);

        circleAddress = address(circle);

        isRegisteredCircle[circleAddress] = true;
        circles.push(circleAddress);
        circleInfo[circleAddress] = CircleInfo({
            circleAddress: circleAddress,
            admin: msg.sender,
            name: name,
            isNative: isNative,
            tokenAddress: tokenAddress,
            trustLevel: trustLevel,
            createdAt: block.timestamp
        });

        for (uint256 i; i < initialMembers.length; ++i) {
            address m = initialMembers[i];
            if (m != address(0) && m != msg.sender) circle.addMember(m);
        }

        emit CircleCreated(circleAddress, msg.sender, name, isNative, tokenAddress, trustLevel);
    }

    // ─────────────────────────────────────────────
    //  REPUTATION CALLBACKS
    //  Llamados por TrustCircle; delegan al ReputationManager.
    // ─────────────────────────────────────────────

    /**
     * @notice Un círculo notifica que un miembro contribuyó → suma reputación.
     */
    function onContribution(address contributor, uint256 /*amount*/ ) external onlyCircle {
        reputation.increase(contributor);
    }

    /**
     * @notice Un círculo notifica que una solicitud fue rechazada → penaliza reputación.
     */
    function onRequestRejected(address requester) external onlyCircle {
        reputation.decrease(requester);
    }

    // ─────────────────────────────────────────────
    //  KILL SWITCH
    // ─────────────────────────────────────────────

    /// @notice Pausa un círculo registrado. Solo owner de Factory.
    function pauseCircle(address circle) external onlyOwner {
        require(isRegisteredCircle[circle], "Factory: not a circle");
        TrustCircle(payable(circle)).pause();
        emit CirclePausedByFactory(circle, msg.sender);
    }

    /// @notice Reanuda un círculo pausado. Solo owner de Factory.
    function unpauseCircle(address circle) external onlyOwner {
        require(isRegisteredCircle[circle], "Factory: not a circle");
        TrustCircle(payable(circle)).unpause();
        emit CircleUnpausedByFactory(circle, msg.sender);
    }

    /// @notice Inicia recuperación de admin en un círculo. Solo owner de Factory.
    function initiateAdminRecovery(address circle, address newAdmin) external onlyOwner {
        require(isRegisteredCircle[circle], "Factory: not a circle");
        TrustCircle(payable(circle)).proposeAdminRecovery(newAdmin);
        emit AdminRecoveryInitiated(circle, newAdmin);
    }

    // ─────────────────────────────────────────────
    //  VIEWS
    // ─────────────────────────────────────────────

    function circleCount() external view returns (uint256) {
        return circles.length;
    }

    function getAllCircles() external view returns (address[] memory) {
        return circles;
    }

    /// @notice Proxy de lectura: delega al ReputationManager.
    function getReputation(address user) external view returns (uint256) {
        return reputation.getScore(user);
    }

    function getCirclesByAdmin(address admin) external view returns (address[] memory) {
        uint256 count;
        for (uint256 i; i < circles.length; ++i) {
            if (circleInfo[circles[i]].admin == admin) ++count;
        }
        address[] memory result = new address[](count);
        uint256 idx;
        for (uint256 i; i < circles.length; ++i) {
            if (circleInfo[circles[i]].admin == admin) result[idx++] = circles[i];
        }
        return result;
    }
}
