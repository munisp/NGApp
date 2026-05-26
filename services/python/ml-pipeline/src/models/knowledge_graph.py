"""
Neo4j Knowledge Graph — Equipment Relationships & Failure Cascades
===================================================================
Models relationships between wells, equipment, and failure modes as a
property graph. Supports queries for:
  - Equipment dependency chains
  - Failure cascade analysis
  - Root cause identification
  - Maintenance impact analysis

When Neo4j is available:
  Uses the official neo4j Python driver with Cypher queries.

When Neo4j is unavailable:
  Falls back to an in-memory NetworkX graph with equivalent semantics.

Schema (Cypher):
  (:Well {id, name, field, status})
  (:ESP {id, well_id, model, install_date, hours_run})
  (:Compressor {id, type, capacity_hp})
  (:Separator {id, type, capacity_bpd})
  (:Pipeline {id, diameter_in, length_ft})
  (:Manifold {id, ports})
  (:FailureMode {id, name, category, severity})

  (:Well)-[:HAS_ESP]->(:ESP)
  (:Well)-[:CONNECTS_TO]->(:Manifold)
  (:Manifold)-[:FEEDS]->(:Separator)
  (:Separator)-[:OUTPUTS_TO]->(:Pipeline)
  (:ESP)-[:CAN_FAIL_WITH]->(:FailureMode)
  (:Equipment)-[:DEPENDS_ON]->(:Equipment)
"""

import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "")


