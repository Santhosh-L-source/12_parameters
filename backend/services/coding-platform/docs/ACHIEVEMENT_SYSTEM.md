# Achievement System Documentation

## Overview

The Achievement System tracks student progress through coding challenges and provides clear goals and recommendations for improvement.

## Achievement Levels

| Points | Level | Requirements |
|--------|-------|--------------|
| **5** | 🥉 Bronze | 200 approved problems, including at least 20 SQL |
| **10** | 🥈 Silver | 350 approved problems, including at least 30 SQL |
| **15** | 🥇 Gold | 550 approved problems, including at least 45 SQL |
| **20** | 💍 Platinum | 750 approved problems, including at least 60 SQL |
| **25** | 💎 Diamond | 1,000+ approved problems, including at least 75 SQL |

## Features

### 1. Current Level Display
- Shows your current achievement level with color-coded badge
- Displays total problems solved and SQL problems solved
- Visual indication of your progress

### 2. Progress Tracking
- **Total Problems Progress Bar**: Shows progress toward next level's total requirement
- **SQL Problems Progress Bar**: Shows progress toward next level's SQL requirement
- Percentage completion displayed for both metrics

### 3. Smart Recommendations
The system provides personalized recommendations based on your current progress:

#### High Priority Recommendations
- Number of total problems needed for next level
- Number of SQL problems needed for next level

#### Tips and Suggestions
- **For SQL Practice**: "💡 Focus on LeetCode SQL problems - they have a dedicated SQL section"
- **For General Practice**: "💡 Try competitive programming on Codeforces or CodeChef to boost your count"

### 4. All Levels Overview
- Visual display of all achievement levels
- Check marks (✓) for completed levels
- "CURRENT" badge on your active level
- Grayed-out styling for locked levels

## How It Works

### Calculation Logic

```javascript
// Your current stats
Total Problems = Sum of all problems across all platforms
SQL Problems = Sum of SQL problems across all platforms

// Achievement determination
for each level (from lowest to highest):
  if (totalSolved >= level.totalRequired AND sqlSolved >= level.sqlRequired):
    currentLevel = this level
    nextLevel = next level in the list
```

### Progress Calculation

```javascript
// Progress percentage
previousLevelTotal = currentLevel ? currentLevel.totalRequired : 0
nextLevelTotal = nextLevel.totalRequired

progress = ((yourTotal - previousLevelTotal) / (nextLevelTotal - previousLevelTotal)) * 100
```

## UI Components

### AchievementProgress Component
Located in: `client/src/components/AchievementProgress.jsx`

**Props:**
- `totalSolved` (number): Total problems solved across all platforms
- `sqlSolved` (number): Total SQL problems solved

**Features:**
- Responsive design
- Color-coded level badges
- Progress bars with smooth animations
- Recommendation cards
- All levels overview with completion status

### Criteria Configuration
Located in: `client/src/config/criteria.js`

**Exports:**
- `ACHIEVEMENT_CRITERIA`: Array of all achievement levels
- `calculateAchievementLevel()`: Determines current and next level
- `getRecommendations()`: Generates personalized recommendations
- `calculateProgress()`: Calculates progress percentages

## Example Usage

### In StudentDashboard
```jsx
import AchievementProgress from './AchievementProgress';

// Calculate totals from evidence
const totalProblems = evidence.reduce((sum, e) => sum + e.totalProblemsSolved, 0);
const totalSql = evidence.reduce((sum, e) => sum + e.sqlProblemsSolved, 0);

// Render component
<AchievementProgress
  totalSolved={totalProblems}
  sqlSolved={totalSql}
/>
```

## Customization

### Adding New Levels
Edit `client/src/config/criteria.js`:

```javascript
{
  points: 30,
  totalRequired: 1500,
  sqlRequired: 100,
  title: 'Master Level',
  description: '1,500+ approved problems, including at least 100 SQL',
  color: '#FF00FF',
}
```

### Modifying Recommendations
Edit the `getRecommendations()` function in `criteria.js` to add custom logic:

```javascript
if (customCondition) {
  recommendations.push({
    type: 'tip',
    message: 'Your custom recommendation',
    priority: 'medium',
  });
}
```

## Benefits

✅ **Clear Goals**: Students know exactly what to achieve next
✅ **Motivation**: Visual progress and achievements keep students engaged
✅ **Personalized**: Recommendations adapt to individual progress
✅ **Gamification**: Level system makes learning more fun
✅ **Transparency**: All criteria are visible upfront

## Future Enhancements

Possible additions:
- 🏆 Badges for special achievements (e.g., "SQL Master", "Speed Demon")
- 📊 Historical progress charts
- 🎯 Custom goal setting
- 👥 Leaderboard integration
- 🔔 Notifications when nearing a new level
- 📧 Email reminders for inactive users

## Screenshots

The Achievement Progress component displays:
1. Current level badge with points
2. Total and SQL problem counts
3. Next level target with progress bars
4. Personalized recommendations
5. Complete level hierarchy with completion status
