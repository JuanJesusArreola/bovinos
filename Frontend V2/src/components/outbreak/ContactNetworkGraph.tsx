/**
 * Grafo de red de contactos epidemiológicos centrado en un caso.
 *
 * Renderiza:
 *   - Nodo central: el caso seleccionado (color por status, label = arete).
 *   - Nodos hijos a la DERECHA  (asSource):  casos a los que ESTE caso
 *     potencialmente contagió (caso → target).
 *   - Nodos hijos a la IZQUIERDA (asTarget): casos que potencialmente
 *     contagiaron a ESTE caso (source → caso).
 *
 * Las aristas se etiquetan con el `contactType` (traducido) y se colorean
 * por confidence:
 *   - ≥0.8 verde   (alta)
 *   - 0.5-0.8 amber (media)
 *   - <0.5  gris   (baja)
 *
 * Sin contactos: empty state + sugerencia de ejecutar "Detectar contactos"
 * (botón externo gestionado por la página padre).
 *
 * Layout: simple — central en (0,0), hijos espaciados verticalmente a
 * ±300px en X según el rol. Sin auto-layout (dagre/elk) para evitar otra
 * dep. Para grafos < 30 nodos esto es legible y predecible.
 */

import { useMemo } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card } from '@/components/ui/Card';
import { Network } from 'lucide-react';
import type {
  CaseContactsResponse, ContactType,
} from '@/types/epidemiology.dtos';
import { getCaseStatusColor } from '@/design-system/tokens/case-status.colors';

interface ContactNetworkGraphProps {
  /** Caso central — su id se usa para el nodo raíz. */
  centralCaseId: string;
  /** Etiqueta legible del bovino del caso central (arete + nombre). */
  centralLabel: string;
  /** Status del caso central — para el color del nodo raíz. */
  centralStatus: string;
  /** Respuesta del endpoint /epidemiology/cases/:caseId/contacts. */
  contacts: CaseContactsResponse | null | undefined;
}

// ── Mapas de presentación ───────────────────────────────────────────────────

const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  SAME_LOCATION:  'Misma ubicación',
  SHARED_PASTURE: 'Pastura compartida',
  DIRECT_CONTACT: 'Contacto directo',
  SHARED_WATER:   'Agua compartida',
  AUTO_DETECTED:  'Auto-detectado',
};

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return '#16a34a'; // verde
  if (confidence >= 0.5) return '#f59e0b'; // amber
  return '#9ca3af'; // gris
}

// ── Component ──────────────────────────────────────────────────────────────

