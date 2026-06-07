import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import ShimmerPlaceholder from 'react-native-shimmer-placeholder';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 52) / 2;

const Shimmer = (props) => (
  <ShimmerPlaceholder
    LinearGradient={LinearGradient}
    shimmerColors={['#1A1A1A', '#2C2C2C', '#1A1A1A']}
    {...props}
  />
);

// Reusable sub-shapes
const S = {
  circle: (size) => <Shimmer style={{ width: size, height: size, borderRadius: size / 2 }} />,
  rect: (w, h, r = 8) => <Shimmer style={{ width: w, height: h, borderRadius: r }} />,
  pill: (w, h = 22) => <Shimmer style={{ width: w, height: h, borderRadius: h / 2 }} />,
  full: (h, r = 14) => <Shimmer style={{ width: '100%', height: h, borderRadius: r }} />,
};

// ─── Home ──────────────────────────────────────────────────────────
function HomeSkeleton() {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
      {/* Greeting */}
      <View style={{ marginBottom: 22 }}>
        {S.rect(110, 14, 7)}
        <View style={{ marginTop: 8 }}>{S.rect(200, 30, 10)}</View>
      </View>

      {/* Stay Active banner */}
      <View style={[s.card, { height: 64, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }]}>
        {S.circle(36)}
        <View style={{ gap: 7 }}>
          {S.rect(90, 14, 7)}
          {S.rect(140, 11, 5)}
        </View>
      </View>

      {/* Steps card */}
      <View style={[s.card, { marginBottom: 12, padding: 16 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          {S.circle(26)}
          {S.rect(55, 13, 6)}
        </View>
        <View style={{ flexDirection: 'row', gap: 14, marginBottom: 14 }}>
          <View style={{ gap: 6 }}>
            {S.rect(70, 22, 8)}
            {S.rect(42, 12, 5)}
          </View>
          <View style={{ width: 1, backgroundColor: '#2A2A2A', alignSelf: 'stretch' }} />
          <View style={{ gap: 6 }}>
            {S.rect(55, 22, 8)}
            {S.rect(30, 12, 5)}
          </View>
        </View>
        {/* Bar chart placeholder */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 60, gap: 8 }}>
          {[40, 55, 30, 70, 50, 65, 48].map((h, i) => (
            <Shimmer key={i} style={{ flex: 1, height: h, borderRadius: 6 }} />
          ))}
        </View>
      </View>

      {/* Calories card */}
      <View style={[s.card, { marginBottom: 12, padding: 16 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {S.circle(26)}
              {S.rect(65, 13, 6)}
            </View>
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <View style={{ gap: 6 }}>
                {S.rect(60, 22, 8)}
                {S.rect(80, 11, 5)}
              </View>
              <View style={{ width: 1, backgroundColor: '#2A2A2A' }} />
              <View style={{ gap: 6 }}>
                {S.rect(45, 22, 8)}
                {S.rect(55, 11, 5)}
              </View>
            </View>
          </View>
          {S.circle(58)}
        </View>
      </View>

      {/* BPM card */}
      <View style={[s.card, { marginBottom: 20, padding: 16 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {S.circle(26)}
              {S.rect(65, 13, 6)}
            </View>
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <View style={{ gap: 6 }}>
                {S.rect(50, 22, 8)}
                {S.rect(90, 11, 5)}
              </View>
              <View style={{ width: 1, backgroundColor: '#2A2A2A' }} />
              <View style={{ gap: 6 }}>
                {S.rect(35, 22, 8)}
                {S.rect(70, 11, 5)}
              </View>
            </View>
          </View>
          {S.rect(80, 44, 8)}
        </View>
      </View>

      {/* Insight card */}
      <View style={[s.card, { marginBottom: 12, padding: 16 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ gap: 6 }}>
            {S.rect(80, 11, 5)}
            {S.rect(60, 22, 8)}
            {S.pill(55, 20)}
          </View>
          <View style={{ width: 1, backgroundColor: '#2A2A2A' }} />
          <View style={{ gap: 6 }}>
            {S.rect(90, 11, 5)}
            {S.rect(45, 22, 8)}
            {S.rect(70, 11, 5)}
          </View>
        </View>
        {S.full(36, 10)}
      </View>

      {/* Workout card */}
      <View style={[s.card, { padding: 16 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          {S.pill(80, 22)}
          {S.rect(50, 14, 6)}
        </View>
        {S.rect(160, 20, 8)}
        <View style={{ marginTop: 8, gap: 6 }}>
          {S.full(13, 5)}
          {S.rect(200, 13, 5)}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          {S.pill(70, 26)}
          {S.pill(80, 26)}
          {S.pill(60, 26)}
        </View>
        <View style={{ marginTop: 16 }}>{S.full(46, 23)}</View>
      </View>
    </View>
  );
}

// ─── Rewards ───────────────────────────────────────────────────────
function RewardsSkeleton() {
  return (
    <View>
      {/* Wallet header */}
      <View style={[s.card, { margin: 20, padding: 20, alignItems: 'center', gap: 8 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {S.circle(32)}
          <View style={{ gap: 6 }}>
            {S.rect(50, 11, 5)}
            {S.rect(90, 28, 8)}
          </View>
        </View>
        <View style={{ marginTop: 8 }}>{S.pill(120, 26)}</View>
      </View>

      {/* Category tabs */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 20 }}>
        {[80, 60, 70, 65, 75].map((w, i) => (
          <Shimmer key={i} style={{ width: w, height: 32, borderRadius: 16 }} />
        ))}
      </View>

      {/* 2-col reward grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={[s.card, { width: CARD_WIDTH, padding: 14, gap: 10 }]}>
            {S.full(90, 12)}
            <View style={{ gap: 6 }}>
              {S.rect(100, 14, 6)}
              {S.rect(70, 11, 5)}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {S.circle(14)}
              {S.rect(55, 13, 5)}
            </View>
            {S.full(6, 3)}
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Analytics ─────────────────────────────────────────────────────
function AnalyticsSkeleton() {
  return (
    <View style={{ padding: 20, gap: 16 }}>
      {/* Period tabs */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[55, 45, 55, 40].map((w, i) => (
          <Shimmer key={i} style={{ width: w, height: 32, borderRadius: 16 }} />
        ))}
      </View>

      {/* 3 stat pills */}
      <View style={[s.card, { flexDirection: 'row', padding: 16, justifyContent: 'space-around' }]}>
        {[0, 1, 2].map(i => (
          <View key={i} style={{ alignItems: 'center', gap: 8 }}>
            {S.rect(70, 22, 8)}
            {S.rect(50, 11, 5)}
          </View>
        ))}
      </View>

      {/* Distance chart */}
      <View style={[s.card, { padding: 16 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          {S.circle(22)}
          {S.rect(100, 14, 6)}
        </View>
        {S.full(160, 12)}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((_, i) => (
            <Shimmer key={i} style={{ width: 24, height: 10, borderRadius: 5 }} />
          ))}
        </View>
      </View>

      {/* Pace chart */}
      <View style={[s.card, { padding: 16 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          {S.circle(22)}
          {S.rect(80, 14, 6)}
        </View>
        {S.full(160, 12)}
      </View>

      {/* Advanced metrics header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {S.rect(140, 16, 7)}
        {S.pill(45, 22)}
      </View>

      {/* VO2 + Consistency row */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {[0, 1].map(i => (
          <View key={i} style={[s.card, { flex: 1, padding: 16, gap: 10 }]}>
            {S.circle(44)}
            {S.rect(60, 22, 8)}
            {S.rect(80, 12, 5)}
            {S.full(6, 3)}
          </View>
        ))}
      </View>

      {/* Recovery card */}
      <View style={[s.card, { padding: 16, gap: 12 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            {S.rect(44, 44, 12)}
            <View style={{ gap: 6 }}>
              {S.rect(100, 14, 6)}
              {S.rect(70, 11, 5)}
            </View>
          </View>
          {S.rect(50, 34, 8)}
        </View>
        {S.full(10, 5)}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {[40, 35, 40, 35].map((w, i) => (
            <Shimmer key={i} style={{ width: w, height: 10, borderRadius: 4 }} />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Plan ──────────────────────────────────────────────────────────
function PlanSkeleton() {
  return (
    <View style={{ padding: 20, gap: 16 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ gap: 7 }}>
          {S.rect(80, 12, 5)}
          {S.rect(150, 24, 8)}
        </View>
        {S.rect(100, 36, 18)}
      </View>

      {/* Calendar rail */}
      <View style={[s.card, { flexDirection: 'row', padding: 12, gap: 6, justifyContent: 'space-between' }]}>
        {Array.from({ length: 7 }).map((_, i) => (
          <View key={i} style={{ alignItems: 'center', gap: 7 }}>
            {S.rect(24, 11, 5)}
            <Shimmer style={{ width: 42, height: 66, borderRadius: 16 }} />
          </View>
        ))}
      </View>

      {/* Workout card */}
      <View style={[s.card, { flexDirection: 'row', overflow: 'hidden' }]}>
        <View style={{ width: 4, backgroundColor: '#2A2A2A' }} />
        <View style={{ flex: 1, padding: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {S.circle(44)}
            <View style={{ gap: 7, flex: 1 }}>
              {S.pill(60, 22)}
              {S.rect(120, 16, 7)}
            </View>
          </View>
          {S.full(13, 5)}
          {S.rect(200, 13, 5)}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {S.pill(70, 26)}
            {S.pill(80, 26)}
            {S.pill(55, 26)}
          </View>
          {S.full(46, 23)}
        </View>
      </View>

      {/* Habit cards */}
      {[0, 1].map(i => (
        <View key={i} style={[s.card, { flexDirection: 'row', overflow: 'hidden' }]}>
          <View style={{ width: 3, backgroundColor: '#2A2A2A' }} />
          <View style={{ flex: 1, padding: 14, gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                {S.circle(36)}
                <View style={{ gap: 6 }}>
                  {S.rect(100, 14, 6)}
                  {S.rect(70, 11, 5)}
                </View>
              </View>
              {S.rect(36, 36, 10)}
            </View>
            {S.full(8, 4)}
          </View>
        </View>
      ))}

      {/* Upcoming section */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {S.rect(130, 14, 6)}
        {S.pill(30, 20)}
      </View>
      {[0, 1, 2].map(i => (
        <View key={i} style={[s.card, { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }]}>
          {S.circle(8)}
          {S.rect(36, 36, 10)}
          <View style={{ flex: 1, gap: 6 }}>
            {S.rect(80, 13, 5)}
            {S.rect(110, 11, 5)}
          </View>
          {S.pill(50, 22)}
        </View>
      ))}
    </View>
  );
}

// ─── Gear ──────────────────────────────────────────────────────────
function GearSkeleton() {
  return (
    <View style={{ padding: 20, gap: 16 }}>
      {/* Summary hero strip */}
      <View style={[s.card, { flexDirection: 'row', padding: 16, justifyContent: 'space-around' }]}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={{ alignItems: 'center', gap: 8 }}>
            {S.rect(45, 22, 8)}
            {S.rect(50, 11, 5)}
          </View>
        ))}
      </View>

      {/* Gear cards */}
      {[0, 1].map(i => (
        <View key={i} style={[s.card, { padding: 16, gap: 14 }]}>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            {S.circle(60)}
            <View style={{ flex: 1, gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                {S.rect(110, 16, 7)}
                {S.pill(50, 22)}
              </View>
              {S.rect(80, 12, 5)}
              {S.pill(90, 22)}
            </View>
          </View>
          {/* Progress bar */}
          <View style={{ gap: 8 }}>
            {S.full(10, 5)}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {S.rect(60, 11, 5)}
              {S.rect(80, 11, 5)}
            </View>
          </View>
          {/* Stats row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            {[0, 1, 2, 3].map(j => (
              <View key={j} style={{ alignItems: 'center', gap: 6 }}>
                {S.rect(40, 16, 6)}
                {S.rect(50, 11, 5)}
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Profile ───────────────────────────────────────────────────────
function ProfileSkeleton() {
  return (
    <View>
      {/* Cover + avatar */}
      <Shimmer style={{ width: '100%', height: 160 }} />
      <View style={{ alignItems: 'center', marginTop: -40, paddingBottom: 20 }}>
        <Shimmer style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#000' }} />
        <View style={{ marginTop: 12, gap: 8, alignItems: 'center' }}>
          {S.rect(140, 20, 8)}
          {S.rect(100, 14, 6)}
          {S.pill(80, 26)}
        </View>
      </View>

      {/* Stats row */}
      <View style={[s.card, { flexDirection: 'row', marginHorizontal: 20, padding: 16, justifyContent: 'space-around', marginBottom: 20 }]}>
        {[0, 1, 2].map(i => (
          <View key={i} style={{ alignItems: 'center', gap: 8 }}>
            {S.rect(55, 22, 8)}
            {S.rect(50, 12, 5)}
          </View>
        ))}
      </View>

      {/* Run history rows */}
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={[s.rowContainer, { paddingHorizontal: 20 }]}>
          <Shimmer style={{ width: 44, height: 44, borderRadius: 12 }} />
          <View style={{ marginLeft: 14, flex: 1, gap: 7 }}>
            {S.rect('70%', 14, 6)}
            {S.rect('45%', 12, 5)}
          </View>
          {S.rect(45, 14, 6)}
        </View>
      ))}
    </View>
  );
}

// ─── Leaderboard ───────────────────────────────────────────────────
function LeaderboardSkeleton({ count = 8 }) {
  return (
    <View style={{ padding: 20, gap: 4 }}>
      {/* Podium row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', marginBottom: 24, gap: 12 }}>
        {[{ h: 90, s: 60 }, { h: 120, s: 72 }, { h: 75, s: 54 }].map((item, i) => (
          <View key={i} style={{ alignItems: 'center', gap: 8 }}>
            {S.circle(item.s)}
            {S.rect(60, 11, 5)}
            <Shimmer style={{ width: 70, height: item.h, borderRadius: 10 }} />
          </View>
        ))}
      </View>

      {/* List rows */}
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[s.rowContainer, { borderBottomWidth: 1, borderBottomColor: '#1A1A1A', paddingBottom: 14, marginBottom: 0 }]}>
          {S.rect(24, 16, 6)}
          <Shimmer style={{ width: 44, height: 44, borderRadius: 22, marginLeft: 14 }} />
          <View style={{ marginLeft: 12, flex: 1, gap: 7 }}>
            {S.rect('60%', 14, 6)}
            {S.rect('40%', 11, 5)}
          </View>
          {S.rect(50, 16, 6)}
        </View>
      ))}
    </View>
  );
}

// ─── Main export ───────────────────────────────────────────────────
export default function SkeletonCard({ variant = 'card', count = 1 }) {
  const items = Array.from({ length: count });

  if (variant === 'home')        return <HomeSkeleton />;
  if (variant === 'rewards')     return <RewardsSkeleton />;
  if (variant === 'analytics')   return <AnalyticsSkeleton />;
  if (variant === 'plan')        return <PlanSkeleton />;
  if (variant === 'gear')        return <GearSkeleton />;
  if (variant === 'profile')     return <ProfileSkeleton />;
  if (variant === 'leaderboard') return <LeaderboardSkeleton count={count} />;

  if (variant === 'chart') {
    return (
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          {S.circle(22)}
          {S.rect(100, 14, 6)}
        </View>
        {S.full(180, 16)}
      </View>
    );
  }

  if (variant === 'row') {
    return items.map((_, i) => (
      <View key={i} style={s.rowContainer}>
        {S.circle(40)}
        <View style={{ marginLeft: 14, flex: 1, gap: 7 }}>
          {S.rect('70%', 14, 6)}
          {S.rect('45%', 12, 5)}
        </View>
      </View>
    ));
  }

  if (variant === 'post') {
    return items.map((_, i) => (
      <View key={i} style={{ padding: 16, marginBottom: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          {S.circle(40)}
          <View style={{ marginLeft: 12, gap: 7 }}>
            {S.rect(120, 14, 6)}
            {S.rect(60, 10, 4)}
          </View>
        </View>
        {S.rect('90%', 14, 6)}
        <View style={{ marginTop: 10 }}>{S.full(140, 12)}</View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
          {S.pill(60, 16)}
          {S.pill(60, 16)}
          {S.pill(60, 16)}
        </View>
      </View>
    ));
  }

  if (variant === 'chat') {
    return (
      <View style={{ padding: 16, gap: 20 }}>
        <View style={{ flexDirection: 'row' }}>
          {S.circle(28)}
          <View style={{ marginLeft: 8 }}>{S.rect(width * 0.65, 60, 16)}</View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          {S.rect(width * 0.5, 36, 16)}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {S.circle(28)}
          <View style={{ marginLeft: 4, flexDirection: 'row', gap: 4 }}>
            {S.circle(8)}{S.circle(8)}{S.circle(8)}
          </View>
        </View>
      </View>
    );
  }

  // Default 'card'
  return items.map((_, i) => (
    <View key={i} style={s.cardContainer}>
      <Shimmer style={{ width: 44, height: 44, borderRadius: 12 }} />
      <View style={{ marginLeft: 14, flex: 1, gap: 8 }}>
        {S.rect('78%', 16, 7)}
        {S.rect('52%', 12, 5)}
      </View>
    </View>
  ));
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#0E0E0E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 8,
  },
});
