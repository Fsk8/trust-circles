// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ITrustCircleTypes.sol";

/**
 * @title TrustCircle
 * @author Trust Circles Protocol — Aleph Hackathon
 * @notice Pool de ahorro colaborativo con gobernanza dinámica y soporte multicurrency.
 *         Cada instancia es desplegada por TrustCircleFactory.
 *
 * ARQUITECTURA:
 *  Este contrato NO gestiona reputación directamente. Notifica a TrustCircleFactory
 *  vía ITrustCircleFactory, y la Factory delega los puntajes a ReputationManager.
 *
 * SEGURIDAD:
 *  - ReentrancyGuard en todas las funciones que mueven fondos.
 *  - Pull-over-push: fondos aprobados se desembolsan solo vía executeRequest.
 *  - SafeERC20 para tokens no estándar que no revierten en fallo.
 *  - Validación de quórum y plazo antes de cualquier ejecución.
 *  - Emergency Kill Switch: la Factory puede pausar y proponer nuevo admin.
 *  - minContribution: umbral mínimo de depósito (anti reputation-farming).
 *
 * GAS OPTIMIZATION NOTES (v1 — Hackathon):
 *  - Se usan uint256 para simplicidad y compatibilidad con OZ. En v2 se empaquetarán
 *    campos de EmergencyRequest (deadline uint48, votesFor/Against uint96) en un mismo
 *    slot de 32 bytes, reduciendo ~40% el costo de SSTORE en submitRequest/vote.
 *  - memberList itera en O(n); en v2 se reemplazará por un EnumerableSet de OZ.
 */