export function ContactNetworkGraph({
  centralCaseId, centralLabel, centralStatus, contacts,
}: ContactNetworkGraphProps) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // ── Nodo central ───────────────────────────────────────────────────────
    nodes.push({
      id: centralCaseId,
      position: { x: 0, y: 0 },
      data: { label: centralLabel },
      style: {
        background: getCaseStatusColor(centralStatus),
        color: '#ffffff',
        border: '3px solid #ffffff',
        boxShadow: '0 0 0 2px ' + getCaseStatusColor(centralStatus),
        borderRadius: 12,
        padding: '8px 14px',
        fontSize: 13,
        fontWeight: 600,
        minWidth: 140,
        textAlign: 'center',
      },
    });

    if (!contacts) return { nodes, edges };

    // Helper que construye el estilo de la arista con tratamiento
    // especial cuando wasProtected=true: opacidad reducida + dashed
    // + sin animacion (aunque la confidence venga alta).
    function edgeStyle(confidence: number, wasProtected?: boolean, isExposureOnly?: boolean) {
      const base = {
        stroke: confidenceColor(confidence),
        strokeWidth: 1 + confidence * 2,
      };
      // F-38: exposiciones tambien se muestran atenuadas + dasheadas (sin
      // confirmacion clinica todavia). Si ademas wasProtected, el efecto
      // se aplica una sola vez (mismas reglas, distintas razones).
      if (wasProtected || isExposureOnly) {
        return {
          ...base,
          opacity: 0.45,
          strokeDasharray: '6 4',
        };
      }
      return base;
    }

    // Helper de label: si wasProtected, anteponer marcador visual
    // "[VAC]" para que sea identificable incluso sin tooltip.
    // F-38: exposiciones llevan prefijo "[EXP]" para que el VET las
    // identifique sin hover.
    function edgeLabel(contactType: string, wasProtected?: boolean, isExposureOnly?: boolean) {
      const base = CONTACT_TYPE_LABELS[contactType as ContactType] ?? contactType;
      if (isExposureOnly) return `[EXP] ${base}`;
      return wasProtected ? `[VAC] ${base}` : base;
    }

    // ── Hijos asSource (este caso CONTAGIÓ a estos) — DERECHA ─────────────
    const sources = contacts.asSource ?? [];
    const sourceCount = sources.length;
    sources.forEach((c, idx) => {
      // Espaciado vertical proporcional al número de hijos para evitar
      // solapamiento — separación mínima 90px, máx 130px.
      const spacing = Math.min(130, Math.max(90, 600 / Math.max(sourceCount, 1)));
      const y = (idx - (sourceCount - 1) / 2) * spacing;
      const protectedFlag = c.wasProtected;
      // F-38 / Backend E-04: exposicion asintomatica. targetCase puede ser
      // null y la info del bovino viene en `targetBovine`. La derivacion
      // toma `isExposureOnly` del backend cuando existe, con fallback al
      // null-check para tolerar respuestas antiguas.
      const isExposure = c.isExposureOnly ?? (c.targetCase === null);
      const targetBovine = isExposure
        ? c.targetBovine
        : (c.targetCase?.bovine ?? null);
      const earTag = targetBovine?.earTag ?? '(sin arete)';
      const bovineName = targetBovine?.name;
      // Para exposiciones usamos el bovineId como identificador del nodo
      // (no hay caseId). targetCaseId puede ser null para exposiciones.
      const nodeId = isExposure
        ? `expo-${c.targetBovineId ?? c.id}`
        : `target-${c.targetCaseId}`;
      const baseLabel = `${earTag}${bovineName ? ` · ${bovineName}` : ''}`;
      nodes.push({
        id: nodeId,
        position: { x: 320, y },
        data: { label: isExposure ? `${baseLabel}\n(Expuesto)` : baseLabel },
        style: nodeStyle(c.targetCase?.status, protectedFlag, isExposure),
      });
      edges.push({
        id: `e-out-${c.id}`,
        source: centralCaseId,
        target: nodeId,
        label: edgeLabel(c.contactType, protectedFlag, isExposure),
        labelStyle: { fontSize: 10, fill: protectedFlag ? '#6b7280' : '#374151' },
        labelBgStyle: { fill: '#ffffff', fillOpacity: protectedFlag ? 0.7 : 0.9 },
        style: edgeStyle(c.confidence, protectedFlag, isExposure),
        // No animar enlaces wasProtected ni exposiciones — ambos comunican
        // "contagio NO confirmado aun / efecto atenuado".
        animated: !protectedFlag && !isExposure && c.confidence >= 0.8,
      });
    });

    // ── Hijos asTarget (estos contagiaron a este caso) — IZQUIERDA ────────
    const targets = contacts.asTarget ?? [];
    const targetCount = targets.length;
    targets.forEach((c, idx) => {
      const spacing = Math.min(130, Math.max(90, 600 / Math.max(targetCount, 1)));
      const y = (idx - (targetCount - 1) / 2) * spacing;
      const protectedFlag = c.wasProtected;
      nodes.push({
        id: `source-${c.sourceCaseId}`,
        position: { x: -320, y },
        data: { label: `${c.sourceCase.bovine.earTag}${c.sourceCase.bovine.name ? ` · ${c.sourceCase.bovine.name}` : ''}` },
        style: nodeStyle(c.sourceCase.status, protectedFlag),
      });
      edges.push({
        id: `e-in-${c.id}`,
        source: `source-${c.sourceCaseId}`,
        target: centralCaseId,
        label: edgeLabel(c.contactType, protectedFlag),
        labelStyle: { fontSize: 10, fill: protectedFlag ? '#6b7280' : '#374151' },
        labelBgStyle: { fill: '#ffffff', fillOpacity: protectedFlag ? 0.7 : 0.9 },
        style: edgeStyle(c.confidence, protectedFlag),
        animated: !protectedFlag && c.confidence >= 0.8,
      });
    });

    return { nodes, edges };
  }, [centralCaseId, centralLabel, centralStatus, contacts]);

  const totalContacts = (contacts?.totalAsSource ?? 0) + (contacts?.totalAsTarget ?? 0);

  return (
    <Card noPadding className="overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-primary-600" />
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            Red de contactos
          </p>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({totalContacts} {totalContacts === 1 ? 'contacto' : 'contactos'})
          </span>
        </div>
        <ConfidenceLegend />
      </div>

      <div className="h-[420px] bg-gray-50 dark:bg-gray-950">
        {totalContacts === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <Network className="w-10 h-10 text-gray-300 dark:text-gray-700 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Sin contactos registrados para este caso.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Usa «Detectar contactos» arriba para que el sistema busque automáticamente.
            </p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} size={1} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!bg-white dark:!bg-gray-900" />
          </ReactFlow>
        )}
      </div>
    </Card>
  );
}

