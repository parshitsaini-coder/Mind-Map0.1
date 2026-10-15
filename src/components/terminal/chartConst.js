// Constants shared by the chart and its layers.
import { tzOffsetSec } from '../../lib/terminal/chartSettings'

// Seconds added to candle times so the chart's UTC axis shows wall-clock time in the chosen zone.
// A live binding: setTz() (called by ChartView when the time-zone setting changes) updates it for
// every layer that imports it (IndicatorLayer, DrawingLayer, ...).
export let TZ = tzOffsetSec('local')
export const setTz = (tz) => { TZ = tzOffsetSec(tz); return TZ }
