const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const GateEvidence = sequelize.define(
    'GateEvidence',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      studentId: { type: DataTypes.INTEGER, allowNull: false },
      semesterId: { type: DataTypes.INTEGER, allowNull: false },

      // --- Evidence fields (student-submitted) ---
      diagnosticCompleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      testsCompleted: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      fullLengthTestsCompleted: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      averageScorePercent: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      officialAppearance: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      qualified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      gateScore: { type: DataTypes.INTEGER, allowNull: true },
      branchCode: { type: DataTypes.STRING(20), allowNull: false },

      // --- Optional higher-studies exam ---
      optionalExamType: {
        type: DataTypes.ENUM('GRE', 'GMAT', 'CAT', 'TOEFL', 'IELTS', 'PTE'),
        allowNull: true,
      },
      optionalScorecardValid: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      // Mentor confirms the optional scorecard meets the Central Team's published threshold
      centralThresholdMet: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      proofUrl: { type: DataTypes.STRING(500), allowNull: true },

      // --- Verification workflow ---
      status: {
        type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      mentorId: { type: DataTypes.INTEGER, allowNull: true },
      verifiedAt: { type: DataTypes.DATE, allowNull: true },

      // --- Computed scores (written on APPROVE) ---
      coreTier: { type: DataTypes.INTEGER, allowNull: true },
      bonus: { type: DataTypes.INTEGER, allowNull: true },
      finalScore: { type: DataTypes.INTEGER, allowNull: true },
      // True when student could qualify for tier-25 but no calibration row exists for their branch
      flagMissingCalibration: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      tableName: 'gate_evidence',
      timestamps: true,
    }
  );

  return GateEvidence;
};
