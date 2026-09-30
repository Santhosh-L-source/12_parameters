// Coding Problems Achievement Criteria
// Based on total approved problems and SQL problems solved

export const ACHIEVEMENT_CRITERIA = [
  {
    points: 5,
    totalRequired: 200,
    sqlRequired: 20,
    title: 'Bronze Level',
    description: '200 approved problems, including at least 20 SQL',
    color: '#CD7F32',
  },
  {
    points: 10,
    totalRequired: 350,
    sqlRequired: 30,
    title: 'Silver Level',
    description: '350 approved problems, including at least 30 SQL',
    color: '#C0C0C0',
  },
  {
    points: 15,
    totalRequired: 550,
    sqlRequired: 45,
    title: 'Gold Level',
    description: '550 approved problems, including at least 45 SQL',
    color: '#FFD700',
  },
  {
    points: 20,
    totalRequired: 750,
    sqlRequired: 60,
    title: 'Platinum Level',
    description: '750 approved problems, including at least 60 SQL',
    color: '#E5E4E2',
  },
  {
    points: 25,
    totalRequired: 1000,
    sqlRequired: 75,
    title: 'Diamond Level',
    description: '1,000+ approved problems, including at least 75 SQL',
    color: '#B9F2FF',
  },
];

/**
 * Calculate current achievement level
 */
export function calculateAchievementLevel(totalSolved, sqlSolved) {
  let currentLevel = null;
  let nextLevel = ACHIEVEMENT_CRITERIA[0];

  for (let i = 0; i < ACHIEVEMENT_CRITERIA.length; i++) {
    const criteria = ACHIEVEMENT_CRITERIA[i];

    if (totalSolved >= criteria.totalRequired && sqlSolved >= criteria.sqlRequired) {
      currentLevel = criteria;
      nextLevel = ACHIEVEMENT_CRITERIA[i + 1] || null;
    } else {
      if (!currentLevel) {
        nextLevel = criteria;
      }
      break;
    }
  }

  return { currentLevel, nextLevel };
}

/**
 * Get recommendations for next steps
 */
export function getRecommendations(totalSolved, sqlSolved) {
  const { currentLevel, nextLevel } = calculateAchievementLevel(totalSolved, sqlSolved);
  const recommendations = [];

  if (!nextLevel) {
    return [{
      type: 'success',
      message: '🎉 Congratulations! You have achieved the highest level (Diamond)!',
    }];
  }

  const totalNeeded = nextLevel.totalRequired - totalSolved;
  const sqlNeeded = nextLevel.sqlRequired - sqlSolved;

  if (totalNeeded > 0) {
    recommendations.push({
      type: 'info',
      message: `Solve ${totalNeeded} more problem${totalNeeded !== 1 ? 's' : ''} to reach ${nextLevel.title}`,
      priority: 'high',
    });
  }

  if (sqlNeeded > 0) {
    recommendations.push({
      type: 'info',
      message: `Solve ${sqlNeeded} more SQL problem${sqlNeeded !== 1 ? 's' : ''} to reach ${nextLevel.title}`,
      priority: 'high',
    });
  }

  // Platform-specific recommendations
  if (sqlNeeded > 0) {
    recommendations.push({
      type: 'tip',
      message: '💡 Focus on LeetCode SQL problems - they have a dedicated SQL section',
      priority: 'medium',
    });
  }

  if (totalNeeded > sqlNeeded && totalNeeded > 50) {
    recommendations.push({
      type: 'tip',
      message: '💡 Try competitive programming on Codeforces or CodeChef to boost your count',
      priority: 'medium',
    });
  }

  return recommendations;
}

/**
 * Calculate progress percentage to next level
 */
export function calculateProgress(totalSolved, sqlSolved) {
  const { currentLevel, nextLevel } = calculateAchievementLevel(totalSolved, sqlSolved);

  if (!nextLevel) {
    return { totalProgress: 100, sqlProgress: 100 };
  }

  const prevTotal = currentLevel ? currentLevel.totalRequired : 0;
  const prevSql = currentLevel ? currentLevel.sqlRequired : 0;

  const totalRange = nextLevel.totalRequired - prevTotal;
  const sqlRange = nextLevel.sqlRequired - prevSql;

  const totalProgress = Math.min(100, Math.round(((totalSolved - prevTotal) / totalRange) * 100));
  const sqlProgress = Math.min(100, Math.round(((sqlSolved - prevSql) / sqlRange) * 100));

  return { totalProgress, sqlProgress };
}
