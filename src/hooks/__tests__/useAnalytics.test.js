/* eslint-env jest */
import * as React from 'react';
import TestRenderer from 'react-test-renderer';
import { useAnalytics } from '../useAnalytics';

// Mock format helpers if needed, but integration testing the hook with real utils is better here as they are pure logic.
// However, ensure formatting matches expectations.

// Helper component to capture hook result
function TestComponent({ runHistory, userData, onResult }) {
    const result = useAnalytics(runHistory, userData);
    React.useEffect(() => {
        onResult(result);
    });
    return null;
}

describe('useAnalytics', () => {
    const renderAnalytics = (runHistory, userData = { unitSystem: 'metric' }) => {
        let result;
        TestRenderer.create(
            <TestComponent
                runHistory={runHistory}
                userData={userData}
                onResult={(res) => { result = res; }}
            />
        );
        return result;
    };

    it('returns default values for empty history', () => {
        const analytics = renderAnalytics([]);
        expect(analytics.vo2Max).toBe('N/A');
        expect(analytics.consistencyScore).toBe("0.0");
        expect(analytics.lifetime.distance).toBe("0.0");
        expect(analytics.lifetime.runs).toBe(0);
        expect(analytics.lifetime.elevation).toBe(0);
    });

    it('calculates lifetime stats correctly', () => {
        const runHistory = [
            { distance: '5', duration: '00:30:00', heartRate: '150', date: '2023-01-01', calories: '300', elevationGain: '50' },
            { distance: '10', duration: '01:00:00', heartRate: '160', date: '2023-01-03', calories: '600', elevationGain: '100' }
        ];
        const analytics = renderAnalytics(runHistory);

        // Total 15km
        expect(analytics.lifetime.distance).toBe('15.0');
        expect(analytics.lifetime.runs).toBe(2);
        // Total duration 1.5h = 1h rounded? floor(90min / 60) = 1
        // Code says: Math.floor(totalDurationSec / 3600)
        expect(analytics.lifetime.duration).toBe(1);
        expect(analytics.lifetime.elevation).toBe(150);
    });

    it('calculates consistency score (runs per week)', () => {
        // Consistency is avg runs/week over last 4 weeks (28 days) from NOW.
        // We need to mock Date to test this deterministically, or provide recent dates.
        const now = new Date();
        const oneDay = 24 * 60 * 60 * 1000;

        const runHistory = [
            { distance: '5', duration: '00:30:00', heartRate: '150', date: new Date(now - oneDay).toISOString() },
            { distance: '5', duration: '00:30:00', heartRate: '150', date: new Date(now - 3 * oneDay).toISOString() },
            { distance: '5', duration: '00:30:00', heartRate: '150', date: new Date(now - 10 * oneDay).toISOString() }
        ];

        // 3 runs in last 28 days / 4 = 0.75 -> "0.8"
        const analytics = renderAnalytics(runHistory);
        expect(analytics.consistencyScore).toBe("0.8");
    });

    it('calculates estimated VO2 Max', () => {
        const runHistory = [
            // 10km in 1 hour = 10km/h. HR 150.
            // Formula: 15 + (10 * 3.5) + (200 - 150) * 0.15
            // 15 + 35 + (50 * 0.15) = 50 + 7.5 = 57.5 -> 58
            { distance: '10', duration: '01:00:00', heartRate: '150', date: '2023-01-01' }
        ];
        const analytics = renderAnalytics(runHistory);
        expect(analytics.vo2Max).toBe('58');
    });

});
