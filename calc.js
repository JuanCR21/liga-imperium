/* ============================================================
   calc.js — Lógica compartida de Liga Imperium Fantasy
   No hay nada que tocar aquí. Todo lo editable vive en data.js
   ============================================================ */

const CONVERSION = [
  { min: 0,   max: 44,       goles: 0 },
  { min: 45,  max: 58,       goles: 1 },
  { min: 59,  max: 69,       goles: 2 },
  { min: 70,  max: 77,       goles: 3 },
  { min: 78,  max: 84,       goles: 4 },
  { min: 85,  max: 90,       goles: 5 },
  { min: 91,  max: 100,      goles: 6 },
  { min: 101, max: Infinity, goles: 7 },
];

function pointsToGoals(points) {
  if (isNaN(points)) return null;
  for (const c of CONVERSION) {
    if (points >= c.min && points <= c.max) return c.goles;
  }
  return 0;
}

function emptyTeamRow() {
  return { pts: 0, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0 };
}

// Aplica un partido normal (jornadas 1-36) sobre una COPIA de la tabla.
// Devuelve los goles calculados. No persiste nada, solo muta el objeto que le pases.
function applyNormalMatch(table, home, away, pHome, pAway) {
  const gHome = pointsToGoals(pHome);
  const gAway = pointsToGoals(pAway);
  if (gHome === null || gAway === null) return null;

  table[home].pj++; table[away].pj++;
  table[home].gf += gHome; table[home].gc += gAway;
  table[away].gf += gAway; table[away].gc += gHome;

  if (gHome > gAway) {
    table[home].pts += 3; table[home].g++; table[away].p++;
  } else if (gAway > gHome) {
    table[away].pts += 3; table[away].g++; table[home].p++;
  } else {
    table[home].pts += 1; table[away].pts += 1;
    table[home].e++; table[away].e++;
  }
  return { gHome, gAway };
}

// Aplica un resultado de jornada caos (37/38): solo toca pts y pj.
function applyCaosResult(table, team, points) {
  if (isNaN(points)) return null;
  const added = Math.floor(points / 10);
  table[team].pts += added;
  table[team].pj += 1;
  return added;
}

// Orden de desempate: PTS -> DG -> GF -> Victorias -> alfabético
function compareTeams(nameA, dataA, nameB, dataB) {
  if (dataB.pts !== dataA.pts) return dataB.pts - dataA.pts;
  const dgA = dataA.gf - dataA.gc, dgB = dataB.gf - dataB.gc;
  if (dgB !== dgA) return dgB - dgA;
  if (dataB.gf !== dataA.gf) return dataB.gf - dataA.gf;
  if (dataB.g !== dataA.g) return dataB.g - dataA.g;
  return nameA.localeCompare(nameB, 'es');
}

// Devuelve un array ordenado [{name, data}, ...] a partir de una tabla {name: data}
function sortedStandings(table) {
  return Object.entries(table)
    .map(([name, data]) => ({ name, data }))
    .sort((a, b) => compareTeams(a.name, a.data, b.name, b.data));
}

// Deshace un partido normal ya guardado (para poder editarlo sin descuadrar
// la clasificación). "m" debe traer home, away, gHome, gAway (los ya guardados).
function revertNormalMatch(table, m) {
  const { home, away, gHome, gAway } = m;
  table[home].pj--; table[away].pj--;
  table[home].gf -= gHome; table[home].gc -= gAway;
  table[away].gf -= gAway; table[away].gc -= gHome;
  if (gHome > gAway) {
    table[home].pts -= 3; table[home].g--; table[away].p--;
  } else if (gAway > gHome) {
    table[away].pts -= 3; table[away].g--; table[home].p--;
  } else {
    table[home].pts -= 1; table[away].pts -= 1; table[home].e--; table[away].e--;
  }
}

// Deshace un resultado caos ya guardado. "m" debe traer team y added.
function revertCaosResult(table, m) {
  table[m.team].pts -= m.added;
  table[m.team].pj -= 1;
}

// Clona profundo una tabla de clasificación (objeto plano de stats)
function cloneTable(table) {
  const out = {};
  for (const k in table) out[k] = { ...table[k] };
  return out;
}

/* ============================================================
   Funciones de solo lectura para fichas de equipo y estadísticas
   curiosas. No modifican nada, solo derivan datos ya existentes.
   ============================================================ */

