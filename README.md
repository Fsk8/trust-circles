# Trust Circles

**On-chain crowdlending and mutual insurance** — built for **Aleph Hackathon 2026**. Groups create shared capital pools for peer lending or mutual coverage, governed entirely by smart contracts on **Avalanche**.

---

## English

### Vision: trust-based credit and coverage

Traditional credit is often exclusive and slow. **Trust Circles** spreads risk across the group and lowers the barrier to capital in Web3:

- **Digital mutualism** — pools aligned around a shared goal or risk.
- **Reputation as signal** — successful cycles strengthen an on-chain **reputation score**, complementing how members assess trust.

### Demo and contracts

| Resource | Link |
| -------- | ---- |
| Live frontend | _After deploy, paste your Vercel URL here_ |
| Factory (Avalanche Fuji) | `0x5dFB63e77BE1346761Cd20fBa9c23551f3DE9A36` |
| Video demo | _Add your YouTube or Loom URL_ |

### Tech stack

| Layer | Details |
| ----- | ------- |
| Chain | Avalanche Fuji testnet |
| Contracts | Factory pattern; per-circle `TrustCircle.sol` instances |
| Frontend | Next.js (App Router), Tailwind CSS |
| Web3 | Wagmi v2, Viem, RainbowKit |

### How the protocol works

1. **Factory** — deploys parameterized circle contracts (e.g. minimum contribution).
2. **Governance tiers** — trust level adjusts quorum (e.g. 50%–80%) and voting windows.
3. **Execution** — funds move only after on-chain member approval.

### Local setup

**Requirements:** Node.js 18+, npm or pnpm, a wallet on **Avalanche Fuji**.

This repo is a **monorepo**. The dApp lives under `UI/trust-circles-fe`.

```bash
git clone https://github.com/<your-org>/trust-circles.git
cd trust-circles/UI/trust-circles-fe
npm install
```

Create `UI/trust-circles-fe/.env.local`:

```env
NEXT_PUBLIC_WC_PROJECT_ID=your_walletconnect_project_id
```

Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Vercel:** set the project **Root Directory** to `UI/trust-circles-fe` and add the same `NEXT_PUBLIC_*` env vars in the dashboard.

### End-to-end test flow (crowdlending)

1. With **Wallet A**, connect and create a new circle via the factory.
2. In a **private window**, connect **Wallet B** and **contribute** to the pool.
3. With **Wallet B**, create a **funds request**.
4. Back on **Wallet A**, vote in favor and **execute** once quorum is met.

### Technical notes

- **Hydration / Next.js** — wallet UI isolated on the client to avoid hydration mismatches (e.g. React #418) and keep connect flows stable.
- **Factory architecture** — each circle is its own contract for clear boundaries and safer upgrades per pool.

**Authors:** Favio Montealegre, Ingrid Orellana · Cochabamba, Bolivia  
**Event:** Aleph Hackathon 2026

---

## Español

### Visión: crédito y cobertura basados en confianza

El crédito tradicional suele ser excluyente y burocrático. **Trust Circles** reparte el riesgo en el grupo y acerca el capital en Web3:

- **Mutualismo digital** — grupos alineados con un riesgo o una meta común.
- **Reputación como señal** — cada ciclo exitoso refuerza un **reputation score** on-chain.

### Demo y contratos

| Recurso | Enlace |
| ------- | ------ |
| Frontend en producción | _Tras el deploy, pega aquí la URL de Vercel_ |
| Factory (Avalanche Fuji) | `0x5dFB63e77BE1346761Cd20fBa9c23551f3DE9A36` |
| Video demo | _Añade tu URL de YouTube o Loom_ |

### Stack tecnológico

| Capa | Detalle |
| ---- | ------- |
| Red | Avalanche Fuji (testnet) |
| Contratos | Patrón Factory; instancias `TrustCircle.sol` por círculo |
| Frontend | Next.js (App Router), Tailwind CSS |
| Web3 | Wagmi v2, Viem, RainbowKit |

### Lógica del protocolo

1. **Factory** — despliega contratos de círculo parametrizados (p. ej. aporte mínimo).
2. **Niveles de gobernanza** — el nivel de confianza ajusta quórum y ventanas de votación.
3. **Ejecución** — los fondos solo se mueven tras la aprobación on-chain de los miembros.

### Instalación local

**Requisitos:** Node.js 18+, npm o pnpm, wallet en **Avalanche Fuji**.

El repositorio es un **monorepo**. La dApp está en `UI/trust-circles-fe`.

```bash
git clone https://github.com/<tu-org>/trust-circles.git
cd trust-circles/UI/trust-circles-fe
npm install
```

Crea `UI/trust-circles-fe/.env.local`:

```env
NEXT_PUBLIC_WC_PROJECT_ID=tu_project_id_de_walletconnect
```

Arranca la aplicación:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

> **Vercel:** en el proyecto, define **Root Directory** como `UI/trust-circles-fe` y configura las mismas variables `NEXT_PUBLIC_*` en el panel.

### Guía de pruebas (flujo real)

1. Con la **wallet A**, conecta y crea un círculo nuevo con la factory.
2. En **ventana de incógnito**, conecta la **wallet B** y **contribuye** al pool.
3. Con la **wallet B**, crea una **solicitud de fondos**.
4. Vuelve a la **wallet A**, vota a favor y **ejecuta** cuando haya quórum.

### Notas técnicas

- **Hidratación / Next.js** — la UI de wallet aislada en el cliente para evitar desajustes de hidratación (p. ej. error #418) y mantener una UX estable.
- **Arquitectura factory** — cada círculo es un contrato propio para límites claros y despliegues más seguros por pool.

**Desarrollado por:** Favio Montealegre, Ingrid Orellana · Cochabamba, Bolivia  
**Hackathon:** Aleph 2026
