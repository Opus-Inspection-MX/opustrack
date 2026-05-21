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
  const incidentChain = INCIDENT_STATE_ORDER.map((s) => `I_${s}((${s}))`).join(
    "\n    ",
  );
  const incidentEdges = INCIDENT_STATE_ORDER.slice(0, -1)
    .map((s, idx) => `I_${s} --> I_${INCIDENT_STATE_ORDER[idx + 1]}`)
    .join("\n    ");

  const assignmentNodes = ASSIGNMENT_STATE_ORDER.map(
    (s) => `A_${s}((${s}))`,
  ).join("\n    ");

  return `flowchart TB
  subgraph Programación["📅 Programación (Schedule)"]
    direction LR
    P1["scheduledAt → endDate"]
    P2["N VICs asignados"]
  end

  subgraph Incidente["🚨 Incidente"]
    direction LR
    ${incidentChain}
    ${incidentEdges}
  end

  subgraph Asignación["🔧 Asignación (Work order)"]
    direction LR
    ${assignmentNodes}
    A_${ASSIGNMENT_STATE.PENDIENTE_DE_ASIGNACION} --> A_${ASSIGNMENT_STATE.ASIGNADO}
    A_${ASSIGNMENT_STATE.ASIGNADO} --> A_${ASSIGNMENT_STATE.VISTO}
    A_${ASSIGNMENT_STATE.VISTO} --> A_${ASSIGNMENT_STATE.INICIADO}
    A_${ASSIGNMENT_STATE.INICIADO} --> A_${ASSIGNMENT_STATE.CERRADO}
    A_${ASSIGNMENT_STATE.INICIADO} --> A_${ASSIGNMENT_STATE.PENDIENTE}
    A_${ASSIGNMENT_STATE.PENDIENTE} --> A_${ASSIGNMENT_STATE.INICIADO}
    A_${ASSIGNMENT_STATE.PENDIENTE} --> A_${ASSIGNMENT_STATE.CERRADO}
  end

  Programación -. contiene .-> Incidente
  Incidente -. deriva estado de .-> Asignación

  classDef stateNode fill:#f0f9ff,stroke:#0284c7,color:#0c4a6e,font-weight:bold;
  class I_${INCIDENT_STATE.ABIERTO},I_${INCIDENT_STATE.ASIGNADO},I_${INCIDENT_STATE.VISTO},I_${INCIDENT_STATE.INICIADO},I_${INCIDENT_STATE.CERRADO} stateNode;
  classDef asgNode fill:#fef3c7,stroke:#d97706,color:#78350f,font-weight:bold;
  class A_${ASSIGNMENT_STATE.PENDIENTE_DE_ASIGNACION},A_${ASSIGNMENT_STATE.ASIGNADO},A_${ASSIGNMENT_STATE.VISTO},A_${ASSIGNMENT_STATE.INICIADO},A_${ASSIGNMENT_STATE.PENDIENTE},A_${ASSIGNMENT_STATE.CERRADO} asgNode;
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
            VICs. Una incidencia ligada a una programación debe pertenecer a uno
            de sus VICs.
          </p>
          <p>
            <strong>Incidente.</strong> Su estado se <strong>deriva</strong> del
            estado más avanzado de sus asignaciones — nunca se cambia
            manualmente. Un incidente sin asignaciones queda en{" "}
            <code className="text-xs">ABIERTO</code>.
          </p>
          <p>
            <strong>Asignación.</strong> El estado real lo lleva la asignación
            (work order). Las transiciones son estrictas: para pasar a{" "}
            <code className="text-xs">INICIADO</code> se requiere captura de GPS
            y hora de inicio; para llegar a{" "}
            <code className="text-xs">CERRADO</code> se requiere GPS final, hora
            de cierre y al menos una evidencia adjunta.
          </p>
          <p>
            <strong>
              Estado <code className="text-xs">PENDIENTE</code>.
            </strong>{" "}
            Pausa temporal después de iniciar. Se puede retomar a{" "}
            <code className="text-xs">INICIADO</code> o avanzar a{" "}
            <code className="text-xs">CERRADO</code>.
          </p>
          <p>
            <strong>Reapertura.</strong> Una asignación{" "}
            <code className="text-xs">CERRADO</code> sólo regresa a{" "}
            <code className="text-xs">PENDIENTE</code> (acción de
            administrador).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
