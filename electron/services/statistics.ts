import * as ss from 'simple-statistics'
import { jStat } from 'jstat'

interface DescriptiveResult {
  count: number
  mean: number
  median: number
  mode: number
  standardDeviation: number
  variance: number
  min: number
  max: number
  range: number
  q1: number
  q3: number
  iqr: number
  skewness: number
  kurtosis: number
  sum: number
}

interface TTestResult {
  testStatistic: number
  pValue: number
  degreesOfFreedom: number
  confidenceInterval: [number, number]
  meanDifference: number
  significant: boolean
}

interface AnovaResult {
  fStatistic: number
  pValue: number
  dfBetween: number
  dfWithin: number
  ssBetween: number
  ssWithin: number
  msBetween: number
  msWithin: number
  significant: boolean
}

interface ChiSquareResult {
  testStatistic: number
  pValue: number
  degreesOfFreedom: number
  significant: boolean
}

interface CorrelationResult {
  r: number
  rSquared: number
  pValue: number
  significant: boolean
  interpretation: string
}

interface RegressionResult {
  slope: number
  intercept: number
  rSquared: number
  standardError: number
  predictions: number[]
  residuals: number[]
  equation: string
}

export class StatisticsService {
  descriptiveStats(data: number[]): DescriptiveResult {
    if (data.length === 0) {
      throw new Error('Cannot compute statistics on empty data')
    }

    const sorted = [...data].sort((a, b) => a - b)

    return {
      count: data.length,
      mean: ss.mean(data),
      median: ss.median(sorted),
      mode: ss.mode(data) as number,
      standardDeviation: data.length > 1 ? ss.standardDeviation(data) : 0,
      variance: data.length > 1 ? ss.variance(data) : 0,
      min: ss.min(data),
      max: ss.max(data),
      range: ss.max(data) - ss.min(data),
      q1: ss.quantile(sorted, 0.25),
      q3: ss.quantile(sorted, 0.75),
      iqr: ss.interquartileRange(sorted),
      skewness: data.length > 2 ? ss.sampleSkewness(data) : 0,
      kurtosis: data.length > 3 ? ss.sampleKurtosis(data) : 0,
      sum: ss.sum(data)
    }
  }

  tTest(sample1: number[], sample2: number[]): TTestResult {
    if (sample1.length < 2 || sample2.length < 2) {
      throw new Error('Each sample must have at least 2 observations')
    }

    const mean1 = ss.mean(sample1)
    const mean2 = ss.mean(sample2)
    const var1 = ss.variance(sample1)
    const var2 = ss.variance(sample2)
    const n1 = sample1.length
    const n2 = sample2.length

    // Welch's t-test (does not assume equal variances)
    const se = Math.sqrt(var1 / n1 + var2 / n2)
    const tStat = (mean1 - mean2) / se

    // Welch-Satterthwaite degrees of freedom
    const dfNum = Math.pow(var1 / n1 + var2 / n2, 2)
    const dfDen =
      Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1)
    const df = dfNum / dfDen

    // Two-tailed p-value using jStat
    const pValue = 2 * (1 - jStat.studentt.cdf(Math.abs(tStat), df))

    // 95% confidence interval for the difference of means
    const tCrit = jStat.studentt.inv(0.975, df)
    const meanDiff = mean1 - mean2
    const ci: [number, number] = [meanDiff - tCrit * se, meanDiff + tCrit * se]