// ── Helpers visuales ───────────────────────────────────────────────────────

function nodeStyle(
  status: string | undefined | null,
  wasProtected?: boolean,
  isExposureOnly?: boolean,
) {
  // F-38 / Backend E-04: para exposiciones asintomaticas no hay caso clinico
  // y por tanto no hay status — usamos color amber fijo para que el VET
  // distinga el nodo del resto y entienda "este bovino estuvo expuesto pero
  // todavia no tiene caso abierto".
  const borderColor = isExposureOnly
    ? '#f59e0b'  // amber-500
    : getCaseStatusColor(status ?? 'UNKNOWN');

  const base = {
    background: isExposureOnly
      ? '#fffbeb'  // amber-50
      : '#ffffff',
    color: '#111827',
    border: `2px solid ${borderColor}`,
    borderRadius: 10,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 500,
    minWidth: 120,
    textAlign: 'center' as const,
    whiteSpace: 'pre-line' as const, // permite el \n del "(Expuesto)"
  };
  // Bovino vacunado / exposicion: atenuado + borde dasheado para
  // comunicar "menor probabilidad de contagio efectivo" o "no confirmado".
  if (wasProtected || isExposureOnly) {
    return {
      ...base,
      opacity: 0.85,
      borderStyle: 'dashed' as const,
    };
  }
  return base;
}

function ConfidenceLegend() {
  return (
    <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400 flex-wrap">
      <span className="flex items-center gap-1">
        <span className="block w-4 h-0.5 rounded-full" style={{ background: '#16a34a' }} />
        Alta ≥0.8
      </span>
      <span className="flex items-center gap-1">
        <span className="block w-4 h-0.5 rounded-full" style={{ background: '#f59e0b' }} />
        Media
      </span>
      <span className="flex items-center gap-1">
        <span className="block w-4 h-0.5 rounded-full" style={{ background: '#9ca3af' }} />
        Baja &lt;0.5
      </span>
      {/* Marca visual para wasProtected=true: arista dasheada + atenuada,
          label prefijada con "[VAC]". Comunica que el contagio efectivo
          es menos probable porque el bovino destino estaba vacunado. */}
      <span className="flex items-center gap-1" title="Bovino destino vacunado en la ventana de exposición">
        <span
          className="block w-4 h-0.5"
          style={{
            background:
              'repeating-linear-gradient(to right, #9ca3af 0 4px, transparent 4px 8px)',
            opacity: 0.7,
          }}
        />
        Vacunado [VAC]
      </span>
      {/* F-38 / Backend E-04: marca visual para exposicion asintomatica.
          Nodo con borde amber dasheado + label prefijada con "[EXP]".
          El bovino estuvo co-localizado pero no tiene caso clinico aun. */}
      <span className="flex items-center gap-1" title="Bovino co-localizado en la ventana de exposición sin caso clínico abierto">
        <span
          className="block w-3 h-3 rounded border border-dashed"
          style={{ borderColor: '#f59e0b', background: '#fffbeb' }}
        />
        Expuesto [EXP]
      </span>
    </div>
  );
}
