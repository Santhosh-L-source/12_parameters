import { Trophy, Target, TrendingUp, CheckCircle, Award } from 'lucide-react';
import { ACHIEVEMENT_CRITERIA, calculateAchievementLevel, getRecommendations, calculateProgress } from '../config/criteria';

export default function MarksDisplay({ totalSolved, sqlSolved }) {
  const { currentLevel, nextLevel } = calculateAchievementLevel(totalSolved, sqlSolved);
  const recommendations = getRecommendations(totalSolved, sqlSolved);
  const { totalProgress, sqlProgress } = calculateProgress(totalSolved, sqlSolved);

  const maxMarks = 25;
  const currentMarks = currentLevel ? currentLevel.points : 0;
  const percentage = Math.round((currentMarks / maxMarks) * 100);

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="card-header">
        <div>
          <h2>Marks & Achievement Progress</h2>
          <p>Track your coding journey and marks earned</p>
        </div>
      </div>

      <div className="card-body">
        {/* Hero Section: Marks + Current Level */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          marginBottom: '25px',
        }}>
          {/* Marks Display */}
          <div style={{
            textAlign: 'center',
            padding: '30px 20px',
            background: 'linear-gradient(135deg, var(--primary), var(--info))',
            borderRadius: '16px',
            color: 'white',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}>
            <div style={{ fontSize: '60px', fontWeight: 'bold', lineHeight: 1 }}>
              {currentMarks}
              <span style={{ fontSize: '28px', opacity: 0.9 }}>/{maxMarks}</span>
            </div>
            <div style={{ fontSize: '16px', opacity: 0.95, marginTop: '8px' }}>
              Marks Obtained
            </div>
            <div style={{ fontSize: '13px', opacity: 0.8, marginTop: '4px' }}>
              ({percentage}% of maximum)
            </div>
          </div>

          {/* Current Level + Stats */}
          <div style={{
            padding: '20px',
            background: currentLevel ? `linear-gradient(135deg, ${currentLevel.color}15, ${currentLevel.color}05)` : 'var(--bg-secondary)',
            borderRadius: '16px',
            border: currentLevel ? `2px solid ${currentLevel.color}40` : '2px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: currentLevel ? currentLevel.color : 'var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 'bold',
                color: 'white',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                flexShrink: 0,
              }}>
                {currentMarks}
              </div>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                  {currentLevel ? currentLevel.title : 'Getting Started'}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {currentLevel ? currentLevel.description : 'Solve problems to unlock your first level'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '25px' }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--primary)' }}>
                  {totalSolved.toLocaleString()}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Problems</div>
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--info)' }}>
                  {sqlSolved}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>SQL Problems</div>
              </div>
            </div>
          </div>
        </div>

        {/* Marks Breakdown - Level Cards */}
        <div style={{ marginBottom: '25px' }}>
          <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Award size={18} style={{ color: 'var(--warning)' }} />
            Level Breakdown
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '10px',
          }}>
            {ACHIEVEMENT_CRITERIA.map((criteria) => {
              const achieved = totalSolved >= criteria.totalRequired && sqlSolved >= criteria.sqlRequired;
              const isCurrent = currentLevel && currentLevel.points === criteria.points;
              return (
                <div key={criteria.points} style={{
                  padding: '12px',
                  background: achieved ? `${criteria.color}20` : 'var(--bg-secondary)',
                  borderRadius: '10px',
                  border: isCurrent ? `2px solid ${criteria.color}` : achieved ? `2px solid ${criteria.color}60` : '2px solid var(--border)',
                  textAlign: 'center',
                  opacity: achieved ? 1 : 0.6,
                  position: 'relative',
                }}>
                  {isCurrent && (
                    <div style={{
                      position: 'absolute',
                      top: '-8px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: '9px',
                      fontWeight: 'bold',
                      padding: '1px 6px',
                      background: criteria.color,
                      color: 'white',
                      borderRadius: '3px',
                      whiteSpace: 'nowrap',
                    }}>CURRENT</div>
                  )}
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: achieved ? criteria.color : 'var(--border)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    color: 'white',
                    marginBottom: '6px',
                  }}>{criteria.points}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '13px' }}>
                      {criteria.title.replace(' Level', '')}
                    </span>
                    {achieved && <CheckCircle size={13} style={{ color: 'var(--success)' }} />}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {criteria.totalRequired >= 1000 ? '1,000+' : criteria.totalRequired} probs, {criteria.sqlRequired} SQL
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Next Level Progress */}
        {nextLevel && (
          <div style={{
            marginBottom: '25px',
            padding: '20px',
            background: 'var(--bg-secondary)',
            borderRadius: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
              <Target size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ margin: 0 }}>Next: {nextLevel.title} ({nextLevel.points} points)</h3>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '13px' }}>
                <span>Total Problems: {totalSolved.toLocaleString()} / {nextLevel.totalRequired.toLocaleString()}</span>
                <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{totalProgress}%</span>
              </div>
              <div style={{ height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${totalProgress}%`, background: 'var(--primary)', transition: 'width 0.3s ease' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '13px' }}>
                <span>SQL Problems: {sqlSolved} / {nextLevel.sqlRequired}</span>
                <span style={{ color: 'var(--info)', fontWeight: 'bold' }}>{sqlProgress}%</span>
              </div>
              <div style={{ height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${sqlProgress}%`, background: 'var(--info)', transition: 'width 0.3s ease' }} />
              </div>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div style={{ marginBottom: '25px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <TrendingUp size={18} style={{ color: 'var(--success)' }} />
              <h3 style={{ margin: 0 }}>Recommendations</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recommendations.map((rec, i) => (
                <div key={i} style={{
                  padding: '10px 14px',
                  background: rec.type === 'success' ? 'var(--success-light)' : rec.type === 'tip' ? 'var(--warning-light)' : 'var(--info-light)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  borderLeft: `4px solid ${rec.type === 'success' ? 'var(--success)' : rec.type === 'tip' ? 'var(--warning)' : 'var(--info)'}`,
                }}>
                  {rec.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div style={{
          padding: '12px 15px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
        }}>
          <strong style={{ color: 'var(--text-primary)' }}>How marks work:</strong> Only <strong style={{ color: 'var(--warning)' }}>verified platforms</strong> count. Both total and SQL problems must meet the criteria. Max: 25 points (Diamond).
        </div>
      </div>
    </div>
  );
}
