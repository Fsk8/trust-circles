// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ITrustCircleTypes.sol";
import "./TrustCircle.sol";

/**
 * @title TrustCircleFactory
 * @author Trust Circles Protocol — Aleph Hackathon
 * @notice Contrato central que despliega y registra instancias de TrustCircle.
 *         Mantiene el sistema de reputación global de todos los usuarios del protocolo.
 *
 * ARQUITECTURA:
 *  ┌──────────────────────────────────────┐
 *  │         TrustCircleFactory           │  ← Despliega círculos, gestiona reputación global
 *  │  - reputationScore[]                 │     y es el único autorizado para pausar/recuperar
 *  │  - circleRegistry[]                  │     administradores de los círculos hijos.
 *  └────────────────┬─────────────────────┘
 *                   │ deploy
 *         ┌─────────┴──────────┐
 *         ▼                    ▼
 *    TrustCircle          TrustCircle   ← Cada círculo es independiente
 *    (AVAX pool)          (USDC pool)
 *
 * KILL SWITCH FLOW:
 *  Factory.pauseCircle(addr)  →  TrustCircle.pause()   (detiene operaciones)
 *  Factory.unpauseCircle(addr)→  TrustCircle.unpause() (reanuda operaciones)
 *  Factory.initiateAdminRecovery(circle, newAdmin)      (propone nuevo admin)
 *  → Miembros votan en TrustCircle.voteAdminRecovery()
 *  → Cualquier miembro llama TrustCircle.executeAdminRecovery()
 *
 * SEGURIDAD:
 *  - Solo los círculos registrados pueden actualizar reputación (onlyRegisteredCircle).
 *  - Reputación mínima = 0 (nunca underflow).
 *  - Ownable para funciones administrativas de emergencia.
 */
