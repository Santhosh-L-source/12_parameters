const { DataTypes } = require('sequelize');

// Admin-maintained table reviewed periodically by the Central Team.
// The scoring service reads from this — thresholds are NEVER hardcoded in scoring logic.
module.exports = (sequelize) => {
  const GateBranchCalibration = sequelize.define(
    'GateBranchCalibration',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      branchCode: { type: DataTypes.STRING(20), allowNull: false },
      // Minimum GATE score to be considered "qualified" for this branch
      minQualifyingScore: { type: DataTypes.INTEGER, allowNull: false },
      // Minimum GATE score required to earn the top tier (25 marks)
      minScoreFor25Marks: { type: DataTypes.INTEGER, allowNull: false },
      // Date range during which this row is the active calibration for the branch
      effectiveFrom: { type: DataTypes.DATEONLY, allowNull: false },
      effectiveTo: { type: DataTypes.DATEONLY, allowNull: true },
      // FK to the admin user who last updated this row
      updatedBy: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      tableName: 'gate_branch_calibration',
      timestamps: true,
      indexes: [{ fields: ['branchCode', 'effectiveFrom'] }],
    }
  );

  return GateBranchCalibration;
};
