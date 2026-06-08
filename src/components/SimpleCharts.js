import React from 'react';
import { View } from 'react-native';
import Svg, {
    Circle, Defs, LinearGradient as SvgGradient,
    Path, Rect, Stop, Text as SvgText, Line,
} from 'react-native-svg';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PADDING = { top: 16, right: 12, bottom: 28, left: 36 };

const buildPlotArea = (svgWidth, svgHeight) => ({
    x: PADDING.left,
    y: PADDING.top,
    w: svgWidth - PADDING.left - PADDING.right,
    h: svgHeight - PADDING.top - PADDING.bottom,
});

const niceMax = (raw) => {
    if (raw <= 0) return 10;
    const exp = Math.pow(10, Math.floor(Math.log10(raw)));
    const frac = raw / exp;
    const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
    return nice * exp;
};

const formatLabel = (val, decimals = 1) => {
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return Number.isInteger(val) ? String(val) : val.toFixed(decimals);
};

// Smooth cubic-bezier path through an array of {x, y} points
const smoothPath = (pts) => {
    if (pts.length < 2) return pts.length === 1 ? `M${pts[0].x},${pts[0].y}` : '';
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1];
        const p1 = pts[i];
        const cpx = (p0.x + p1.x) / 2;
        d += ` C${cpx},${p0.y} ${cpx},${p1.y} ${p1.x},${p1.y}`;
    }
    return d;
};

// ─── Grid lines ───────────────────────────────────────────────────────────────

const Grid = ({ plot, ticks }) => (
    <>
        {ticks.map((t, i) => (
            <Line
                key={i}
                x1={plot.x}
                y1={plot.y + plot.h - t.ratio * plot.h}
                x2={plot.x + plot.w}
                y2={plot.y + plot.h - t.ratio * plot.h}
                stroke="#1E1E1E"
                strokeWidth="1"
            />
        ))}
    </>
);

// ─── Y-axis labels ────────────────────────────────────────────────────────────

const YAxis = ({ plot, ticks }) => (
    <>
        {ticks.map((t, i) => (
            <SvgText
                key={i}
                x={plot.x - 5}
                y={plot.y + plot.h - t.ratio * plot.h + 4}
                fill="#444"
                fontSize="9"
                textAnchor="end"
                fontFamily="System"
            >
                {t.label}
            </SvgText>
        ))}
    </>
);

const buildTicks = (maxVal, count = 4) => {
    const step = maxVal / count;
    return Array.from({ length: count + 1 }, (_, i) => ({
        ratio: i / count,
        label: formatLabel(step * i),
    }));
};

// ─── SimpleBarChart ───────────────────────────────────────────────────────────

export const SimpleBarChart = ({
    data,
    labels = [],
    width: svgWidth = 300,
    height: svgHeight = 200,
    barColor = '#CCFF00',
    gradientId = 'barGrad',
}) => {
    if (!data || data.length === 0) return null;

    const plot = buildPlotArea(svgWidth, svgHeight);
    const maxVal = niceMax(Math.max(...data));
    const ticks = buildTicks(maxVal, 3);

    const totalBars = data.length;
    const gap = Math.max(2, plot.w / totalBars * 0.25);
    const barW = (plot.w - gap * (totalBars - 1)) / totalBars;

    return (
        <View>
            <Svg width={svgWidth} height={svgHeight}>
                <Defs>
                    <SvgGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor={barColor} stopOpacity="1" />
                        <Stop offset="100%" stopColor={barColor} stopOpacity="0.25" />
                    </SvgGradient>
                </Defs>

                <Grid plot={plot} ticks={ticks} />
                <YAxis plot={plot} ticks={ticks} />

                {data.map((val, i) => {
                    const bh = (val / maxVal) * plot.h;
                    const bx = plot.x + i * (barW + gap);
                    const by = plot.y + plot.h - bh;

                    return (
                        <React.Fragment key={i}>
                            {val > 0 && (
                                <Rect
                                    x={bx}
                                    y={by}
                                    width={barW}
                                    height={bh}
                                    fill={`url(#${gradientId})`}
                                    rx={Math.min(4, barW / 2)}
                                />
                            )}
                            {labels[i] ? (
                                <SvgText
                                    x={bx + barW / 2}
                                    y={svgHeight - 6}
                                    fill="#444"
                                    fontSize="9"
                                    textAnchor="middle"
                                    fontFamily="System"
                                >
                                    {labels[i]}
                                </SvgText>
                            ) : null}
                        </React.Fragment>
                    );
                })}

                {/* Baseline */}
                <Line
                    x1={plot.x}
                    y1={plot.y + plot.h}
                    x2={plot.x + plot.w}
                    y2={plot.y + plot.h}
                    stroke="#2A2A2A"
                    strokeWidth="1"
                />
            </Svg>
        </View>
    );
};

// ─── SimpleLineChart ──────────────────────────────────────────────────────────

export const SimpleLineChart = ({
    data,
    labels = [],
    width: svgWidth = 300,
    height: svgHeight = 200,
    lineColor = '#FFD700',
    gradientId = 'lineGrad',
}) => {
    if (!data || data.length === 0) return null;

    const nonZero = data.filter(v => v > 0);
    const allZero = nonZero.length === 0;

    const plot = buildPlotArea(svgWidth, svgHeight);
    const maxVal = niceMax(allZero ? 10 : Math.max(...nonZero));
    const ticks = buildTicks(maxVal, 3);

    const step = plot.w / Math.max(data.length - 1, 1);

    const points = data.map((val, i) => ({
        x: plot.x + i * step,
        y: allZero ? plot.y + plot.h : plot.y + plot.h - (val / maxVal) * plot.h,
        val,
    }));

    const linePath = smoothPath(points);
    const areaPath = allZero
        ? ''
        : `${linePath} L${points[points.length - 1].x},${plot.y + plot.h} L${points[0].x},${plot.y + plot.h} Z`;

    return (
        <View>
            <Svg width={svgWidth} height={svgHeight}>
                <Defs>
                    <SvgGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor={lineColor} stopOpacity="0.35" />
                        <Stop offset="100%" stopColor={lineColor} stopOpacity="0" />
                    </SvgGradient>
                </Defs>

                <Grid plot={plot} ticks={ticks} />
                <YAxis plot={plot} ticks={ticks} />

                {/* Area fill */}
                {!allZero && (
                    <Path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
                )}

                {/* Line */}
                <Path
                    d={linePath}
                    stroke={allZero ? '#2A2A2A' : lineColor}
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />

                {/* Dots + labels */}
                {points.map((pt, i) => (
                    <React.Fragment key={i}>
                        {pt.val > 0 && (
                            <Circle
                                cx={pt.x}
                                cy={pt.y}
                                r="3.5"
                                fill={lineColor}
                                stroke="#0A0A0A"
                                strokeWidth="2"
                            />
                        )}
                        {labels[i] ? (
                            <SvgText
                                x={pt.x}
                                y={svgHeight - 6}
                                fill="#444"
                                fontSize="9"
                                textAnchor="middle"
                                fontFamily="System"
                            >
                                {labels[i]}
                            </SvgText>
                        ) : null}
                    </React.Fragment>
                ))}

                {/* Baseline */}
                <Line
                    x1={plot.x}
                    y1={plot.y + plot.h}
                    x2={plot.x + plot.w}
                    y2={plot.y + plot.h}
                    stroke="#2A2A2A"
                    strokeWidth="1"
                />
            </Svg>
        </View>
    );
};