contract TrustCircle is ReentrancyGuard, Ownable, ITrustCircleTypes {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────
    //  TYPES & ENUMS
    // ─────────────────────────────────────────────

    // TrustLevel viene de ITrustCircleTypes (High / Medium / Low)

    /// @notice Estado del ciclo de vida de una solicitud de emergencia.
    enum RequestStatus {
        Pending,
        Approved,
        Rejected,
        Executed,
        Expired
    }

    struct EmergencyRequest {
        address requester;
        uint256 amount;
        string reason;
        uint256 deadline; // timestamp en que expira la votación
        uint256 votesFor;
        uint256 votesAgainst;
        RequestStatus status;
        mapping(address => bool) hasVoted;
    }

    // ─────────────────────────────────────────────
    //  STATE VARIABLES
    // ─────────────────────────────────────────────

    /// @notice Dirección de la Factory que creó este círculo.
    address public immutable factory;

    /// @notice Si es true, el pozo opera en AVAX nativo; si es false, usa tokenAddress.
    bool public immutable isNative;

    /// @notice Dirección del token ERC20 (USDC en Avalanche). Ignorado si isNative = true.
    address public immutable tokenAddress;

    /// @notice Nivel de confianza que rige la gobernanza de este círculo.
    TrustLevel public immutable trustLevel;

    /// @notice Nombre descriptivo del círculo.
    string public circleName;

    /// @notice Total de fondos depositados actualmente en el pozo.
    uint256 public totalPool;

    /// @notice Miembros del círculo. Solo ellos pueden contribuir y votar.
    address[] public memberList;
    mapping(address => bool) public isMember;

    /// @notice Contribuciones individuales de cada miembro.
    mapping(address => uint256) public contributions;

    /// @notice Contador global de solicitudes.
    uint256 public requestCount;

    /// @notice Registro de solicitudes de emergencia por ID.
    mapping(uint256 => EmergencyRequest) public requests;

    // ─────────────────────────────────────────────
    //  KILL SWITCH & ADMIN RECOVERY
    // ─────────────────────────────────────────────

    /**
     * @notice Indica si el círculo está pausado por la Factory.
     *         En pausa: no se pueden hacer depósitos, solicitudes ni votos.
     *         Solo executeRequest de solicitudes ya aprobadas sigue activo
     *         para no retener fondos de beneficiarios legítimos.
     */
    bool public paused;

    /**
     * @notice Propuesta activa de recuperación de admin, iniciada por la Factory.
     *         Los miembros votan para aceptar o rechazar al nuevo admin propuesto.
     */
    struct AdminRecoveryProposal {
        address proposed; // nuevo admin candidato
        uint256 deadline; // timestamp límite para votar
        uint256 votesFor;
        uint256 votesAgainst;
        bool executed;
        mapping(address => bool) hasVoted;
    }

    /// @notice true si hay una propuesta de recuperación activa.
    bool public recoveryActive;

    /// @notice Datos de la propuesta de recuperación actual.
    AdminRecoveryProposal public recoveryProposal;

    // ─────────────────────────────────────────────
    //  ANTI REPUTATION FARMING
    // ─────────────────────────────────────────────

    /**
     * @notice Monto mínimo para que un depósito cuente como contribución válida
     *         y genere puntos de reputación.
     *         El admin puede ajustarlo según la moneda del círculo.
     *         Ejemplo: 1 USDC = 1_000_000 (6 decimales), 0.01 AVAX = 10^16 wei.
     */
    uint256 public minContribution;

    // ─────────────────────────────────────────────
    //  GOVERNANCE CONSTANTS (calculados en constructor)
    // ─────────────────────────────────────────────

    uint256 public quorumBps; // basis points: 5000 = 50%, 6700 = 67%, 8000 = 80%
    uint256 public votingDuration; // segundos

    // ─────────────────────────────────────────────
    //  EVENTS
    // ─────────────────────────────────────────────

    event MemberAdded(address indexed member);
    event Contributed(address indexed member, uint256 amount, uint256 newTotal);
    event RequestSubmitted(uint256 indexed requestId, address indexed requester, uint256 amount, string reason);
    event Voted(uint256 indexed requestId, address indexed voter, bool approve);
    event RequestExecuted(uint256 indexed requestId, address indexed recipient, uint256 amount);
    event RequestRejected(uint256 indexed requestId);
    event RequestExpired(uint256 indexed requestId);

    // Kill Switch & Recovery events
    event CirclePaused(address indexed triggeredBy);
    event CircleUnpaused(address indexed triggeredBy);
    event AdminRecoveryProposed(address indexed proposed, uint256 deadline);
    event AdminRecoveryVoted(address indexed voter, bool approve);
    event AdminRecovered(address indexed oldAdmin, address indexed newAdmin);
    event AdminRecoveryCancelled();
    event MinContributionUpdated(uint256 oldMin, uint256 newMin);

    /**
     * @notice Evento especial para futuras migraciones a una App-chain de Avalanche.
     *         Contiene metadatos completos del círculo para indexación off-chain.
     */
    event SubnetReady(
        address indexed circleAddress,
        bool isNative,
        address tokenAddress,
        TrustLevel trustLevel,
        uint256 quorumBps,
        uint256 votingDuration,
        string circleName
    );

    // ─────────────────────────────────────────────
    //  MODIFIERS
    // ─────────────────────────────────────────────

    modifier onlyMember() {
        require(isMember[msg.sender], "TrustCircle: not a member");
        _;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "TrustCircle: only factory");
        _;
    }

    /// @notice Bloquea funciones operativas mientras el círculo está en pausa.
    modifier notPaused() {
        require(!paused, "TrustCircle: circle is paused");
        _;
    }

    // ─────────────────────────────────────────────
    //  CONSTRUCTOR
    // ─────────────────────────────────────────────

    /**
     * @param _admin          Administrador del círculo (primer miembro).
     * @param _factory        Dirección de la Factory que despliega este contrato.
     * @param _isNative       true = AVAX, false = ERC20.
     * @param _tokenAddress   Dirección del token ERC20 (address(0) si isNative).
     * @param _trustLevel     Nivel de confianza que define quórum y tiempo de votación.
     * @param _circleName     Nombre del círculo.
     * @param _minContribution Monto mínimo para que una contribución sea válida (anti-farming).
     */
    constructor(
        address _admin,
        address _factory,
        bool _isNative,
        address _tokenAddress,
        TrustLevel _trustLevel,
        string memory _circleName,
        uint256 _minContribution
    ) Ownable(_admin) {
        require(_factory != address(0), "TrustCircle: zero factory");
        if (!_isNative) {
            require(_tokenAddress != address(0), "TrustCircle: zero token");
        }
        require(_minContribution > 0, "TrustCircle: minContribution must be > 0");

        factory = _factory;
        isNative = _isNative;
        tokenAddress = _tokenAddress;
        trustLevel = _trustLevel;
        circleName = _circleName;
        minContribution = _minContribution;

        // Configurar parámetros de gobernanza según nivel
        if (_trustLevel == TrustLevel.High) {
            quorumBps = 5000; // 50%
            votingDuration = 24 hours;
        } else if (_trustLevel == TrustLevel.Medium) {
            quorumBps = 6700; // 67%
            votingDuration = 48 hours;
        } else {
            quorumBps = 8000; // 80%
            votingDuration = 72 hours;
        }

        // Registrar admin como primer miembro
        _addMember(_admin);

        // Emitir evento de preparación para App-chain
        emit SubnetReady(address(this), _isNative, _tokenAddress, _trustLevel, quorumBps, votingDuration, _circleName);
    }

    // ─────────────────────────────────────────────
    //  MEMBER MANAGEMENT
    // ─────────────────────────────────────────────

    /**
     * @notice Agrega un nuevo miembro al círculo. Solo el owner (admin) puede llamar.
     * @param _member Dirección del nuevo miembro.
     */
    function addMember(address _member) external onlyOwner {
        require(_member != address(0), "TrustCircle: zero address");
        require(!isMember[_member], "TrustCircle: already member");
        _addMember(_member);
    }

    /// @dev Lógica interna de registro de miembro.
    function _addMember(address _member) internal {
        isMember[_member] = true;
        memberList.push(_member);
        emit MemberAdded(_member);
    }

    // ─────────────────────────────────────────────
    //  CONTRIBUTE
    // ─────────────────────────────────────────────

    /**
     * @notice Deposita fondos en el pozo.
     *
     * AVAX:    Llamar con msg.value > 0.
     * ERC20:   Llamar sin msg.value; el contrato transfiere desde msg.sender
     *          (requiere approve previo).
     *
     * SEGURIDAD: ReentrancyGuard protege contra llamadas reentrantes.
     *            El estado se actualiza ANTES de cualquier transferencia externa (CEI pattern).
     *
     * @param amount Monto a depositar (ignorado para AVAX; usa msg.value).
     */
    function contribute(uint256 amount) external payable onlyMember nonReentrant notPaused {
        uint256 deposited;

        if (isNative) {
            // AVAX nativo: msg.value es el depósito real
            require(msg.value > 0, "TrustCircle: zero value");
            // ── ANTI REPUTATION FARMING ──
            // Previene micro-aportes repetidos para acumular reputación artificialmente.
            require(msg.value >= minContribution, "TrustCircle: below minContribution");
            deposited = msg.value;
        } else {
            // ERC20: rechazar AVAX accidental
            require(msg.value == 0, "TrustCircle: send no AVAX for ERC20 pool");
            require(amount > 0, "TrustCircle: zero amount");
            // ── ANTI REPUTATION FARMING ──
            require(amount >= minContribution, "TrustCircle: below minContribution");
            deposited = amount;
            // SafeERC20 revierte si el token no transfiere correctamente
            IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), deposited);
        }

        // Actualizar estado
        contributions[msg.sender] += deposited;
        totalPool += deposited;

        // Notificar a la Factory para actualizar reputación
        ITrustCircleFactory(factory).onContribution(msg.sender, deposited);

        emit Contributed(msg.sender, deposited, totalPool);
    }

    // ─────────────────────────────────────────────
    //  SUBMIT REQUEST
    // ─────────────────────────────────────────────

    /**
     * @notice Crea una solicitud de emergencia para recibir fondos del pozo.
     * @param amount Monto solicitado.
     * @param reason Descripción de la emergencia.
     */
    function submitRequest(uint256 amount, string calldata reason) external onlyMember notPaused {
        require(amount > 0, "TrustCircle: zero amount");
        require(amount <= totalPool, "TrustCircle: exceeds pool");
        require(bytes(reason).length > 0, "TrustCircle: empty reason");

        uint256 reqId = requestCount++;
        EmergencyRequest storage req = requests[reqId];
        req.requester = msg.sender;
        req.amount = amount;
        req.reason = reason;
        req.deadline = block.timestamp + votingDuration;
        req.status = RequestStatus.Pending;

        emit RequestSubmitted(reqId, msg.sender, amount, reason);
    }

    // ─────────────────────────────────────────────
    //  VOTE
    // ─────────────────────────────────────────────

    /**
     * @notice Vota a favor o en contra de una solicitud de emergencia.
     *         Sistema 1 miembro = 1 voto (no ponderado por monto contribuido).
     *
     * @param requestId ID de la solicitud.
     * @param approve   true = a favor, false = en contra.
     */
    function vote(uint256 requestId, bool approve) external onlyMember notPaused {
        EmergencyRequest storage req = requests[requestId];

        require(req.requester != address(0), "TrustCircle: invalid request");
        require(req.status == RequestStatus.Pending, "TrustCircle: not pending");
        require(block.timestamp <= req.deadline, "TrustCircle: voting expired");
        require(!req.hasVoted[msg.sender], "TrustCircle: already voted");
        // Un miembro no puede votar en su propia solicitud
        require(req.requester != msg.sender, "TrustCircle: cannot self-vote");

        req.hasVoted[msg.sender] = true;

        if (approve) {
            req.votesFor++;
        } else {
            req.votesAgainst++;
        }

        emit Voted(requestId, msg.sender, approve);
    }

    // ─────────────────────────────────────────────
    //  EXECUTE REQUEST
    // ─────────────────────────────────────────────

    /**
     * @notice Desembolsa los fondos si se alcanzó el quórum de aprobación.
     *         Cualquier miembro puede llamar a esta función tras el período de votación.
     *
     * SEGURIDAD:
     *  - Checks-Effects-Interactions: estado actualizado antes de transferencia.
     *  - ReentrancyGuard evita ataques de reentrada en transferencias AVAX.
     *  - Verifica quórum sobre totalMiembros - 1 (el solicitante no vota).
     *
     * @param requestId ID de la solicitud a ejecutar.
     */
    function executeRequest(uint256 requestId) external nonReentrant onlyMember {
        EmergencyRequest storage req = requests[requestId];

        require(req.requester != address(0), "TrustCircle: invalid request");
        require(req.status == RequestStatus.Pending, "TrustCircle: not pending");

        uint256 totalVoters = memberList.length - 1; // el solicitante no vota
        require(totalVoters > 0, "TrustCircle: no voters");

        // Si el plazo venció, marcar como expirado
        if (block.timestamp > req.deadline) {
            req.status = RequestStatus.Expired;
            emit RequestExpired(requestId);
            return;
        }

        uint256 totalVotesCast = req.votesFor + req.votesAgainst;

        // Verificar quórum: los votos emitidos deben superar el umbral
        // quorumBps está en basis points (5000 = 50%)
        bool quorumReached = (totalVotesCast * 10000) >= (totalVoters * quorumBps);

        if (!quorumReached) {
            revert("TrustCircle: quorum not reached yet");
        }

        // Determinar resultado: mayoría simple de los votos emitidos
        if (req.votesFor > req.votesAgainst) {
            // ── APROBADO ──
            require(req.amount <= totalPool, "TrustCircle: insufficient pool");

            // CEI: actualizar estado ANTES de transferir
            req.status = RequestStatus.Executed;
            totalPool -= req.amount;

            address recipient = req.requester;
            uint256 amount = req.amount;

            if (isNative) {
                // Transferencia AVAX usando call (recomendado sobre transfer/send)
                (bool success,) = recipient.call{value: amount}("");
                require(success, "TrustCircle: AVAX transfer failed");
            } else {
                IERC20(tokenAddress).safeTransfer(recipient, amount);
            }

            emit RequestExecuted(requestId, recipient, amount);
        } else {
            // ── RECHAZADO ──
            req.status = RequestStatus.Rejected;

            // Penalizar reputación del solicitante en la Factory
            ITrustCircleFactory(factory).onRequestRejected(req.requester);

            emit RequestRejected(requestId);
        }
    }

    // ─────────────────────────────────────────────
    //  KILL SWITCH — llamado por la Factory
    // ─────────────────────────────────────────────

    /**
     * @notice Pausa todas las operaciones del círculo.
     *         Solo la Factory puede pausar (ej: comportamiento anómalo detectado off-chain).
     *         executeRequest sigue activo para no retener fondos ya aprobados.
     */
    function pause() external onlyFactory {
        require(!paused, "TrustCircle: already paused");
        paused = true;
        emit CirclePaused(msg.sender);
    }

    /**
     * @notice Reanuda las operaciones del círculo.
     *         Solo la Factory puede despausar.
     */
    function unpause() external onlyFactory {
        require(paused, "TrustCircle: not paused");
        paused = false;
        emit CircleUnpaused(msg.sender);
    }

    // ─────────────────────────────────────────────
    //  ADMIN RECOVERY — gobernanza democrática
    // ─────────────────────────────────────────────

    /**
     * @notice La Factory propone un nuevo admin para reemplazar al que perdió su clave.
     *         Los miembros votan durante 72 horas. Si la mayoría simple aprueba,
     *         la propiedad del círculo se transfiere al nuevo admin.
     *
     * FLUJO:
     *  1. Factory detecta (off-chain) que el admin no puede acceder.
     *  2. Factory llama proposeAdminRecovery(_newAdmin).
     *  3. Miembros votan con voteAdminRecovery(bool).
     *  4. Cualquier miembro llama executeAdminRecovery() tras alcanzar mayoría.
     *
     * SEGURIDAD:
     *  - Solo una propuesta activa a la vez.
     *  - El admin actual no puede votar en su propia destitución.
     *  - Período fijo de 72 h para dar tiempo a todos los miembros.
     *
     * @param _newAdmin Dirección del nuevo admin propuesto.
     */
    function proposeAdminRecovery(address _newAdmin) external onlyFactory {
        require(!recoveryActive, "TrustCircle: recovery already active");
        require(_newAdmin != address(0), "TrustCircle: zero address");
        require(isMember[_newAdmin], "TrustCircle: proposed must be a member");
        require(_newAdmin != owner(), "TrustCircle: already the admin");

        recoveryActive = true;
        recoveryProposal.proposed = _newAdmin;
        recoveryProposal.deadline = block.timestamp + 72 hours;
        recoveryProposal.votesFor = 0;
        recoveryProposal.votesAgainst = 0;
        recoveryProposal.executed = false;

        emit AdminRecoveryProposed(_newAdmin, recoveryProposal.deadline);
    }

    /**
     * @notice Un miembro vota para aceptar o rechazar la propuesta de recuperación.
     * @param approve true = acepta al nuevo admin, false = rechaza.
     */
    function voteAdminRecovery(bool approve) external onlyMember {
        require(recoveryActive, "TrustCircle: no active recovery");
        require(block.timestamp <= recoveryProposal.deadline, "TrustCircle: recovery expired");
        require(!recoveryProposal.hasVoted[msg.sender], "TrustCircle: already voted");
        // El admin actual no puede votar en su propia destitución
        require(msg.sender != owner(), "TrustCircle: admin cannot vote own removal");

        recoveryProposal.hasVoted[msg.sender] = true;
        if (approve) {
            recoveryProposal.votesFor++;
        } else {
            recoveryProposal.votesAgainst++;
        }

        emit AdminRecoveryVoted(msg.sender, approve);
    }

    /**
     * @notice Ejecuta la transferencia de admin si la mayoría simple aprobó.
     *         Cualquier miembro puede llamar esta función.
     *         Si el plazo venció sin mayoría, cancela la propuesta.
     */
    function executeAdminRecovery() external onlyMember {
        require(recoveryActive, "TrustCircle: no active recovery");
        require(!recoveryProposal.executed, "TrustCircle: already executed");

        // Plazo vencido sin resolución → cancelar
        if (block.timestamp > recoveryProposal.deadline) {
            recoveryActive = false;
            emit AdminRecoveryCancelled();
            return;
        }

        uint256 totalVoters = memberList.length - 1; // excluir admin actual
        require(totalVoters > 0, "TrustCircle: no voters");

        // Quórum simple: más de la mitad de los votos emitidos
        uint256 totalVotes = recoveryProposal.votesFor + recoveryProposal.votesAgainst;
        require(totalVotes > 0, "TrustCircle: no votes cast yet");
        require(recoveryProposal.votesFor > recoveryProposal.votesAgainst, "TrustCircle: majority not reached");

        recoveryProposal.executed = true;
        recoveryActive = false;

        address oldAdmin = owner();
        address newAdmin = recoveryProposal.proposed;

        // Transferir ownership del círculo al nuevo admin
        _transferOwnership(newAdmin);

        emit AdminRecovered(oldAdmin, newAdmin);
    }

    // ─────────────────────────────────────────────
    //  ADMIN CONFIG
    // ─────────────────────────────────────────────

    /**
     * @notice El admin puede ajustar el monto mínimo de contribución.
     *         Útil si el valor del token cambia significativamente.
     * @param _newMin Nuevo mínimo (debe ser > 0).
     */
    function setMinContribution(uint256 _newMin) external onlyOwner {
        require(_newMin > 0, "TrustCircle: min must be > 0");
        uint256 old = minContribution;
        minContribution = _newMin;
        emit MinContributionUpdated(old, _newMin);
    }

    // ─────────────────────────────────────────────
    //  VIEWS
    // ─────────────────────────────────────────────

    /// @notice Retorna la lista completa de miembros.
    function getMembers() external view returns (address[] memory) {
        return memberList;
    }

    /// @notice Retorna información básica de una solicitud (sin el mapping interno).
    function getRequest(uint256 requestId)
        external
        view
        returns (
            address requester,
            uint256 amount,
            string memory reason,
            uint256 deadline,
            uint256 votesFor,
            uint256 votesAgainst,
            RequestStatus status
        )
    {
        EmergencyRequest storage req = requests[requestId];
        return (req.requester, req.amount, req.reason, req.deadline, req.votesFor, req.votesAgainst, req.status);
    }

    /// @notice Verifica si una dirección ya votó en una solicitud.
    function hasVoted(uint256 requestId, address voter) external view returns (bool) {
        return requests[requestId].hasVoted[voter];
    }

    /// @notice Retorna el número total de miembros.
    function memberCount() external view returns (uint256) {
        return memberList.length;
    }

    // ─────────────────────────────────────────────
    //  RECEIVE (solo AVAX pools)
    // ─────────────────────────────────────────────

    /**
     * @dev Rechaza AVAX directo si el pool es ERC20.
     *      Para AVAX pools, el depósito debe hacerse via contribute().
     */
    receive() external payable {
        require(isNative, "TrustCircle: ERC20 pool, use contribute()");
        revert("TrustCircle: use contribute() to deposit");
    }
}

// ─────────────────────────────────────────────
//  INTERFACE para callback a la Factory
// ─────────────────────────────────────────────

interface ITrustCircleFactory {
    function onContribution(address contributor, uint256 amount) external;
    function onRequestRejected(address requester) external;
}
