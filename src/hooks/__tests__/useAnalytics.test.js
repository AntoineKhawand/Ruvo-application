/* eslint-env jest */
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const { useAnalytics } = require('../useAnalytics');

// React 19 compatible hook testing: use renderToString for synchronous capture
let _hookResult = null;
function HookCapture({ runHistory, userData }) {
    _hookResult = useAnalytics(runHistory, userData);
    return null;
}

describe('useAnalytics', () => {
    const renderAnalytics = (runHistory, userData = { unitSystem: 'metric' }) => {
        _hookResult = null;
        ReactDOMServer.renderToString(
            React.createElement(HookCapture, { runHistory, userData })
        );
        return _hookResult;
    };

    it('returns default values for empty history', () => {
        const analytics = renderAnalytics([]);
        expect(analytics.vo2Max).toBe('N/A');
        expect(analytics.consistencyScore).toBe("0.0");
        // formatDistance returns "0.00 km" for metric
        expect(analytics.lifetime.distance).toBe("0.00 km");
        expect(analytics.lifetime.runs).toBe(0);
        expect(analytics.lifetime.elevation).toBe(0);
    });

    it('calculates lifetime stats correctly', () => {
        const runHistory = [
            { distance: '5', duration: '00:30:00', heartRate: '150', date: '2023-01-01', calories: '300', elevationGain: '50' },
            { distance: '10', duration: '01:00:00', heartRate: '160', date: '2023-01-03', calories: '600', elevationGain: '100' }
        ];
        const analytics = renderAnalytics(runHistory);

        // Total 15km — formatDistance returns "15.00 km"
        expect(analytics.lifetime.distance).toBe('15.00 km');
        expect(analytics.lifetime.runs).toBe(2);
        // Total duration 1.5h => floor(90min / 60) = 1
        expect(analytics.lifetime.duration).toBe(1);
        expect(analytics.lifetime.elevation).toBe(150);
    });

    it('calculates consistency score (runs per week)', () => {
        // Consistency is avg runs/week over last 4 weeks (28 days) from NOW.
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
