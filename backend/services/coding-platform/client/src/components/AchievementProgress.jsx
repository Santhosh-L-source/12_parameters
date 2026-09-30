import { Trophy, Target, TrendingUp, CheckCircle, Circle } from 'lucide-react';
import { ACHIEVEMENT_CRITERIA, calculateAchievementLevel, getRecommendations, calculateProgress } from '../config/criteria';

export default function AchievementProgress({ totalSolved, sqlSolved }) {
  const { currentLevel, nextLevel } = calculateAchievementLevel(totalSolved, sqlSolved);
  const recommendations = getRecommendations(totalSolved, sqlSolved);
  const { totalProgress, sqlProgress } = calculateProgress(totalSolved, sqlSolved);

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="card-header">
        <div>
          <h2>Achievement Progress</h2>
          <p>Track your coding journey and unlock new levels</p>
        </div>
      </div>

      <div className="card-body">
        {/* Current Level Display */}
        <div style={{
          padding: '20px',
          background: currentLevel ? `linear-gradient(135deg, ${currentLevel.color}15, ${currentLevel.color}05)` : 'var(--bg-secondary)',
          borderRadius: '12px',
          marginBottom: '20px',
          border: currentLevel ? `2px solid ${currentLevel.color}40` : '2px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: currentLevel ? currentLevel.color : 'var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 'bold',
              color: 'white',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              {currentLevel ? currentLevel.points : 0}
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '5px' }}>
                {currentLevel ? currentLevel.title : 'Getting Started'}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                {currentLevel ? currentLevel.description : 'Solve problems to unlock your first achievement'}
              </div>
            </div>
          </div>

          {/* Current Stats */}
          <div style={{ display: 'flex', gap: '20px', marginTop: '15px' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--primary)' }}>
                {totalSolved}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Total Problems
              </div>
            </div>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--info)' }}>
                {sqlSolved}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                SQL Problems
              </div>
            </div>
          </div>
        </div>

        {/* Next Level Target */}
        {nextLevel && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
              <Target size={20} style={{ color: 'var(--primary)' }} />
              <h3 style={{ margin: 0 }}>Next: {nextLevel.title} ({nextLevel.points} points)</h3>
            </div>

            {/* Progress bars */}
            <div style={{ marginBottom: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '13px' }}>
                <span>Total Problems: {totalSolved} / {nextLevel.totalRequired}</span>
                <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{totalProgress}%</span>
              </div>
              <div style={{
                height: '8px',
                background: 'var(--bg-secondary)',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${totalProgress}%`,
                  background: 'var(--primary)',
                  transition: 'width 0.3s ease'
                }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '13px' }}>
                <span>SQL Problems: {sqlSolved} / {nextLevel.sqlRequired}</span>
                <span style={{ color: 'var(--info)', fontWeight: 'bold' }}>{sqlProgress}%</span>
              </div>
              <div style={{
                height: '8px',
                background: 'var(--bg-secondary)',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${sqlProgress}%`,
                  background: 'var(--info)',
                  transition: 'width 0.3s ease'
                }}></div>
              </div>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
              <TrendingUp size={20} style={{ color: 'var(--success)' }} />
              <h3 style={{ margin: 0 }}>Recommendations</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recommendations.map((rec, index) => (
                <div
                  key={index}
                  style={{
                    padding: '12px 15px',
                    background: rec.type === 'success' ? 'var(--success-light)' : rec.type === 'tip' ? 'var(--warning-light)' : 'var(--info-light)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    borderLeft: `4px solid ${rec.type === 'success' ? 'var(--success)' : rec.type === 'tip' ? 'var(--warning)' : 'var(--info)'}`,
                  }}
                >
                  {rec.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Levels Overview */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
            <Trophy size={20} style={{ color: 'var(--warning)' }} />
            <h3 style={{ margin: 0 }}>All Achievement Levels</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {ACHIEVEMENT_CRITERIA.map((criteria) => {
              const isCompleted = totalSolved >= criteria.totalRequired && sqlSolved >= criteria.sqlRequired;
              const isCurrent = currentLevel && currentLevel.points === criteria.points;

              return (
                <div
                  key={criteria.points}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '15px',
                    padding: '12px 15px',
                    background: isCurrent ? `${criteria.color}10` : 'var(--bg-secondary)',
                    borderRadius: '8px',
                    border: isCurrent ? `2px solid ${criteria.color}` : '2px solid transparent',
                    opacity: isCompleted ? 1 : 0.7
                  }}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: isCompleted ? criteria.color : 'var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: 'white',
                    flexShrink: 0
                  }}>
                    {criteria.points}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {criteria.title}
                      {isCompleted && <CheckCircle size={16} style={{ color: 'var(--success)' }} />}
                      {isCurrent && <span style={{ fontSize: '11px', padding: '2px 8px', background: criteria.color, color: 'white', borderRadius: '4px' }}>CURRENT</span>}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {criteria.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
