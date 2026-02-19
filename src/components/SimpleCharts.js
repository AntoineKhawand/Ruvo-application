import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';

export const SimpleBarChart = ({ data, width, height, barColor = '#CCFF00', labels = [] }) => {
    if (!data || data.length === 0) return null;

    const maxValue = Math.max(...data, 1); // Avoid division by zero
    const barWidth = (width - 40) / data.length;
    const chartHeight = height - 40; // Leave space for labels

    return (
        <View style={{ width, height }}>
            <Svg width={width} height={height}>
                {/* BARS */}
                {data.map((value, index) => {
                    const barHeight = (value / maxValue) * chartHeight;
                    const x = 20 + index * barWidth + (barWidth - 10) / 2; // Centered
                    const y = chartHeight - barHeight;

                    return (
                        <React.Fragment key={index}>
                            <Rect
                                x={x}
                                y={y}
                                width={12}
                                height={barHeight}
                                fill={barColor}
                                rx={4}
                            />
                            {/* Value Label on Top (Optional) */}
                            {value > 0 && (
                                <SvgText
                                    x={x + 6}
                                    y={y - 8}
                                    fill="#FFF"
                                    fontSize="10"
                                    textAnchor="middle"
                                >
                                    {value.toFixed(1)}
                                </SvgText>
                            )}
                            {/* X-Axis Label */}
                            <SvgText
                                x={x + 6}
                                y={chartHeight + 20}
                                fill="#666"
                                fontSize="10"
                                textAnchor="middle"
                            >
                                {labels[index] || ''}
                            </SvgText>
                        </React.Fragment>
                    );
                })}
            </Svg>
        </View>
    );
};

export const SimpleLineChart = ({ data, width, height, lineColor = '#FFD700', labels = [] }) => {
    if (!data || data.length === 0) return null;

    const maxValue = Math.max(...data, 1);
    const minValue = Math.min(...data.filter(v => v > 0)); // Filter out zeros for min scaling if desired
    const range = maxValue - (minValue > 0 ? minValue * 0.8 : 0); // Dynamic range

    const stepX = (width - 40) / (data.length - 1);
    const chartHeight = height - 40;

    // Helper to get Y coordinate
    const getY = (val) => chartHeight - ((val / maxValue) * chartHeight);

    // Build Path
    let pathD = `M 20 ${getY(data[0])}`;
    data.forEach((val, i) => {
        if (i === 0) return;
        pathD += ` L ${20 + i * stepX} ${getY(val)}`;
    });

    return (
        <View style={{ width, height }}>
            <Svg width={width} height={height}>
                {/* LINE PATH */}
                <Path
                    d={pathD}
                    stroke={lineColor}
                    strokeWidth="3"
                    fill="none"
                />

                {/* DOTS & LABELS */}
                {data.map((value, index) => {
                    const x = 20 + index * stepX;
                    const y = getY(value);

                    return (
                        <React.Fragment key={index}>
                            <Circle
                                cx={x}
                                cy={y}
                                r="4"
                                fill={lineColor}
                                stroke="#1C1C1E"
                                strokeWidth="2"
                            />
                            {/* X-Axis Label (show fewer for density if many points) */}
                            {labels[index] ? (
                                <SvgText
                                    x={x}
                                    y={chartHeight + 20}
                                    fill="#666"
                                    fontSize="10"
                                    textAnchor="middle"
                                >
                                    {labels[index]}
                                </SvgText>
                            ) : null}
                        </React.Fragment>
                    );
                })}
            </Svg>
        </View>
    );
};