contract TrustCircleFactory is Ownable, ReentrancyGuard, ITrustCircleTypes {

    // ─────────────────────────────────────────────
    //  CONSTANTS
    // ─────────────────────────────────────────────

    /// @notice Puntos de reputación otorgados por cada contribución.
    uint256 public constant REPUTATION_PER_CONTRIBUTION = 10;

    /// @notice Penalización de reputación cuando una solicitud es rechazada.
    uint256 public constant REPUTATION_PENALTY_REJECTION = 25;

    /// @notice Reputación inicial de un usuario nuevo (neutral).
    uint256 public constant INITIAL_REPUTATION = 100;

    // ─────────────────────────────────────────────
    //  STATE
    // ─────────────────────────────────────────────

    /**
     * @notice Puntaje de reputación global por dirección.
     *         Aumenta al contribuir a cualquier círculo.
     *         Disminuye si una solicitud de ese usuario es rechazada por fraude.
     *         Se inicializa en INITIAL_REPUTATION la primera vez que se usa.
     */
    mapping(address => uint256) public reputationScore;

    /// @notice Mapeo para saber si una dirección tiene reputación inicializada.
    mapping(address => bool) private _hasReputation;

    /// @notice Registro de todos los círculos desplegados por esta Factory.
    address[] public circles;

    /// @notice Indica si una dirección es un círculo registrado en esta Factory.
    mapping(address => bool) public isRegisteredCircle;

    /// @notice Metadatos de cada círculo desplegado.
    struct CircleInfo {
        address circleAddress;
        address admin;
        string  name;
        bool    isNative;
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
        string  name,
        bool    isNative,
        address tokenAddress,
        TrustLevel trustLevel
    );

    event ReputationIncreased(address indexed user, uint256 delta, uint256 newScore);
    event ReputationDecreased(address indexed user, uint256 delta, uint256 newScore);

    // Kill Switch events
    event CirclePausedByFactory(address indexed circleAddress, address indexed triggeredBy);
    event CircleUnpausedByFactory(address indexed circleAddress, address indexed triggeredBy);
    event AdminRecoveryInitiated(address indexed circleAddress, address indexed proposed);

    // ─────────────────────────────────────────────
    //  MODIFIERS
    // ─────────────────────────────────────────────

    /**
     * @dev Garantiza que solo los círculos desplegados por esta Factory
     *      puedan actualizar el sistema de reputación.
     *      Previene que contratos externos manipulen los puntajes.
     */
    modifier onlyRegisteredCircle() {
        require(isRegisteredCircle[msg.sender], "Factory: caller not a registered circle");
        _;
    }

    // ─────────────────────────────────────────────
    //  CONSTRUCTOR
    // ─────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─────────────────────────────────────────────
    //  CIRCLE CREATION
    // ─────────────────────────────────────────────

    /**
     * @notice Despliega un nuevo TrustCircle y lo registra en la Factory.
     *
     * @param name             Nombre descriptivo del círculo.
     * @param isNative         true = pozo en AVAX nativo; false = pozo en ERC20 (USDC).
     * @param tokenAddress     Dirección del token ERC20. Debe ser address(0) si isNative = true.
     * @param trustLevel       Nivel de confianza: High / Medium / Low.
     * @param initialMembers   Lista opcional de miembros a agregar además del admin.
     * @param minContribution  Monto mínimo de depósito para contar como contribución válida.
     *                         Ej: 1_000_000 para 1 USDC (6 decimales), 1e16 para 0.01 AVAX.
     *
     * @return circleAddress Dirección del nuevo TrustCircle desplegado.
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
        require(minContribution > 0, "Factory: minContribution must be > 0");

        if (isNative) {
            require(tokenAddress == address(0), "Factory: set token to zero for AVAX pool");
        } else {
            require(tokenAddress != address(0), "Factory: token required for ERC20 pool");
            // Verificación básica: el token debe tener código desplegado
            uint256 size;
            assembly { size := extcodesize(tokenAddress) }
            require(size > 0, "Factory: token not a contract");
        }

        // Desplegar nueva instancia de TrustCircle
        TrustCircle circle = new TrustCircle(
            msg.sender,      // admin = creador del círculo
            address(this),   // factory = este contrato
            isNative,
            tokenAddress,
            trustLevel,
            name,
            minContribution
        );

        circleAddress = address(circle);

        // Registrar en la Factory
        isRegisteredCircle[circleAddress] = true;
        circles.push(circleAddress);

        circleInfo[circleAddress] = CircleInfo({
            circleAddress: circleAddress,
            admin:         msg.sender,
            name:          name,
            isNative:      isNative,
            tokenAddress:  tokenAddress,
            trustLevel:    trustLevel,
            createdAt:     block.timestamp
        });

        // Inicializar reputación del creador si es la primera vez
        _initReputation(msg.sender);

        // Agregar miembros iniciales (el admin ya fue agregado en el constructor)
        for (uint256 i = 0; i < initialMembers.length; i++) {
            address member = initialMembers[i];
            if (member != address(0) && member != msg.sender) {
                circle.addMember(member);
                _initReputation(member);
            }
        }

        emit CircleCreated(
            circleAddress,
            msg.sender,
            name,
            isNative,
            tokenAddress,
            trustLevel
        );
    }

    // ─────────────────────────────────────────────
    //  REPUTATION CALLBACKS (llamados por TrustCircle)
    // ─────────────────────────────────────────────

    /**
     * @notice Incrementa la reputación de un usuario cuando contribuye al pozo.
     *         Solo puede ser llamado por un círculo registrado.
     *
     * @param contributor Dirección del miembro que contribuyó.
     * @param amount      Monto contribuido (no usado en la fórmula básica, disponible para extensión).
     */
    function onContribution(address contributor, uint256 amount) external onlyRegisteredCircle {
        // Silenciar warning de variable no utilizada (disponible para lógica futura)
        amount;

        _initReputation(contributor);
        reputationScore[contributor] += REPUTATION_PER_CONTRIBUTION;

        emit ReputationIncreased(
            contributor,
            REPUTATION_PER_CONTRIBUTION,
            reputationScore[contributor]
        );
    }

    /**
     * @notice Penaliza la reputación de un usuario cuando su solicitud fue rechazada.
     *         Solo puede ser llamado por un círculo registrado.
     *
     * NOTA: La reputación nunca baja de 0 para evitar underflow.
     *
     * @param requester Dirección del usuario cuya solicitud fue rechazada.
     */
    function onRequestRejected(address requester) external onlyRegisteredCircle {
        _initReputation(requester);

        uint256 currentScore = reputationScore[requester];
        uint256 penalty      = REPUTATION_PENALTY_REJECTION;

        // Protección contra underflow: reputación mínima = 0
        if (currentScore <= penalty) {
            reputationScore[requester] = 0;
            emit ReputationDecreased(requester, currentScore, 0);
        } else {
            reputationScore[requester] = currentScore - penalty;
            emit ReputationDecreased(requester, penalty, reputationScore[requester]);
        }
    }

    // ─────────────────────────────────────────────
    //  VIEWS
    // ─────────────────────────────────────────────

    /// @notice Retorna el número total de círculos creados.
    function circleCount() external view returns (uint256) {
        return circles.length;
    }

    /// @notice Retorna todos los círculos desplegados.
    function getAllCircles() external view returns (address[] memory) {
        return circles;
    }

    /**
     * @notice Retorna la reputación de un usuario.
     *         Si nunca ha interactuado, retorna INITIAL_REPUTATION.
     */
    function getReputation(address user) external view returns (uint256) {
        if (!_hasReputation[user]) {
            return INITIAL_REPUTATION;
        }
        return reputationScore[user];
    }

    /**
     * @notice Retorna los círculos donde un usuario es admin.
     *         Útil para frontends que necesitan listar "mis círculos".
     */
    function getCirclesByAdmin(address admin) external view returns (address[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < circles.length; i++) {
            if (circleInfo[circles[i]].admin == admin) count++;
        }

        address[] memory result = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < circles.length; i++) {
            if (circleInfo[circles[i]].admin == admin) {
                result[idx++] = circles[i];
            }
        }
        return result;
    }

    // ─────────────────────────────────────────────
    //  INTERNAL
    // ─────────────────────────────────────────────

    /// @dev Inicializa la reputación de un usuario en INITIAL_REPUTATION si es nuevo.
    function _initReputation(address user) internal {
        if (!_hasReputation[user]) {
            _hasReputation[user]  = true;
            reputationScore[user] = INITIAL_REPUTATION;
        }
    }

    // ─────────────────────────────────────────────
    //  KILL SWITCH — control de emergencia por Factory
    // ─────────────────────────────────────────────

    /**
     * @notice Pausa un círculo ante comportamiento anómalo o disputa activa.
     *         Solo el owner de la Factory puede ejecutar esto.
     *         Permite tiempo para investigar sin que se muevan fondos nuevos.
     *
     * @param circleAddress Dirección del TrustCircle a pausar.
     */
    function pauseCircle(address circleAddress) external onlyOwner {
        require(isRegisteredCircle[circleAddress], "Factory: not a registered circle");
        TrustCircle(payable(circleAddress)).pause();
        emit CirclePausedByFactory(circleAddress, msg.sender);
    }

    /**
     * @notice Reanuda un círculo previamente pausado.
     * @param circleAddress Dirección del TrustCircle a reanudar.
     */
    function unpauseCircle(address circleAddress) external onlyOwner {
        require(isRegisteredCircle[circleAddress], "Factory: not a registered circle");
        TrustCircle(payable(circleAddress)).unpause();
        emit CircleUnpausedByFactory(circleAddress, msg.sender);
    }

    /**
     * @notice Inicia el proceso de recuperación de admin para un círculo.
     *         Útil cuando el admin original perdió acceso a su wallet.
     *
     * PROCESO DE RECUPERACIÓN:
     *  1. El owner de la Factory verifica la identidad del nuevo admin off-chain.
     *  2. Llama a initiateAdminRecovery() con el nuevo admin propuesto.
     *  3. Los miembros del círculo votan durante 72 h en TrustCircle.voteAdminRecovery().
     *  4. Cualquier miembro ejecuta TrustCircle.executeAdminRecovery() para completar.
     *
     * Este flujo garantiza que la Factory no puede reemplazar un admin
     * de forma unilateral — siempre requiere el consentimiento de la comunidad.
     *
     * @param circleAddress Dirección del TrustCircle afectado.
     * @param newAdmin      Nuevo admin propuesto (debe ser miembro del círculo).
     */
    function initiateAdminRecovery(
        address circleAddress,
        address newAdmin
    ) external onlyOwner {
        require(isRegisteredCircle[circleAddress], "Factory: not a registered circle");
        TrustCircle(payable(circleAddress)).proposeAdminRecovery(newAdmin);
        emit AdminRecoveryInitiated(circleAddress, newAdmin);
    }

    // ─────────────────────────────────────────────
    //  ADMIN (owner) — funciones de emergencia
    // ─────────────────────────────────────────────

    /**
     * @notice Permite al owner corregir manualmente la reputación de un usuario.
     *         Uso: resolución de disputas off-chain o correcciones por bugs.
     * @param user     Dirección afectada.
     * @param newScore Nuevo valor de reputación.
     */
    function adminSetReputation(address user, uint256 newScore) external onlyOwner {
        _initReputation(user);
        reputationScore[user] = newScore;
    }
}