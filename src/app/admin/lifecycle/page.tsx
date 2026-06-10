import { Workflow } from "lucide-react";
import { LifecycleDiagram } from "@/components/admin/lifecycle/lifecycle-diagram";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRouteAccess } from "@/lib/auth/auth";
import {
  ASSIGNMENT_STATE,
  ASSIGNMENT_STATE_ORDER,
  INCIDENT_STATE,
  INCIDENT_STATE_ORDER,
} from "@/lib/state-machine";

/**
 * Build the Mermaid flowchart definition from state machine constants.
 * Mantener aquí la única definición evita que el diagrama se desincronice
 * cuando se cambien los estados en `src/lib/state-machine`.
 */
function buildMermaid(): string {
  // Incident: linear forward chain (ABIERTO → ... → CERRADO) plus CANCELADA
  // branches from any non-terminal state.
  const linearIncidentStates = INCIDENT_STATE_ORDER.filter(
    (s) => s !== INCIDENT_STATE.CANCELADA,
  );
  const incidentChain = INCIDENT_STATE_ORDER.map((s) => `I_${s}((${s}))`).join(
    "\n    ",
  );
  const incidentForwardEdges = linearIncidentStates
    .slice(0, -1)
    .map((s, idx) => `I_${s} --> I_${linearIncidentStates[idx + 1]}`)
    .join("\n    ");
  const incidentCancelEdges = linearIncidentStates
    .filter((s) => s !== INCIDENT_STATE.CERRADO)
    .map((s) => `I_${s} -.->|admin| I_${INCIDENT_STATE.CANCELADA}`)
    .join("\n    ");

  const assignmentNodes = ASSIGNMENT_STATE_ORDER.map(
    (s) => `A_${s}((${s}))`,
  ).join("\n    ");

  const incidentNodeList = INCIDENT_STATE_ORDER.map((s) => `I_${s}`).join(",");
  const assignmentNodeList = ASSIGNMENT_STATE_ORDER.map((s) => `A_${s}`).join(
    ",",
  );

  return `flowchart TB
  subgraph Programación["📅 Programación (Schedule)"]
    direction LR
    P1["scheduledAt → endDate"]
    P2["N Clientes asignados"]
  end

  subgraph Incidente["🚨 Incidente"]
    direction LR
    ${incidentChain}
    ${incidentForwardEdges}
    ${incidentCancelEdges}
  end

  subgraph Asignación["🔧 Asignación"]
    direction LR
    ${assignmentNodes}
    A_${ASSIGNMENT_STATE.PENDIENTE_DE_ASIGNACION} --> A_${ASSIGNMENT_STATE.ASIGNADO}
    A_${ASSIGNMENT_STATE.ASIGNADO} --> A_${ASSIGNMENT_STATE.VISTO}
    A_${ASSIGNMENT_STATE.VISTO} --> A_${ASSIGNMENT_STATE.INICIADO}
    A_${ASSIGNMENT_STATE.INICIADO} --> A_${ASSIGNMENT_STATE.EN_PROGRESO}
    A_${ASSIGNMENT_STATE.EN_PROGRESO} --> A_${ASSIGNMENT_STATE.INICIADO}
    A_${ASSIGNMENT_STATE.INICIADO} -->|ODT + evidencia| A_${ASSIGNMENT_STATE.CERRADO}
    A_${ASSIGNMENT_STATE.EN_PROGRESO} -->|ODT + evidencia| A_${ASSIGNMENT_STATE.CERRADO}
  end

  Programación -. contiene .-> Incidente
  Incidente -. deriva estado de .-> Asignación

  classDef stateNode fill:#f0f9ff,stroke:#0284c7,color:#0c4a6e,font-weight:bold;
  classDef cancelNode fill:#fee2e2,stroke:#dc2626,color:#7f1d1d,font-weight:bold;
  class ${incidentNodeList} stateNode;
  class I_${INCIDENT_STATE.CANCELADA} cancelNode;
  classDef asgNode fill:#fef3c7,stroke:#d97706,color:#78350f,font-weight:bold;
  class ${assignmentNodeList} asgNode;
`;
}

export default async function LifecyclePage() {
  await requireRouteAccess("/admin");
  const definition = buildMermaid();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
          <Workflow className="h-5 w-5 text-purple-500" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Ciclo de Vida</h1>
          <p className="text-muted-foreground">
            Cómo se relacionan Programación, Incidente y Asignación en el
            sistema.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Diagrama de flujo</CardTitle>
          <CardDescription>
            Refleja en tiempo real los estados definidos en{" "}
            <code className="text-xs">src/lib/state-machine</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <LifecycleDiagram definition={definition} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reglas clave</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <strong>Programación.</strong> Contenedor opcional con rango{" "}
            <code className="text-xs">scheduledAt → endDate</code> y uno o más
            Clientes. Una incidencia ligada a una programación debe pertenecer a
            uno de sus Clientes.
          </p>
          <p>
            <strong>Incidente.</strong> Su estado se <strong>deriva</strong> del
            estado más avanzado de sus asignaciones — nunca se cambia
            manualmente, excepto la cancelación admin. Un incidente sin
            asignaciones queda en <code className="text-xs">ABIERTO</code>.
          </p>
          <p>
            <strong>Asignación.</strong> Las transiciones son estrictas: para
            pasar a <code className="text-xs">INICIADO</code> se requiere
            captura de GPS y hora de inicio; para llegar a{" "}
            <code className="text-xs">CERRADO</code> se requiere GPS final, hora
            de cierre, al menos una evidencia adjunta{" "}
            <strong>y folio ODT registrado</strong>.
          </p>
          <p>
            <strong>
              Estado <code className="text-xs">EN_PROGRESO</code>.
            </strong>{" "}
            Pausa o continuación después de iniciar. Se puede retomar a{" "}
            <code className="text-xs">INICIADO</code> o avanzar a{" "}
            <code className="text-xs">CERRADO</code> (siempre con ODT).
          </p>
          <p>
            <strong>Reapertura.</strong> Una asignación{" "}
            <code className="text-xs">CERRADO</code> sólo regresa a{" "}
            <code className="text-xs">EN_PROGRESO</code> y únicamente por un{" "}
            <strong>administrador</strong>.
          </p>
          <p>
            <strong>
              Cancelación (<code className="text-xs">CANCELADA</code>).
            </strong>{" "}
            Estado terminal exclusivo de la incidencia, ejecutado por el
            administrador <strong>sin necesidad de ODT</strong>. Cancelar una
            incidencia congela todas sus asignaciones: ningún FSR puede editar
            actividades, evidencias ni transicionar estados después.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
