// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ReputationManager
 * @author Trust Circles Protocol — Aleph Hackathon
 * @notice Gestiona el sistema de reputación global del protocolo.
 *         Desacoplado de la Factory para reducir el tamaño del bytecode
 *         de ambos contratos y superar el límite Spurious Dragon (24 KB).
 *
 * AUTORIZACIÓN:
 *  Solo el owner (deployer/multisig) y la Factory registrada pueden
 *  modificar puntajes. Nadie más puede llamar increase/decrease.
 *
 * FLUJO:
 *  1. Se despliega ReputationManager.
 *  2. Se despliega TrustCircleFactory pasándole la dirección de este contrato.
 *  3. El owner llama setFactory(factoryAddress) para registrar quién puede escribir.
 *  4. Los círculos llaman a la Factory → Factory llama a este contrato.
 */
contract ReputationManager is Ownable {

    // ─────────────────────────────────────────────
    //  CONSTANTS
    // ─────────────────────────────────────────────

    uint256 public constant INITIAL_REPUTATION     = 100;
    uint256 public constant POINTS_PER_CONTRIBUTION = 10;
    uint256 public constant PENALTY_REJECTION       = 25;

    // ─────────────────────────────────────────────
    //  STATE
    // ─────────────────────────────────────────────

    /// @notice Dirección de la Factory autorizada a escribir reputación.
    address public factory;

    /// @notice Puntaje de reputación por usuario. 0 = no inicializado.
    mapping(address => uint256) public score;

    /// @notice Indica si un usuario ya fue inicializado (para distinguir 0 real de sin init).
    mapping(address => bool) private _initialized;

    // ─────────────────────────────────────────────
    //  EVENTS
    // ─────────────────────────────────────────────

    event FactorySet(address indexed oldFactory, address indexed newFactory);
    event ReputationIncreased(address indexed user, uint256 delta, uint256 newScore);
    event ReputationDecreased(address indexed user, uint256 delta, uint256 newScore);

    // ─────────────────────────────────────────────
    //  MODIFIERS
    // ─────────────────────────────────────────────

    /**
     * @dev Solo la Factory registrada o el owner pueden modificar reputación.
     *      El owner se reserva para correcciones de emergencia y tests.
     */
    modifier onlyAuthorized() {
        require(
            msg.sender == factory || msg.sender == owner(),
            "RepMgr: not authorized"
        );
        _;
    }

    // ─────────────────────────────────────────────
    //  CONSTRUCTOR
    // ─────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─────────────────────────────────────────────
    //  ADMIN
    // ─────────────────────────────────────────────

    /**
     * @notice Registra la Factory que puede escribir reputación.
     *         Puede llamarse una segunda vez para migrar a una nueva Factory.
     * @param _factory Nueva dirección de la Factory.
     */
    function setFactory(address _factory) external onlyOwner {
        require(_factory != address(0), "RepMgr: zero address");
        emit FactorySet(factory, _factory);
        factory = _factory;
    }

    /**
     * @notice Corrección manual de reputación. Solo owner.
     *         Uso: resolución de disputas off-chain o correcciones post-bug.
     */
    function adminSetScore(address user, uint256 newScore) external onlyOwner {
        _init(user);
        score[user] = newScore;
    }

    // ─────────────────────────────────────────────
    //  WRITE — llamadas desde la Factory
    // ─────────────────────────────────────────────

    /**
     * @notice Incrementa la reputación de un usuario en POINTS_PER_CONTRIBUTION.
     *         Llamado por la Factory cuando un miembro contribuye a un círculo.
     * @param user Dirección del contribuyente.
     */
    function increase(address user) external onlyAuthorized {
        _init(user);
        score[user] += POINTS_PER_CONTRIBUTION;
        emit ReputationIncreased(user, POINTS_PER_CONTRIBUTION, score[user]);
    }

    /**
     * @notice Decrementa la reputación de un usuario en PENALTY_REJECTION.
     *         Nunca baja de 0 (protección contra underflow).
     *         Llamado por la Factory cuando la solicitud de un usuario es rechazada.
     * @param user Dirección del solicitante penalizado.
     */
    function decrease(address user) external onlyAuthorized {
        _init(user);
        uint256 current = score[user];
        uint256 penalty = PENALTY_REJECTION;

        if (current <= penalty) {
            score[user] = 0;
            emit ReputationDecreased(user, current, 0);
        } else {
            score[user] = current - penalty;
            emit ReputationDecreased(user, penalty, score[user]);
        }
    }

    // ─────────────────────────────────────────────
    //  READ
    // ─────────────────────────────────────────────

    /**
     * @notice Retorna la reputación de un usuario.
     *         Usuarios no inicializados retornan INITIAL_REPUTATION.
     * @param user Dirección a consultar.
     */
    function getScore(address user) external view returns (uint256) {
        return _initialized[user] ? score[user] : INITIAL_REPUTATION;
    }

    // ─────────────────────────────────────────────
    //  INTERNAL
    // ─────────────────────────────────────────────

    /// @dev Inicializa el puntaje en INITIAL_REPUTATION la primera vez que se toca.
    function _init(address user) internal {
        if (!_initialized[user]) {
            _initialized[user] = true;
            score[user]        = INITIAL_REPUTATION;
        }
    }
}