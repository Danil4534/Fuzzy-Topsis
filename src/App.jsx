
import React, { useState, useMemo, useEffect } from "react";
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
  const dl = a[0] - b[0];
  const dm = a[1] - b[1];
  const du = a[2] - b[2];
  return Math.sqrt((dl * dl + dm * dm + du * du) / 3);
}


function make3d(experts, criteria, alternatives, fill = "F") {
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
  const [numExperts, setNumExperts] = useState(3);
  const [numCriteria, setNumCriteria] = useState(5);
  const [numAlternatives, setNumAlternatives] = useState(4);
  const [criteriaNames, setCriteriaNames] = useState(
    Array.from({ length: 5 }, (_, i) => `C${i + 1}`)
  );
  const [alternativeNames, setAlternativeNames] = useState(
    Array.from({ length: 4 }, (_, i) => `A${i + 1}`)
  );
  const [criteriaWeights, setCriteriaWeights] = useState(() =>
    make3d(3, 5, 0).map((_, e) => Array(5).fill("M"))
  );

  const [alternativesAssessments, setAlternativesAssessments] = useState(() =>
    make3d(3, 5, 4, "G")
  );

  function applyCounts(e, c, a) {

    const E = Math.max(1, e);
    const C = Math.max(1, c);
    const A = Math.max(1, a);
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
    setCriteriaWeights((prev) => {
      const newCW = [];
      for (let ex = 0; ex < E; ex++) {
        const base = prev[ex] || Array(C).fill("F");
        const row = Array.from({ length: C }, (_, i) => base[i] || "F");
        newCW.push(row);
      }
      return newCW;
    });
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


  function labelToTri(label) {
    if (!label) label = "F";
    if (label === "M") label = "F";
    if (label === "H") label = "G";
    return LINGUISTIC[label] || LINGUISTIC["F"];
  }

  const results = useMemo(() => {
    const cwTri = criteriaWeights.map((row) =>
      row.map((lab) => labelToTri(lab))
    );
    const altTri = alternativesAssessments.map((alts) =>
      alts.map((critRow) => critRow.map((lab) => labelToTri(lab)))
    );
    const aggregatedWeights = [];
    for (let j = 0; j < numCriteria; j++) {
      let sum = [0, 0, 0];
      for (let e = 0; e < numExperts; e++) {
        const tri = cwTri[e] && cwTri[e][j] ? cwTri[e][j] : labelToTri("F");
        sum = triAdd(sum, tri);
      }
      aggregatedWeights.push(triDivScalar(sum, numExperts));
    }
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

    const maxUpper = Array(numCriteria).fill(-Infinity);
    for (let j = 0; j < numCriteria; j++) {
      for (let i = 0; i < numAlternatives; i++) {
        const u = aggregatedAlts[i][j][2];
        if (u > maxUpper[j]) maxUpper[j] = u;
      }
      if (!isFinite(maxUpper[j]) || maxUpper[j] === 0) maxUpper[j] = 1;
    }

    const normalizedAlts = aggregatedAlts.map((row) =>
      row.map((tri, j) => {
        return triDivScalar(tri, maxUpper[j]);
      })
    );

    const weightScalars = aggregatedWeights.map((tri) => tri[1]);

    const weightedNormalized = normalizedAlts.map((row) =>
      row.map((tri, j) => triMulScalar(tri, weightScalars[j]))
    );

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
      FPIS.push([maxU, maxU, maxU]);
      FNIS.push([minL, minL, minL]);
    }
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
    const closeness = distToFNIS.map((dfn, i) => {
      const dfp = distToFPIS[i];
      const denom = dfp + dfn;
      return denom === 0 ? 0 : dfn / denom;
    });
    const criteriaTri = cwTri;
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
  useEffect(() => {
    applyCounts(numExperts, numCriteria, numAlternatives);
  }, [numExperts, numCriteria, numAlternatives]);

  return (
    <div className="min-h-screen p-6 w-full">
      <h1 className="text-2xl font-semibold mb-4">Fuzzy TOPSIS</h1>
      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <div className="p-4 border rounded-lg">
          <label className="block text-sm text-semibold">Experts</label>
          <input
            type="number"
            min={0}
            value={numExperts}
            onChange={(e) => setNumExperts(Number(e.target.value))}
            className="mt-2 p-2  rounded w-full"
          />
        </div>
        <div className="p-4 border rounded-lg">
          <label className="block text-sm text-semibold">Criteria</label>
          <input
            type="number"
            min={0}
            value={numCriteria}
            onChange={(e) => setNumCriteria(Number(e.target.value))}
            className="mt-2 p-2  rounded w-full"
          />
        </div>
        <div className="p-4 border rounded-lg">
          <label className="block text-sm text-semibold">Alternatives </label>
          <input
            type="number"
            min={0}
            value={numAlternatives}
            onChange={(e) => setNumAlternatives(Number(e.target.value))}
            className="mt-2 p-2  rounded w-full"
          />
        </div>
      </div>
      <div className="mb-6">
        <div className="space-y-6">
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


                      {Array.from({ length: numExperts }, (_, e) => (
                        <td key={`ci-tri-${j}-${e}`} className="p-2 border text-center font-mono text-xs">
                          {(() => {
                            const tri = results?.criteriaTri?.[e]?.[j] || [0, 0, 0];
                            return `(${tri[0]}, ${tri[1]}, ${tri[2]})`;
                          })()}
                        </td>
                      ))}


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
              Таблиця відображає середні трикутні нечіткі числа для кожного критерію та альтернативи,
              включно з окремим стовпчиком для Ci.
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-full table-auto text-sm border-collapse border">
                <thead>
                  <tr>
                    <th className="p-2 border bg-slate-50 text-center">Критерій</th>
                    <th className="p-2 border bg-slate-100 text-center">Ci</th>
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
                      <td className="p-2 border text-center font-mono text-xs">
                        {(() => {
                          let sumL = 0, sumM = 0, sumU = 0;
                          for (let e = 0; e < numExperts; e++) {
                            const tri = results?.criteriaTri?.[e]?.[j] || [0, 0, 0];
                            sumL += tri[0];
                            sumM += tri[1];
                            sumU += tri[2];
                          }
                          const divisor = Math.max(1, criteriaNames.length - 1);
                          const avgTri = [sumL / divisor, sumM / divisor, sumU / divisor];
                          return `(${avgTri[0].toFixed(2)}, ${avgTri[1].toFixed(2)}, ${avgTri[2].toFixed(2)})`;
                        })()}
                      </td>
                      {alternativeNames.map((_, a) => {
                        let sumL = 0, sumM = 0, sumU = 0;
                        for (let e = 0; e < numExperts; e++) {
                          const tri = results?.altTri?.[e]?.[a]?.[j] || [0, 0, 0];
                          sumL += tri[0];
                          sumM += tri[1];
                          sumU += tri[2];
                        }

                        const avgTri = [
                          sumL / Math.max(1, numExperts),
                          sumM / Math.max(1, numExperts),
                          sumU / Math.max(1, numExperts),
                        ];

                        return (
                          <td key={`avg-${j}-${a}`} className="p-2 border text-center font-mono text-xs">
                            {(() => {
                              let sumL = 0, sumM = 0, sumU = 0;
                              for (let e = 0; e < numExperts; e++) {
                                const tri = results?.altTri?.[e]?.[a]?.[j] || [0, 0, 0];
                                sumL += tri[0];
                                sumM += tri[1];
                                sumU += tri[2];
                              }


                              const divisor = Math.max(1, numCriteria - 1);
                              const avgTri = [
                                sumL / divisor,
                                sumM / divisor,
                                sumU / divisor,
                              ];

                              return `(${avgTri[0].toFixed(2)}, ${avgTri[1].toFixed(2)}, ${avgTri[2].toFixed(2)})`;
                            })()}
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
              Нормалізовані трикутні нечіткі числа
            </h3>
            <p className="text-sm text-slate-500 mb-3">
              Таблиця відображає нормалізовані дані, приведені до діапазону [0, 1]
              на основі максимального значення кожного критерію.
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-full table-auto text-sm border-collapse border">
                <thead>
                  <tr>
                    <th className="p-2 border bg-slate-50 text-center">Критерій</th>
                    {alternativeNames.map((alt, a) => (
                      <th key={a} className="p-2 border bg-slate-100 text-center">
                        {alt || `A${a + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {criteriaNames.map((crit, j) => {

                    let maxU = 0;
                    for (let a = 0; a < alternativeNames.length; a++) {
                      let sumU = 0;
                      for (let e = 0; e < numExperts; e++) {
                        const tri = results?.altTri?.[e]?.[a]?.[j] || [0, 0, 0];
                        sumU += tri[2];
                      }
                      const avgU = sumU / Math.max(1, numExperts);
                      if (avgU > maxU) maxU = avgU;
                    }

                    return (
                      <tr key={j}>
                        <td className="p-2 border font-medium text-center">{crit || `C${j + 1}`}</td>


                        {alternativeNames.map((_, a) => {
                          let sumL = 0, sumM = 0, sumU = 0;
                          for (let e = 0; e < numExperts; e++) {
                            const tri = results?.altTri?.[e]?.[a]?.[j] || [0, 0, 0];
                            sumL += tri[0];
                            sumM += tri[1];
                            sumU += tri[2];
                          }

                          const avgTri = [
                            sumL / Math.max(1, numExperts),
                            sumM / Math.max(1, numExperts),
                            sumU / Math.max(1, numExperts),
                          ];

                          const normTri = maxU > 0
                            ? [
                              avgTri[0] / maxU,
                              avgTri[1] / maxU,
                              avgTri[2] / maxU,
                            ]
                            : [0, 0, 0];

                          return (
                            <td key={`norm-${j}-${a}`} className="p-2 border text-center font-mono text-xs">
                              ({normTri[0].toFixed(2)}, {normTri[1].toFixed(2)}, {normTri[2].toFixed(2)})
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="p-4 border rounded mt-6">
            <h3 className="font-semibold mb-2">
              Зважені нормалізовані трикутні нечіткі числа
            </h3>
            <p className="text-sm text-slate-500 mb-3">
              Таблиця відображає результати множення нормалізованих значень на вагу відповідного критерію (Ci).
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-full table-auto text-sm border-collapse border">
                <thead>
                  <tr>
                    <th className="p-2 border bg-slate-50 text-center">Критерій</th>
                    {alternativeNames.map((alt, a) => (
                      <th key={a} className="p-2 border bg-slate-100 text-center">
                        {alt || `A${a + 1} `} {`wn ai${a + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {criteriaNames.map((crit, j) => {

                    let sumLw = 0, sumMw = 0, sumUw = 0;
                    for (let e = 0; e < numExperts; e++) {
                      const tri = results?.criteriaTri?.[e]?.[j] || [0, 0, 0];
                      sumLw += tri[0];
                      sumMw += tri[1];
                      sumUw += tri[2];
                    }
                    const divisor = Math.max(1, criteriaNames.length - 1);
                    const weightTri = [
                      sumLw / divisor,
                      sumMw / divisor,
                      sumUw / divisor,
                    ];


                    let maxU = 0;
                    for (let a = 0; a < alternativeNames.length; a++) {
                      let sumU = 0;
                      for (let e = 0; e < numExperts; e++) {
                        const tri = results?.altTri?.[e]?.[a]?.[j] || [0, 0, 0];
                        sumU += tri[2];
                      }
                      const avgU = sumU / Math.max(1, numExperts);
                      if (avgU > maxU) maxU = avgU;
                    }

                    return (
                      <tr key={j}>
                        <td className="p-2 border font-medium text-center">{crit || `C${j + 1}`}</td>

                        {/* 3️⃣ Перемножаємо нормалізовані числа на вагу критерію */}
                        {alternativeNames.map((_, a) => {
                          let sumL = 0, sumM = 0, sumU = 0;
                          for (let e = 0; e < numExperts; e++) {
                            const tri = results?.altTri?.[e]?.[a]?.[j] || [0, 0, 0];
                            sumL += tri[0];
                            sumM += tri[1];
                            sumU += tri[2];
                          }

                          const avgTri = [
                            sumL / Math.max(1, numExperts),
                            sumM / Math.max(1, numExperts),
                            sumU / Math.max(1, numExperts),
                          ];

                          const normTri = maxU > 0
                            ? [
                              avgTri[0] / maxU,
                              avgTri[1] / maxU,
                              avgTri[2] / maxU,
                            ]
                            : [0, 0, 0];

                          const weightedTri = [
                            normTri[0] * weightTri[0],
                            normTri[1] * weightTri[1],
                            normTri[2] * weightTri[2],
                          ];

                          return (
                            <td key={`weighted-${j}-${a}`} className="p-2 border text-center font-mono text-xs">
                              ({weightedTri[0].toFixed(3)}, {weightedTri[1].toFixed(3)}, {weightedTri[2].toFixed(3)})
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-4 border rounded mt-6">
            <h3 className="font-semibold mb-2">FPIS та FNIS</h3>
            <p className="text-sm text-slate-500 mb-3">
              Таблиця відображає максимальні (FPIS) та мінімальні (FNIS) значення по всіх альтернативах для кожного критерію, обчислені на основі зважених нормалізованих тріангулярних чисел.
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-full table-auto text-sm border-collapse border">
                <thead>
                  <tr>
                    <th className="p-2 border bg-slate-50 text-center">Критерій</th>
                    <th className="p-2 border bg-slate-100 text-center">FPIS</th>
                    <th className="p-2 border bg-slate-100 text-center">FNIS</th>
                  </tr>
                </thead>

                <tbody>
                  {criteriaNames.map((crit, j) => {
                    let fpis = Number.NEGATIVE_INFINITY;
                    let fnis = Number.POSITIVE_INFINITY;

                    alternativeNames.forEach((_, a) => {
                      let sumL = 0, sumM = 0, sumU = 0;

                      for (let e = 0; e < numExperts; e++) {
                        const tri = results?.altTri?.[e]?.[a]?.[j] || [0, 0, 0];
                        sumL += tri[0];
                        sumM += tri[1];
                        sumU += tri[2];
                      }

                      const avgTri = [
                        sumL / Math.max(1, numExperts),
                        sumM / Math.max(1, numExperts),
                        sumU / Math.max(1, numExperts),
                      ];


                      let maxU = 0;
                      for (let k = 0; k < alternativeNames.length; k++) {
                        let sumUk = 0;
                        for (let e = 0; e < numExperts; e++) {
                          const triK = results?.altTri?.[e]?.[k]?.[j] || [0, 0, 0];
                          sumUk += triK[2];
                        }
                        const avgUk = sumUk / Math.max(1, numExperts);
                        if (avgUk > maxU) maxU = avgUk;
                      }

                      const weightTri = (() => {
                        let sumLw = 0, sumMw = 0, sumUw = 0;
                        for (let e = 0; e < numExperts; e++) {
                          const tri = results?.criteriaTri?.[e]?.[j] || [0, 0, 0];
                          sumLw += tri[0]; sumMw += tri[1]; sumUw += tri[2];
                        }
                        const divisor = Math.max(1, criteriaNames.length - 1);
                        return [sumLw / divisor, sumMw / divisor, sumUw / divisor];
                      })();

                      const normTri = maxU > 0
                        ? [avgTri[0] / maxU, avgTri[1] / maxU, avgTri[2] / maxU]
                        : [0, 0, 0];

                      const weightedTri = [
                        normTri[0] * weightTri[0],
                        normTri[1] * weightTri[1],
                        normTri[2] * weightTri[2],
                      ];


                      weightedTri.forEach(val => {
                        if (val > fpis) fpis = val;
                        if (val < fnis) fnis = val;
                      });
                    });

                    return (
                      <tr key={j}>
                        <td className="p-2 border font-medium text-center">{crit || `C${j + 1}`}</td>
                        <td className="p-2 border text-center font-mono text-xs">{fpis.toFixed(3)}</td>
                        <td className="p-2 border text-center font-mono text-xs">{fnis.toFixed(3)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>


          <div className="p-4 border rounded mt-6">
            <h3 className="font-semibold mb-2">Відстані до FPIS та FNIS</h3>
            <p className="text-sm text-slate-500 mb-3">
              DFPIS — відстань до позитивного ідеального рішення (FPIS);
              DFNIS — відстань до негативного (FNIS) для кожної альтернативи по кожному критерію.
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-full table-auto text-sm border-collapse border">
                <thead>
                  <tr>
                    <th className="p-2 border bg-slate-50 text-center">Критерій</th>
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

                        let sumL = 0, sumM = 0, sumU = 0;
                        for (let e = 0; e < numExperts; e++) {
                          const tri = results?.altTri?.[e]?.[a]?.[j] || [0, 0, 0];
                          sumL += tri[0]; sumM += tri[1]; sumU += tri[2];
                        }

                        const avgTri = [
                          sumL / Math.max(1, numExperts),
                          sumM / Math.max(1, numExperts),
                          sumU / Math.max(1, numExperts),
                        ];


                        const fpis = results?.fpis?.[j] || [0, 0, 0];
                        const fnis = results?.fnis?.[j] || [0, 0, 0];


                        const dFPIS = Math.sqrt(
                          ((avgTri[0] - fpis[0]) ** 2 + (avgTri[1] - fpis[1]) ** 2 + (avgTri[2] - fpis[2]) ** 2) / 3
                        );

                        const dFNIS = Math.sqrt(
                          ((avgTri[0] - fnis[0]) ** 2 + (avgTri[1] - fnis[1]) ** 2 + (avgTri[2] - fnis[2]) ** 2) / 3
                        );

                        return (
                          <td key={`d-${j}-${a}`} className="p-2 border text-center font-mono text-xs">
                            D⁺={dFPIS.toFixed(3)}<br />D⁻={dFNIS.toFixed(3)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>






        </div>
      </div>
    </div>

  );
}
