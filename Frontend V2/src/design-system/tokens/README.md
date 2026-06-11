# Design System Tokens

Single source of truth para todos los colores, etiquetas y clases visuales del frontend. Cada archivo `*.colors.ts` define un dominio (salud, vacunación, ubicaciones, etc.) y exporta:

- **Mapas de constantes** (`*_COLORS`, `*_LABELS`, `*_BADGE_CLASSES`, ...).
- **Tipos** (`*Key`) — keyof del mapa, evitan typos en TS.
- **Helpers defensivos** (`get*Color`, `get*Label`, ...) — manejan `undefined`/`null` y keys desconocidos sin lanzar.

Importa desde el barrel:

```ts
import {
  HEALTH_COLORS, getHealthColor, getHealthBadgeVariant,
  getMovementReasonLabel, getServiceChipClasses,
} from '@/design-system/tokens';
```

---

## ⚠️ Distinción crítica: `SEVERITY` vs `PRIORITY`

Aunque visualmente parecen similares, son **conceptualmente opuestos**:

|                  | `SEVERITY` (severity.colors.ts) | `PRIORITY` (priority.colors.ts) |
|------------------|---------------------------------|--------------------------------|
| **Mirada**       | Pasado                          | Futuro                         |
| **Pregunta**     | ¿Qué tan grave **fue**?         | ¿Qué tan rápido **actuar**?    |
| **Modelo BE**    | `EventSeverity` (SecurityEvent) | `EventPriority` (Event)        |
| **Niveles**      | 4 (LOW/MEDIUM/HIGH/CRITICAL)    | 5 (+EMERGENCY)                 |
| **Caso típico**  | Auditoría de seguridad          | Cola de trabajo del veterinario |

### Por nivel

| Nivel | SEVERITY (qué tan grave fue) | PRIORITY (qué tan rápido actuar) |
|-------|------------------------------|----------------------------------|
| **LOW** | 🔵 Login exitoso, actividad rutinaria | 🟢 Pesaje rutinario, puede esperar semanas |
| **MEDIUM** | 🟡 Reset de contraseña, IP nueva | 🔵 Vacuna en 2 semanas, normal |
| **HIGH** | 🟠 Acceso no autorizado, múltiples logins fallidos | 🟡 Tratamiento en curso, esta semana |
| **CRITICAL** | 🔴 Cuenta bloqueada, token comprometido | 🔴 Chequeo urgente, hoy mismo |
| **EMERGENCY** | _(no existe — el pasado no puede empeorar)_ | 🟥 Parto en progreso, ahora |

### Regla mnemónica

> **SEVERITY mira hacia atrás. PRIORITY mira hacia adelante.**
> Si dudas, pregúntate: "¿esto ya pasó (Severity) o está por hacerse (Priority)?"

### ¿Por qué `EMERGENCY` solo en PRIORITY?

- En **seguridad**, el peor escenario es `CRITICAL` — ya pasó algo grave que exige investigar/contener. El tiempo dejó de correr; no hay "todavía más urgente".
- En **ganadería**, sí existen escenarios de tiempo crítico real — un parto con complicaciones o una cirugía **no pueden esperar**. `EMERGENCY` representa "interrumpe todo lo demás".

---

## Convenciones del design-system

### Nombres de tipos
Los tipos exportados usan el sufijo **`*Key`** para evitar colisión con enums del dominio (que tienen el mismo nombre semántico):

| Token export | Enum del dominio |
|--------------|------------------|
| `HealthStatusKey` | `HealthStatus` (de `types/bovine.dtos.ts`) |
| `LocationTypeKey` | `LocationType` (de `types/location.types.ts`) |
| `TreatmentStatusKey` | `TreatmentStatus` (de `types/health.types.ts`) |
| `VaccinationStatusKey` | `VaccinationStatus` (de `types/bovine.dtos.ts`) |
| `MovementReasonKey` | `MovementReason` (de `types/bovine.dtos.ts`) |

### Aliases semánticos
Cuando un token tiene un nombre canónico en el dominio del backend, se exporta también un alias para hacer explícito el binding:

| Alias | Equivale a | Cuándo usarlo |
|-------|-----------|----------------|
| `EventSeverityKey` | `SeverityKey` | Código de auditoría/seguridad |
| `EventPriorityKey` | `PriorityKey` | Código de eventos/agenda ganadera |

### Helpers defensivos
Todo helper sigue la firma:

```ts
function getXxx(input: string | undefined | null): string {
  if (!input) return FALLBACK;
  return MAP[input] ?? FALLBACK;
}
```

Esto elimina el boilerplate `MAP[key] ?? FALLBACK` en cada consumidor y previene crashes por valores legacy / desconocidos del backend.

### Iconos
Los iconos React (lucide-react) **NO viven** en el design-system — son markup. Quedan en los componentes que los consumen. El token gobierna **solo color, label y clase**.
