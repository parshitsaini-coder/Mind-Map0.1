import * as S from '../src/utils/stats.js'
const v=[2,4,4,4,5,5,7,9]
console.log('mean',S.mean(v),'exp 5')
console.log('stdevPop',S.stdevPop(v).toFixed(4),'exp 2.0000')
console.log('stdev(sample)',S.stdev(v).toFixed(4),'exp 2.1381')
console.log('median',S.median(v),'exp 4.5')
console.log('p25',S.percentile(v,25),'exp 4')
console.log('p95',S.percentile(v,95).toFixed(3))
console.log('q',JSON.stringify(S.quartiles(v)))
console.log('skew',S.skewness(v).toFixed(4))
console.log('kurt',S.kurtosis(v).toFixed(4))
console.log('corr',S.correlation([1,2,3,4,5],[2,4,6,8,10]),'exp 1')
console.log('corr neg',S.correlation([1,2,3,4,5],[10,8,6,4,2]),'exp -1')
console.log('trend',JSON.stringify(S.linearTrend([1,2,3,4,5])),'exp slope1')
console.log('normalCdf(0)',S.normalCdf(0),'exp .5')
console.log('normalCdf(1.96)',S.normalCdf(1.96).toFixed(4),'exp .9750')
console.log('normalCdf(-1)',S.normalCdf(-1).toFixed(4),'exp .1587')
const r=S.seededRandom(42); const a=[r(),r(),r()]
const r2=S.seededRandom(42); const b=[r2(),r2(),r2()]
console.log('seeded reproducible', JSON.stringify(a)===JSON.stringify(b))
console.log('hist',JSON.stringify(S.histogram([1,2,3,10],4)))
console.log('dd',S.downsideDeviation([-2,3,-4,5],0).toFixed(4))
console.log('safeDiv',S.safeDiv(1,0),S.safeDiv(4,2))
