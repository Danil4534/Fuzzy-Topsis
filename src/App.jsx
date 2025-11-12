
import React, { useState, useMemo } from "react";
const LINGUISTIC = {
  VP: [1, 1, 3],
  P: [1, 3, 5],
  F: [3, 5, 7],
  G: [5, 7, 9],
  VG: [7, 9, 9],
};

const LINGUISTIC_LABELS = ["VP", "P", "F", "G", "VG"];

function triAdd(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function triDivScalar(a, k) {
  return [a[0] / k, a[1] / k, a[2] / k];
}
function triMulScalar(a, k) {
  return [a[0] * k, a[1] * k, a[2] * k];
}
function triDistance(a, b) {
  // distance between two triangular fuzzy numbers:
  // sqrt( (1/3) * ( (l1-l2)^2 + (m1-m2)^2 + (u1-u2)^2 ) )
  const dl = a[0] - b[0];
  const dm = a[1] - b[1];
  const du = a[2] - b[2];
  return Math.sqrt((dl * dl + dm * dm + du * du) / 3);
}

/* --- Utility: produce matrix templates --- */
function make3d(experts, criteria, alternatives, fill = "F") {
  // returns [experts][alternatives or criteria][criteria or alternatives]
  // For convenience we'll use this for alternatives: val[exp][alt][crit]
  const res = [];
  for (let e = 0; e < experts; e++) {
    const arrAlt = [];
    for (let a = 0; a < alternatives; a++) {
      const arrCrit = Array(criteria).fill(fill);
      arrAlt.push(arrCrit);
    }
    res.push(arrAlt);
  }
  return res;
}

export default function App() {
  // counts (with document limits)
  const [numExperts, setNumExperts] = useState(3);
  const [numCriteria, setNumCriteria] = useState(5);
  const [numAlternatives, setNumAlternatives] = useState(4);

  // Criteria names & alternative names
  const [criteriaNames, setCriteriaNames] = useState(
    Array.from({ length: 5 }, (_, i) => `C${i + 1}`)
  );
  const [alternativeNames, setAlternativeNames] = useState(
    Array.from({ length: 4 }, (_, i) => `A${i + 1}`)
  );

  // Data structures:
  // criteriaWeights[expert][criterion] = linguistic label
  const [criteriaWeights, setCriteriaWeights] = useState(() =>
    make3d(3, 5, 0).map((_, e) => Array(5).fill("M")) // here M -> map to 'F' (we'll use F label)
  );
  // alternativesAssessments[expert][alternative][criterion] = linguistic label
  const [alternativesAssessments, setAlternativesAssessments] = useState(() =>
    make3d(3, 5, 4, "G") // default Good
  );

  // Helper to rebuild names/arrays when counts change
  function applyCounts(e, c, a) {
    // enforce minimums
    const E = Math.max(3, e);
    const C = Math.max(5, c);
    const A = Math.max(4, a);
    setNumExperts(E);
    setNumCriteria(C);
    setNumAlternatives(A);

    setCriteriaNames((prev) => {
      const newNames = Array.from({ length: C }, (_, i) =>
        prev[i] ? prev[i] : `C${i + 1}`
      );
      return newNames;
    });

    setAlternativeNames((prev) => {
      const newNames = Array.from({ length: A }, (_, i) =>
        prev[i] ? prev[i] : `A${i + 1}`
      );
      return newNames;
    });

    // adjust criteriaWeights
    setCriteriaWeights((prev) => {
      const newCW = [];
      for (let ex = 0; ex < E; ex++) {
        const base = prev[ex] || Array(C).fill("F");
        const row = Array.from({ length: C }, (_, i) => base[i] || "F");
        newCW.push(row);
      }
      return newCW;
    });

    // adjust alternativesAssessments
    setAlternativesAssessments((prev) => {
      const newAA = [];
      for (let ex = 0; ex < E; ex++) {
        const prevAlt = prev[ex] || [];
        const altArr = [];
        for (let al = 0; al < A; al++) {
          const prevCrits = prevAlt[al] || [];
          const crits = Array.from({ length: C }, (_, i) => prevCrits[i] || "G");
          altArr.push(crits);
        }
        newAA.push(altArr);
      }
      return newAA;
    });
  }

  // Call applyCounts when user changes counts (but not on every render)
  function handleRecreate() {
    applyCounts(numExperts, numCriteria, numAlternatives);
  }

  // Handlers for editing names and cell values
  function setCriterionName(i, v) {
    setCriteriaNames((s) => {
      const t = [...s];
      t[i] = v;
      return t;
    });
  }
  function setAlternativeName(i, v) {
    setAlternativeNames((s) => {
      const t = [...s];
      t[i] = v;
      return t;
    });
  }

  function setCriteriaWeightValue(ex, crit, val) {
    setCriteriaWeights((prev) => {
      const copy = prev.map((r) => [...r]);
      copy[ex] = copy[ex] || Array(numCriteria).fill("F");
      copy[ex][crit] = val;
      return copy;
    });
  }

  function setAlternativeAssessmentValue(ex, alt, crit, val) {
    setAlternativesAssessments((prev) => {
      const copy = prev.map((alts) => alts.map((c) => [...c]));
      copy[ex] = copy[ex] || Array(numAlternatives).fill(null).map(() => Array(numCriteria).fill("G"));
      copy[ex][alt] = copy[ex][alt] || Array(numCriteria).fill("G");
      copy[ex][alt][crit] = val;
      return copy;
    });
  }

  /* ------------------ COMPUTATION PIPELINE ------------------ */

  // convert linguistic label -> triangular fuzzy number
  function labelToTri(label) {
    // accept also 'M' or 'Medium' mapping: map 'M' to 'F' (Fair)
    if (!label) label = "F";
    if (label === "M") label = "F";
    if (label === "H") label = "G";
    return LINGUISTIC[label] || LINGUISTIC["F"];
  }

  const results = useMemo(() => {
    // 1) Convert criteria weights and alternatives assessments to triangular numbers
    // criteriaWeightsTri[expert][criterion] = [l,m,u]
    const cwTri = criteriaWeights.map((row) =>
      row.map((lab) => labelToTri(lab))
    );
    // altTri[expert][alt][crit]
    const altTri = alternativesAssessments.map((alts) =>
      alts.map((critRow) => critRow.map((lab) => labelToTri(lab)))
    );

    // 2) Average across experts -> get aggregated criteria weights and aggregated alternatives
    // aggregatedWeights[criterion] = averaged triangular number
    const aggregatedWeights = [];
    for (let j = 0; j < numCriteria; j++) {
      let sum = [0, 0, 0];
      for (let e = 0; e < numExperts; e++) {
        const tri = cwTri[e] && cwTri[e][j] ? cwTri[e][j] : labelToTri("F");
        sum = triAdd(sum, tri);
      }
      aggregatedWeights.push(triDivScalar(sum, numExperts));
    }

    // aggregatedAlts[alt][crit] = averaged triangular number
    const aggregatedAlts = [];
    for (let i = 0; i < numAlternatives; i++) {
      const row = [];
      for (let j = 0; j < numCriteria; j++) {
        let sum = [0, 0, 0];
        for (let e = 0; e < numExperts; e++) {
          const tri = (altTri[e] && altTri[e][i] && altTri[e][i][j]) ? altTri[e][i][j] : labelToTri("G");
          sum = triAdd(sum, tri);
        }
        row.push(triDivScalar(sum, numExperts));
      }
      aggregatedAlts.push(row);
    }

    // 3) Normalization
    // For benefit criteria: r_ij = a_ij / max_u_j  (divide each tri by the maximum upper bound across alternatives for criterion j)
    // Find max upper for each criterion
    const maxUpper = Array(numCriteria).fill(-Infinity);
    for (let j = 0; j < numCriteria; j++) {
      for (let i = 0; i < numAlternatives; i++) {
        const u = aggregatedAlts[i][j][2];
        if (u > maxUpper[j]) maxUpper[j] = u;
      }
      if (!isFinite(maxUpper[j]) || maxUpper[j] === 0) maxUpper[j] = 1; // safety
    }

    const normalizedAlts = aggregatedAlts.map((row) =>
      row.map((tri, j) => {
        // divide all vertices by maxUpper[j]
        return triDivScalar(tri, maxUpper[j]);
      })
    );

    // 4) Weighted normalized: multiply normalized alt tri by aggregated weight (we need scalar weight)
    // Convert aggregatedWeights (triangular) to scalar weight -> common approach: use middle (m) as representative
    const weightScalars = aggregatedWeights.map((tri) => tri[1]); // middle point as scalar weight

    const weightedNormalized = normalizedAlts.map((row) =>
      row.map((tri, j) => triMulScalar(tri, weightScalars[j]))
    );

    // 5) FPIS and FNIS
    // We'll use the commonly used FPIS: for each criterion j:
    // FPIS_j = [ max over alternatives of weightedNormalized[i][j][0..2] ? ]
    // Simpler (and standard in many references): A+ = (max u_ij), and A- = (min l_ij)
    const FPIS = [];
    const FNIS = [];
    for (let j = 0; j < numCriteria; j++) {
      let maxU = -Infinity;
      let minL = Infinity;
      for (let i = 0; i < numAlternatives; i++) {
        const tri = weightedNormalized[i][j];
        if (tri[2] > maxU) maxU = tri[2];
        if (tri[0] < minL) minL = tri[0];
      }
      // Define A+ as (maxU, maxU, maxU) and A- as (minL, minL, minL)
      FPIS.push([maxU, maxU, maxU]);
      FNIS.push([minL, minL, minL]);
    }

    // 6) Distances to FPIS and FNIS (sum over criteria)
    const distToFPIS = Array(numAlternatives).fill(0);
    const distToFNIS = Array(numAlternatives).fill(0);
    for (let i = 0; i < numAlternatives; i++) {
      let sFP = 0;
      let sFN = 0;
      for (let j = 0; j < numCriteria; j++) {
        const tri = weightedNormalized[i][j];
        sFP += triDistance(tri, FPIS[j]);
        sFN += triDistance(tri, FNIS[j]);
      }
      distToFPIS[i] = sFP;
      distToFNIS[i] = sFN;
    }

    // 7) Closeness coefficient
    const closeness = distToFNIS.map((dfn, i) => {
      const dfp = distToFPIS[i];
      const denom = dfp + dfn;
      return denom === 0 ? 0 : dfn / denom;
    });
    const criteriaTri = cwTri;
    // 8) Ranking
    const ranking = Array.from({ length: numAlternatives }, (_, i) => ({
      alternative: alternativeNames[i] || `A${i + 1}`,
      index: i,
      closeness: closeness[i],
      distToFPIS: distToFPIS[i],
      distToFNIS: distToFNIS[i],
      weightedNormalizedRow: weightedNormalized[i],
      aggregatedAltRow: aggregatedAlts[i],
    })).sort((a, b) => b.closeness - a.closeness);

    return {
      altTri,
      aggregatedWeights, criteriaTri,
      aggregatedAlts,
      normalizedAlts,
      weightedNormalized,
      FPIS,
      FNIS,
      distToFPIS,
      distToFNIS,
      closeness,
      ranking,
    };
  }, [
    criteriaWeights,
    alternativesAssessments,
    numExperts,
    numCriteria,
    numAlternatives,
    alternativeNames,
  ]);

  /* ------------------ UI RENDER ------------------ */
  return (
    <div className="min-h-screen p-6 w-full">

      <h1 className="text-2xl font-semibold mb-4">Fuzzy TOPSIS</h1>
      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <div className="p-4 border rounded-lg">
          <label className="block text-sm text-semibold">Experts</label>
          <input
            type="number"
            min={3}
            value={numExperts}
            onChange={(e) => setNumExperts(Number(e.target.value))}
            className="mt-2 p-2  rounded w-full"
          />
        </div>
        <div className="p-4 border rounded-lg">
          <label className="block text-sm text-semibold">Criteria</label>
          <input
            type="number"
            min={5}
            value={numCriteria}
            onChange={(e) => setNumCriteria(Number(e.target.value))}
            className="mt-2 p-2  rounded w-full"
          />
        </div>
        <div className="p-4 border rounded-lg">
          <label className="block text-sm text-semibold">Alternatives </label>
          <input
            type="number"
            min={4}
            value={numAlternatives}
            onChange={(e) => setNumAlternatives(Number(e.target.value))}
            className="mt-2 p-2  rounded w-full"
          />
        </div>
      </div>

      <div className="mb-6">



        <div className="space-y-6">
          {/* Criteria weights per expert */}
          <div className="p-4 border rounded">
            <h3 className="font-semibold mb-2">Ваги критеріїв та оцінки альтернатив</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto text-sm border-collapse border">
                <thead>

                  <tr>
                    <th rowSpan={2} className="p-2 border bg-slate-50">Критерій</th>
                    <th colSpan={numExperts} className="p-2 border bg-slate-50 text-center">Ci</th>
                    {alternativeNames.map((alt, a) => (
                      <th key={`alt-${a}`} colSpan={numExperts} className="p-2 border bg-slate-100 text-center">
                        {alt || `A${a + 1}`}
                      </th>
                    ))}
                  </tr>

                  {/* 2 рядок: експерти */}
                  <tr>
                    {Array.from({ length: numExperts }, (_, e) => (
                      <th key={`ci-exp-${e}`} className="p-2 border bg-slate-50 text-center">Exp {e + 1}</th>
                    ))}
                    {alternativeNames.map((_, a) =>
                      Array.from({ length: numExperts }, (_, e) => (
                        <th key={`alt-${a}-exp-${e}`} className="p-2 border bg-slate-50 text-center">Exp {e + 1}</th>
                      ))
                    )}
                  </tr>
                </thead>

                <tbody>
                  {criteriaNames.map((crit, j) => (
                    <tr key={j}>
                      <td className="p-2 border font-medium text-center">{crit || `C${j + 1}`}</td>

                      {/* Ci веса селектами */}
                      {Array.from({ length: numExperts }, (_, e) => (
                        <td key={`ci-cell-${j}-${e}`} className="p-2 border text-center">
                          <select
                            value={criteriaWeights[e]?.[j] || "F"}
                            onChange={(ev) => setCriteriaWeightValue(e, j, ev.target.value)}
                            className="p-1 w-full rounded text-xs cursor-pointer"
                          >
                            {LINGUISTIC_LABELS.map((lab) => (
                              <option key={lab} value={lab}>{lab}</option>
                            ))}
                          </select>
                        </td>
                      ))}

                      {/* альтернативные оценки селектами */}
                      {alternativeNames.map((_, a) =>
                        Array.from({ length: numExperts }, (_, e) => (
                          <td key={`cell-${j}-${a}-${e}`} className="p-2 border text-center">
                            <select
                              value={alternativesAssessments[e]?.[a]?.[j] || "G"}
                              onChange={(ev) => setAlternativeAssessmentValue(e, a, j, ev.target.value)}
                              className="p-1 w-full rounded text-xs cursor-pointer"
                            >
                              {LINGUISTIC_LABELS.map((lab) => (
                                <option key={lab} value={lab}>{lab}</option>
                              ))}
                            </select>
                          </td>
                        ))
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>


          <div className="p-4 border rounded">
            <h3 className="font-semibold mb-2">
              Оцінки альтернатив по критеріям (трикутні нечіткі числа)
            </h3>
            <p className="text-sm text-slate-500 mb-3">
              Таблиця відображає перетворені лінгвістичні оцінки у вигляді трикутних
              нечітких чисел (l, m, u), а також оцінки експертів для Ci.
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-full table-auto text-sm border-collapse border">
                <thead>
                  <tr>
                    <th rowSpan={2} className="p-2 border bg-slate-50 text-center">Критерій</th>
                    <th colSpan={numExperts} className="p-2 border bg-slate-50 text-center">Ci</th>
                    {alternativeNames.map((alt, a) => (
                      <th key={`alt-${a}`} colSpan={numExperts} className="p-2 border bg-slate-100 text-center">
                        {alt || `A${a + 1}`}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {/* Эксперты для Ci */}
                    {Array.from({ length: numExperts }, (_, e) => (
                      <th key={`ci-exp-${e}`} className="p-2 border bg-slate-50 text-center">Exp {e + 1}</th>
                    ))}
                    {/* Эксперты для альтернатив */}
                    {alternativeNames.map((_, a) =>
                      Array.from({ length: numExperts }, (_, e) => (
                        <th key={`alt-${a}-exp-${e}`} className="p-2 border bg-slate-50 text-center">Exp {e + 1}</th>
                      ))
                    )}
                  </tr>
                </thead>

                <tbody>
                  {criteriaNames.map((crit, j) => (
                    <tr key={j}>
                      <td className="p-2 border font-medium text-center">{crit || `C${j + 1}`}</td>

                      {/* Ci оценки экспертов */}
                      {Array.from({ length: numExperts }, (_, e) => (
                        <td key={`ci-tri-${j}-${e}`} className="p-2 border text-center font-mono text-xs">
                          {(() => {
                            const tri = results?.criteriaTri?.[e]?.[j] || [0, 0, 0];
                            return `(${tri[0]}, ${tri[1]}, ${tri[2]})`;
                          })()}
                        </td>
                      ))}

                      {/* Треугольные числа для альтернатив */}
                      {alternativeNames.map((_, a) =>
                        Array.from({ length: numExperts }, (_, e) => {
                          const tri = results?.altTri?.[e]?.[a]?.[j] || [0, 0, 0];
                          return (
                            <td key={`cell-${j}-${a}-${e}`} className="p-2 border text-center font-mono text-xs">
                              ({tri[0]}, {tri[1]}, {tri[2]})
                            </td>
                          );
                        })
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-4 border rounded mt-6">
            <h3 className="font-semibold mb-2">
              Зважене середнє по кожному критерію для альтернатив
            </h3>
            <p className="text-sm text-slate-500 mb-3">
              Таблиця відображає середні трикутні нечіткі числа для кожного критерію та альтернативи.
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-full table-auto text-sm">
                <thead>
                  <tr>
                    <th className="p-2 border bg-slate-50 text-center">Ci</th>
                    {alternativeNames.map((alt, a) => (
                      <th key={a} className="p-2 border bg-slate-100 text-center">
                        {alt || `A${a + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {criteriaNames.map((crit, j) => (
                    <tr key={j}>
                      <td className="p-2 border font-medium text-center">{crit || `C${j + 1}`}</td>
                      {alternativeNames.map((_, a) => {
                        // Суммируем треугольные числа по всем экспертам
                        let sumL = 0, sumM = 0, sumU = 0;
                        for (let e = 0; e < numExperts; e++) {
                          const tri = results?.altTri?.[e]?.[a]?.[j] || [0, 0, 0];
                          sumL += tri[0];
                          sumM += tri[1];
                          sumU += tri[2];
                        }
                        // Делим на (numCriteria - 1)
                        const divisor = Math.max(1, numCriteria - 1);
                        const avgTri = [sumL / divisor, sumM / divisor, sumU / divisor];

                        return (
                          <td key={`avg-${j}-${a}`} className="p-2 border text-center font-mono text-xs">
                            ({avgTri[0].toFixed(2)}, {avgTri[1].toFixed(2)}, {avgTri[2].toFixed(2)})
                          </td>
                        );
                      })}
                    </tr>
                  ))}


                </tbody>
              </table>
            </div>
          </div>
          <div className="p-4 border rounded mt-6">
            <h3 className="font-semibold mb-2">
              Нормалізовані оцінки альтернатив
            </h3>
            <p className="text-sm text-slate-500 mb-3">
              Таблиця відображає нормалізовані трикутні нечіткі числа для кожного критерію та альтернативи (усі значення ≤ 1).
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-full table-auto text-sm">
                <thead>
                  <tr>
                    <th className="p-2 border bg-slate-50 text-center">Ci</th>
                    {alternativeNames.map((alt, a) => (
                      <th key={a} className="p-2 border bg-slate-100 text-center">
                        {alt || `A${a + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {criteriaNames.map((crit, j) => {
                    // Шукаємо максимум верхнього значення (u) для нормалізації
                    let maxU = 0;
                    for (let a = 0; a < numAlternatives; a++) {
                      for (let e = 0; e < numExperts; e++) {
                        const tri = results?.altTri?.[e]?.[a]?.[j] || [0, 0, 0];
                        if (tri[2] > maxU) maxU = tri[2];
                      }
                    }
                    if (maxU === 0) maxU = 1; // safety

                    return (
                      <tr key={j}>
                        <td className="p-2 border font-medium text-center">{crit || `C${j + 1}`}</td>
                        {alternativeNames.map((_, a) => {
                          // Суммируем треугольные числа по всем экспертам
                          let sumL = 0, sumM = 0, sumU = 0;
                          for (let e = 0; e < numExperts; e++) {
                            const tri = results?.altTri?.[e]?.[a]?.[j] || [0, 0, 0];
                            sumL += tri[0];
                            sumM += tri[1];
                            sumU += tri[2];
                          }
                          const divisor = Math.max(1, numCriteria - 1);
                          const avgTri = [sumL / divisor, sumM / divisor, sumU / divisor];

                          // Нормалізуємо на maxU
                          const normTri = avgTri.map(v => v / maxU);

                          return (
                            <td key={`norm-${j}-${a}`} className="p-2 border text-center font-mono text-xs">
                              ({normTri[0].toFixed(2)}, {normTri[1].toFixed(2)}, {normTri[2].toFixed(2)})
                            </td>
                          );
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>

  );
}
