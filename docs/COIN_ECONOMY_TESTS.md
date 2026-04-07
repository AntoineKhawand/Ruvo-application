# Coin Economy Test Results

## Test A.1.1: Coin Earning Rate Validation

### Base Formula
```
Base = Distance (km) × 10 coins/km
```

### Bonus Multipliers

#### 1. Pace Bonus
| Pace (min/km) | Multiplier | Example (5km) |
|---------------|------------|---------------|
| < 5:00 (Elite) | +20% | 50 + 10 = 60 |
| 5:00 - 5:59 (Fast) | +15% | 50 + 8 = 58 |
| 6:00 - 6:59 (Moderate) | +10% | 50 + 5 = 55 |
| 7:00 - 7:59 (Easy) | +5% | 50 + 3 = 53 |
| >= 8:00 (Slow) | 0% | 50 |

#### 2. Streak Bonus
| Streak | Multiplier | Example (5km base) |
|--------|------------|-------------------|
| < 7 days | 0% | 50 |
| >= 7 days | +5% | +3 coins |

#### 3. Time-of-Day Bonus
| Time | Multiplier | Example (50 base) |
|------|------------|-------------------|
| Off-peak (6-8am, 11am-1pm, 2-5pm) | +10% | +5 |
| Peak (6-9pm) | -10% | -5 |
| Normal (other times) | 0% | 0 |

### Test Scenarios

#### Scenario 1: 5km, 25:00 (5:00/km), Morning, 0 streak
- Base: 50
- Pace: +15% (fast) = 7.5 → 8
- Streak: 0
- Time: +10% (off-peak) = 5.8 → 6
- **Total: 64 coins**

#### Scenario 2: 10km, 1:00:00 (6:00/km), Evening (7pm), 14-day streak
- Base: 100
- Pace: +10% (moderate) = 10
- Streak: +5% = 5.5 → 6
- Time: -10% (peak) = -11.6 → -12
- **Total: 104 coins**

#### Scenario 3: 3km, 30:00 (10:00/km), Night (11pm), 0 streak
- Base: 30
- Pace: 0% (slow)
- Streak: 0
- Time: 0% (normal)
- **Total: 30 coins**

#### Scenario 4: 21.1km (Half Marathon), 1:45:00 (4:58/km), Early morning (6am), 30-day streak
- Base: 211
- Pace: +20% (elite) = 42.2 → 42
- Streak: +5% = 12.65 → 13
- Time: +10% (off-peak) = 26.6 → 27
- **Total: 293 coins**

### Security Features

1. **Server-Side Calculation** — All coin math happens in the Cloud Function, not the client
2. **No Client Override** — The client passes raw `runEntry` only; the server computes coins
3. **Firestore Transaction** — Coin deduction is atomic (no race conditions)
4. **Non-Negative** — `Math.max(0, Math.floor(earnedCoins))` prevents negative values

### UI Transparency

The breakdown is returned from the Cloud Function and displayed in the SaveActivityScreen after a run:
- Shows total coins earned
- Shows bonus breakdown (pace, streak, time) below the coin count