class KnowledgeGraph:
    """
    Equipment knowledge graph with Neo4j backend (or NetworkX fallback).
    """

    def __init__(self):
        self._driver = None
        self._graph = None  # NetworkX fallback
        self._use_neo4j = False

    async def connect(self):
        """Connect to Neo4j or fall back to in-memory graph."""
        if NEO4J_PASSWORD:
            try:
                from neo4j import AsyncGraphDatabase
                self._driver = AsyncGraphDatabase.driver(
                    NEO4J_URI,
                    auth=(NEO4J_USER, NEO4J_PASSWORD),
                )
                await self._driver.verify_connectivity()
                self._use_neo4j = True
                logger.info("Connected to Neo4j at %s", NEO4J_URI)
                await self._init_neo4j_schema()
                return
            except Exception as e:
                logger.warning("Neo4j connection failed (%s) — using in-memory graph", e)

        self._init_networkx_graph()
        logger.info("Knowledge graph initialized (in-memory NetworkX)")

    def _init_networkx_graph(self):
        """Initialize in-memory graph with NetworkX."""
        try:
            import networkx as nx
        except ImportError:
            logger.warning("networkx not installed — knowledge graph unavailable")
            return

        self._graph = nx.DiGraph()
        self._seed_sample_data()

    def _seed_sample_data(self):
        """Seed graph with realistic O&G equipment topology."""
        g = self._graph
        if g is None:
            return

        # Wells
        fields = ["Permian Basin", "Eagle Ford", "Bakken"]
        for i in range(20):
            well_id = f"WELL-{i + 1:03d}"
            field = fields[i % len(fields)]
            g.add_node(well_id, type="Well", name=f"Well #{i + 1}", field=field, status="producing")

            # Each well has an ESP
            esp_id = f"ESP-{i + 1:03d}"
            g.add_node(esp_id, type="ESP", well_id=well_id, model="REDA 540", hours_run=4000 + i * 200)
            g.add_edge(well_id, esp_id, relationship="HAS_ESP")

            # Failure modes for ESP
            for fm_name, severity in [
                ("bearing_failure", "HIGH"), ("shaft_breakage", "CRITICAL"),
                ("insulation_degradation", "MEDIUM"), ("gas_locking", "HIGH"),
                ("sand_erosion", "HIGH"),
            ]:
                fm_id = f"FM-{esp_id}-{fm_name}"
                g.add_node(fm_id, type="FailureMode", name=fm_name, severity=severity, category="mechanical")
                g.add_edge(esp_id, fm_id, relationship="CAN_FAIL_WITH")

        # Manifolds
        g.add_node("MAN-A", type="Manifold", ports=10)
        g.add_node("MAN-B", type="Manifold", ports=10)
        for i in range(10):
            g.add_edge(f"WELL-{i + 1:03d}", "MAN-A", relationship="CONNECTS_TO")
        for i in range(10, 20):
            g.add_edge(f"WELL-{i + 1:03d}", "MAN-B", relationship="CONNECTS_TO")

        # Separators
        g.add_node("SEP-1", type="Separator", capacity_bpd=5000, sep_type="three-phase")
        g.add_edge("MAN-A", "SEP-1", relationship="FEEDS")
        g.add_edge("MAN-B", "SEP-1", relationship="FEEDS")

        # Compressor
        g.add_node("COMP-1", type="Compressor", capacity_hp=2000, comp_type="reciprocating")
        g.add_edge("SEP-1", "COMP-1", relationship="OUTPUTS_TO")

        # Pipeline
        g.add_node("PIPE-MAIN", type="Pipeline", diameter_in=12, length_ft=15000)
        g.add_edge("COMP-1", "PIPE-MAIN", relationship="OUTPUTS_TO")

        # Tank
        g.add_node("TANK-1", type="Tank", capacity_bbls=50000)
        g.add_edge("SEP-1", "TANK-1", relationship="OUTPUTS_TO")

        # Dependencies
        for i in range(20):
            g.add_edge(f"ESP-{i + 1:03d}", "MAN-A" if i < 10 else "MAN-B", relationship="DEPENDS_ON")
        g.add_edge("MAN-A", "SEP-1", relationship="DEPENDS_ON")
        g.add_edge("MAN-B", "SEP-1", relationship="DEPENDS_ON")
        g.add_edge("SEP-1", "COMP-1", relationship="DEPENDS_ON")
        g.add_edge("SEP-1", "TANK-1", relationship="DEPENDS_ON")
        g.add_edge("COMP-1", "PIPE-MAIN", relationship="DEPENDS_ON")

        logger.info("Seeded knowledge graph with %d nodes, %d edges",
                    g.number_of_nodes(), g.number_of_edges())

    async def _init_neo4j_schema(self):
        """Create Neo4j constraints and indexes."""
        async with self._driver.session() as session:
            constraints = [
                "CREATE CONSTRAINT IF NOT EXISTS FOR (w:Well) REQUIRE w.id IS UNIQUE",
                "CREATE CONSTRAINT IF NOT EXISTS FOR (e:ESP) REQUIRE e.id IS UNIQUE",
                "CREATE CONSTRAINT IF NOT EXISTS FOR (c:Compressor) REQUIRE c.id IS UNIQUE",
                "CREATE CONSTRAINT IF NOT EXISTS FOR (s:Separator) REQUIRE s.id IS UNIQUE",
                "CREATE CONSTRAINT IF NOT EXISTS FOR (p:Pipeline) REQUIRE p.id IS UNIQUE",
                "CREATE CONSTRAINT IF NOT EXISTS FOR (m:Manifold) REQUIRE m.id IS UNIQUE",
                "CREATE CONSTRAINT IF NOT EXISTS FOR (f:FailureMode) REQUIRE f.id IS UNIQUE",
            ]
            for cypher in constraints:
                await session.run(cypher)

    async def get_equipment_dependencies(self, equipment_id: str) -> dict:
        """Get all equipment that depends on or is depended upon by given equipment."""
        t0 = time.time()

        if self._use_neo4j and self._driver:
            return await self._neo4j_dependencies(equipment_id)

        if self._graph is None:
            return {"equipment_id": equipment_id, "upstream": [], "downstream": [], "error": "Graph not initialized"}

        import networkx as nx

        upstream = []
        downstream = []

        # BFS upstream (what this equipment depends on)
        for pred in nx.ancestors(self._graph, equipment_id) if equipment_id in self._graph else []:
            node = self._graph.nodes[pred]
            upstream.append({"id": pred, "type": node.get("type", "unknown")})

        # BFS downstream (what depends on this equipment)
        for succ in nx.descendants(self._graph, equipment_id) if equipment_id in self._graph else []:
            node = self._graph.nodes[succ]
            downstream.append({"id": succ, "type": node.get("type", "unknown")})

        latency_ms = (time.time() - t0) * 1000
        return {
            "equipment_id": equipment_id,
            "upstream": upstream,
            "downstream": downstream,
            "total_dependencies": len(upstream) + len(downstream),
            "latency_ms": round(latency_ms, 1),
            "backend": "networkx",
        }

    async def _neo4j_dependencies(self, equipment_id: str) -> dict:
        """Query Neo4j for equipment dependencies."""
        t0 = time.time()
        async with self._driver.session() as session:
            # Upstream
            up_result = await session.run(
                """
                MATCH (target {id: $id})<-[:DEPENDS_ON*1..5]-(upstream)
                RETURN upstream.id AS id, labels(upstream)[0] AS type
                """,
                id=equipment_id,
            )
            upstream = [{"id": r["id"], "type": r["type"]} async for r in up_result]

            # Downstream
            down_result = await session.run(
                """
                MATCH (target {id: $id})-[:DEPENDS_ON*1..5]->(downstream)
                RETURN downstream.id AS id, labels(downstream)[0] AS type
                """,
                id=equipment_id,
            )
            downstream = [{"id": r["id"], "type": r["type"]} async for r in down_result]

        latency_ms = (time.time() - t0) * 1000
        return {
            "equipment_id": equipment_id,
            "upstream": upstream,
            "downstream": downstream,
            "total_dependencies": len(upstream) + len(downstream),
            "latency_ms": round(latency_ms, 1),
            "backend": "neo4j",
        }

    async def get_failure_cascade(self, equipment_id: str) -> dict:
        """
        Simulate failure cascade: what other equipment would be affected
        if the given equipment fails?
        """
        t0 = time.time()

        if self._graph is None:
            return {"equipment_id": equipment_id, "affected": [], "error": "Graph not initialized"}

        import networkx as nx

        if equipment_id not in self._graph:
            return {"equipment_id": equipment_id, "affected": [], "error": "Equipment not found"}

        # BFS from failed node following DEPENDS_ON edges
        affected = []
        visited = set()
        queue = [(equipment_id, 0)]

        while queue:
            current, depth = queue.pop(0)
            if current in visited:
                continue
            visited.add(current)

            if current != equipment_id:
                node = self._graph.nodes[current]
                affected.append({
                    "id": current,
                    "type": node.get("type", "unknown"),
                    "name": node.get("name", current),
                    "cascade_depth": depth,
                    "impact": max(0, 1.0 - depth * 0.2),
                })

            # Follow reverse DEPENDS_ON edges (things that depend on this)
            for _, successor, data in self._graph.out_edges(current, data=True):
                if data.get("relationship") in ("DEPENDS_ON", "OUTPUTS_TO", "FEEDS"):
                    if successor not in visited:
                        queue.append((successor, depth + 1))
            # Also follow predecessors that point to this
            for predecessor, _, data in self._graph.in_edges(current, data=True):
                if data.get("relationship") in ("HAS_ESP", "CONNECTS_TO"):
                    if predecessor not in visited:
                        queue.append((predecessor, depth + 1))

        affected.sort(key=lambda x: x["cascade_depth"])
        latency_ms = (time.time() - t0) * 1000

        return {
            "equipment_id": equipment_id,
            "affected_count": len(affected),
            "max_cascade_depth": max((a["cascade_depth"] for a in affected), default=0),
            "affected": affected,
            "latency_ms": round(latency_ms, 1),
        }

    async def get_failure_modes(self, equipment_id: str) -> List[dict]:
        """Get all failure modes associated with an equipment."""
        if self._graph is None:
            return []

        modes = []
        for _, target, data in self._graph.out_edges(equipment_id, data=True):
            if data.get("relationship") == "CAN_FAIL_WITH":
                node = self._graph.nodes[target]
                modes.append({
                    "id": target,
                    "name": node.get("name", ""),
                    "severity": node.get("severity", "UNKNOWN"),
                    "category": node.get("category", "unknown"),
                })
        return modes

    async def find_root_cause(self, failed_equipment_id: str) -> dict:
        """
        Trace upstream to find potential root causes for a failure.
        Returns the critical path from root cause to failed equipment.
        """
        if self._graph is None:
            return {"failed_equipment_id": failed_equipment_id, "root_causes": []}

        import networkx as nx

        if failed_equipment_id not in self._graph:
            return {"failed_equipment_id": failed_equipment_id, "root_causes": [], "error": "Not found"}

        root_causes = []
        # Walk upstream (predecessors) to find root equipment
        ancestors = nx.ancestors(self._graph, failed_equipment_id) if failed_equipment_id in self._graph else set()
        for ancestor in ancestors:
            node = self._graph.nodes[ancestor]
            # Root causes are nodes with no incoming DEPENDS_ON edges
            has_upstream = any(
                data.get("relationship") == "DEPENDS_ON"
                for _, _, data in self._graph.in_edges(ancestor, data=True)
            )
            if not has_upstream and node.get("type") in ("Well", "ESP"):
                try:
                    path = nx.shortest_path(self._graph, ancestor, failed_equipment_id)
                    root_causes.append({
                        "root_id": ancestor,
                        "root_type": node.get("type"),
                        "path": path,
                        "path_length": len(path) - 1,
                    })
                except nx.NetworkXNoPath:
                    pass

        root_causes.sort(key=lambda x: x["path_length"])
        return {
            "failed_equipment_id": failed_equipment_id,
            "root_causes": root_causes[:10],
        }

    async def get_graph_stats(self) -> dict:
        """Get graph statistics."""
        if self._graph is None:
            return {"error": "Graph not initialized"}

        import networkx as nx

        node_types = {}
        for _, data in self._graph.nodes(data=True):
            t = data.get("type", "unknown")
            node_types[t] = node_types.get(t, 0) + 1

        edge_types = {}
        for _, _, data in self._graph.edges(data=True):
            r = data.get("relationship", "unknown")
            edge_types[r] = edge_types.get(r, 0) + 1

        return {
            "backend": "neo4j" if self._use_neo4j else "networkx",
            "total_nodes": self._graph.number_of_nodes(),
            "total_edges": self._graph.number_of_edges(),
            "node_types": node_types,
            "edge_types": edge_types,
            "is_dag": nx.is_directed_acyclic_graph(self._graph),
        }

    async def close(self):
        if self._driver:
            await self._driver.close()
