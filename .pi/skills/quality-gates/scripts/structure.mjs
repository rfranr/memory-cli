// Metrics operate only on the caller-selected project modules. External dependencies
// do not contribute to fan-out, transitive count, or depth.
export function projectGraph(report, isProjectModule) {
  return new Map(
    report.modules
      .filter((module) => isProjectModule(module.source))
      .map((module) => [
        module.source,
        (module.dependencies ?? [])
          .filter((dependency) => isProjectModule(dependency.resolved))
          .map((dependency) => dependency.resolved),
      ]),
  );
}

function reachable(graph, start) {
  const visited = new Set();

  function visit(node) {
    for (const next of graph.get(node) ?? []) {
      if (next === start || visited.has(next)) {
        continue;
      }

      visited.add(next);
      visit(next);
    }
  }

  visit(start);

  return visited.size;
}

function depth(graph, start) {
  function visit(node, ancestors) {
    return Math.max(
      0,
      ...(graph.get(node) ?? [])
        .filter((next) => !ancestors.has(next))
        .map((next) => visit(next, new Set([...ancestors, next])) + 1),
    );
  }

  return visit(start, new Set([start]));
}

export function printStructure(graph) {
  console.log('Module'.padEnd(32), 'Fan-out  Transitive  Depth');

  for (const node of [...graph.keys()].sort()) {
    console.log(
      node.padEnd(32),
      String(graph.get(node).length).padStart(7),
      String(reachable(graph, node)).padStart(11),
      String(depth(graph, node)).padStart(6),
    );
  }

  console.log('\nMax dependency depth:', Math.max(0, ...[...graph.keys()].map((node) => depth(graph, node))));
}