// Devuelve, en orden CRONOLÓGICO (el mismo orden que el histórico), todos
// los partidos de un equipo en una temporada. Partidos normales traen
// {jornada, rival, propio, ajeno, ptsPropio, ptsAjeno}; los de modo caos
// traen {jornada, caos:true, added, points}.
function partidosDeEquipo(history, nombre) {
  const partidos = [];
  (history || []).forEach(j => {
    if (j.type === 'caos') {
      const m = j.matches.find(m => m.team === nombre);
      if (m) partidos.push({ jornada: j.number, caos: true, added: m.added, points: m.points });
    } else {
      j.matches.forEach(m => {
        if (m.home === nombre) {
          partidos.push({ jornada: j.number, rival: m.away, propio: m.gHome, ajeno: m.gAway, ptsPropio: m.pHome, ptsAjeno: m.pAway });
        } else if (m.away === nombre) {
          partidos.push({ jornada: j.number, rival: m.home, propio: m.gAway, ajeno: m.gHome, ptsPropio: m.pAway, ptsAjeno: m.pHome });
        }
      });
    }
  });
  return partidos;
}

// Equipo con el valor más alto (o más bajo, si mayor=false) de un campo de
// la tabla. Devuelve {nombre, valor} o null si la tabla está vacía.
function extremoPorCampo(table, campo, mayor) {
  let mejor = null;
  for (const nombre in table) {
    const valor = table[nombre][campo];
    if (mejor === null || (mayor ? valor > mejor.valor : valor < mejor.valor)) {
      mejor = { nombre, valor };
    }
  }
  return mejor;
}

// Racha de victorias consecutivas más larga de la temporada (partidos
// normales, modo caos no cuenta como victoria/derrota). Devuelve
// {nombre, valor} con el equipo que la consiguió, o null si aún no hay
// ninguna victoria registrada.
function rachaVictoriasMaxima(history, teams) {
  let mejor = null;
  Object.keys(teams).forEach(nombre => {
    const partidos = partidosDeEquipo(history, nombre).filter(p => !p.caos);
    let actual = 0, max = 0;
    partidos.forEach(p => {
      if (p.propio > p.ajeno) { actual++; max = Math.max(max, actual); }
      else actual = 0;
    });
    if (max > 0 && (mejor === null || max > mejor.valor)) mejor = { nombre, valor: max };
  });
  return mejor;
}

// El partido normal con mayor diferencia de goles de toda la temporada.
// Devuelve {jornada, home, away, gHome, gAway, diferencia} o null si
// todavía no hay ningún partido normal jugado.
function goleadaMasAbultada(history) {
  let mejor = null;
  (history || []).forEach(j => {
    if (j.type === 'caos') return;
    j.matches.forEach(m => {
      const diferencia = Math.abs(m.gHome - m.gAway);
      if (mejor === null || diferencia > mejor.diferencia) {
        mejor = { jornada: j.number, home: m.home, away: m.away, gHome: m.gHome, gAway: m.gAway, diferencia };
      }
    });
  });
  return mejor;
}

// Total de goles marcados en la liga y jornadas normales disputadas
// (cada partido cuenta un pj para cada equipo, por eso se divide entre 2).
function totalesLiga(table) {
  let goles = 0, pj = 0;
  for (const nombre in table) { goles += table[nombre].gf; pj += table[nombre].pj; }
  return { goles, partidos: pj / 2 };
}

// Recorre el histórico EN ORDEN DE NÚMERO DE JORNADA (no en el orden en que
// se registraron) y va calculando la clasificación tal y como estaba justo
// después de cada jornada. Devuelve { jornadas: [1,2,...], posiciones: {
// nombreEquipo: [posición tras cada jornada, en el mismo orden] } }, listo
// para dibujar un gráfico de evolución. No modifica nada, trabaja sobre una
// tabla interna propia.
function evolucionPosiciones(history, teams) {
  const ordenado = [...(history || [])].sort((a, b) => a.number - b.number);
  const tabla = {};
  Object.keys(teams).forEach(n => { tabla[n] = emptyTeamRow(); });

  const jornadas = [];
  const posiciones = {};
  Object.keys(teams).forEach(n => { posiciones[n] = []; });

  ordenado.forEach(j => {
    if (j.type === 'caos') {
      j.matches.forEach(m => { if (tabla[m.team]) applyCaosResult(tabla, m.team, m.points); });
    } else {
      j.matches.forEach(m => {
        if (tabla[m.home] && tabla[m.away]) applyNormalMatch(tabla, m.home, m.away, m.pHome, m.pAway);
      });
    }
    jornadas.push(j.number);
    const orden = sortedStandings(tabla);
    orden.forEach((f, i) => { if (posiciones[f.name]) posiciones[f.name].push(i + 1); });
  });

  return { jornadas, posiciones };
}