    return {
      testStatistic: tStat,
      pValue,
      degreesOfFreedom: df,
      confidenceInterval: ci,
      meanDifference: meanDiff,
      significant: pValue < 0.05
    }
  }

  pairedTTest(sample1: number[], sample2: number[]): TTestResult {
    if (sample1.length !== sample2.length) {
      throw new Error('Paired samples must have equal length')
    }
    if (sample1.length < 2) {
      throw new Error('Each sample must have at least 2 observations')
    }

    const differences = sample1.map((x, i) => x - sample2[i])
    const meanDiff = ss.mean(differences)
    const sdDiff = ss.standardDeviation(differences)
    const n = differences.length
    const se = sdDiff / Math.sqrt(n)
    const tStat = meanDiff / se
    const df = n - 1

    const pValue = 2 * (1 - jStat.studentt.cdf(Math.abs(tStat), df))
    const tCrit = jStat.studentt.inv(0.975, df)
    const ci: [number, number] = [meanDiff - tCrit * se, meanDiff + tCrit * se]

    return {
      testStatistic: tStat,
      pValue,
      degreesOfFreedom: df,
      confidenceInterval: ci,
      meanDifference: meanDiff,
      significant: pValue < 0.05
    }
  }

  anova(groups: number[][]): AnovaResult {
    if (groups.length < 2) {
      throw new Error('ANOVA requires at least 2 groups')
    }
    for (const group of groups) {
      if (group.length < 1) {
        throw new Error('Each group must have at least 1 observation')
      }
    }

    const k = groups.length
    const allData = groups.flat()
    const grandMean = ss.mean(allData)
    const totalN = allData.length

    // Between-group sum of squares
    let ssBetween = 0
    for (const group of groups) {
      const groupMean = ss.mean(group)
      ssBetween += group.length * Math.pow(groupMean - grandMean, 2)
    }

    // Within-group sum of squares
    let ssWithin = 0
    for (const group of groups) {
      const groupMean = ss.mean(group)
      for (const value of group) {
        ssWithin += Math.pow(value - groupMean, 2)
      }
    }

    const dfBetween = k - 1
    const dfWithin = totalN - k

    if (dfWithin <= 0) {
      throw new Error('Insufficient data: degrees of freedom within groups must be positive')
    }

    const msBetween = ssBetween / dfBetween
    const msWithin = ssWithin / dfWithin
    const fStat = msBetween / msWithin

    // p-value from F-distribution
    const pValue = 1 - jStat.centralF.cdf(fStat, dfBetween, dfWithin)

    return {
      fStatistic: fStat,
      pValue,
      dfBetween,
      dfWithin,
      ssBetween,
      ssWithin,
      msBetween,
      msWithin,
      significant: pValue < 0.05
    }
  }

  chiSquare(observed: number[], expected: number[]): ChiSquareResult {
    if (observed.length !== expected.length) {
      throw new Error('Observed and expected arrays must have equal length')
    }
    if (observed.length < 2) {
      throw new Error('Chi-square test requires at least 2 categories')
    }

    let chiSq = 0
    for (let i = 0; i < observed.length; i++) {
      if (expected[i] === 0) {
        throw new Error('Expected frequencies cannot be zero')
      }
      chiSq += Math.pow(observed[i] - expected[i], 2) / expected[i]
    }

    const df = observed.length - 1
    const pValue = 1 - jStat.chisquare.cdf(chiSq, df)

    return {
      testStatistic: chiSq,
      pValue,
      degreesOfFreedom: df,
      significant: pValue < 0.05
    }
  }

  correlation(x: number[], y: number[]): CorrelationResult {
    if (x.length !== y.length) {
      throw new Error('Arrays must have equal length')
    }
    if (x.length < 3) {
      throw new Error('Correlation requires at least 3 data points')
    }

    const r = ss.sampleCorrelation(x, y)
    const n = x.length
    const rSquared = r * r

    // Test significance of correlation using t-distribution
    const tStat = r * Math.sqrt((n - 2) / (1 - rSquared))
    const df = n - 2
    const pValue = 2 * (1 - jStat.studentt.cdf(Math.abs(tStat), df))

    let interpretation: string
    const absR = Math.abs(r)
    if (absR >= 0.9) interpretation = 'very strong'
    else if (absR >= 0.7) interpretation = 'strong'
    else if (absR >= 0.5) interpretation = 'moderate'
    else if (absR >= 0.3) interpretation = 'weak'
    else interpretation = 'very weak / negligible'

    if (r < 0) interpretation = `negative ${interpretation}`
    else interpretation = `positive ${interpretation}`

    return {
      r,
      rSquared,
      pValue,
      significant: pValue < 0.05,
      interpretation
    }
  }

  linearRegression(x: number[], y: number[]): RegressionResult {
    if (x.length !== y.length) {
      throw new Error('Arrays must have equal length')
    }
    if (x.length < 2) {
      throw new Error('Linear regression requires at least 2 data points')
    }

    const regression = ss.linearRegression(x.map((xi, i) => [xi, y[i]]))
    const regressionLine = ss.linearRegressionLine(regression)

    const predictions = x.map((xi) => regressionLine(xi))
    const residuals = y.map((yi, i) => yi - predictions[i])

    // R-squared
    const yMean = ss.mean(y)
    const ssRes = ss.sum(residuals.map((r) => r * r))
    const ssTot = ss.sum(y.map((yi) => Math.pow(yi - yMean, 2)))
    const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot

    // Standard error of the estimate
    const n = x.length
    const se = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0

    return {
      slope: regression.m,
      intercept: regression.b,
      rSquared,
      standardError: se,
      predictions,
      residuals,
      equation: `y = ${regression.m.toFixed(4)}x + ${regression.b.toFixed(4)}`
    }
  }
}

// Singleton instance
export const statisticsService = new StatisticsService()
