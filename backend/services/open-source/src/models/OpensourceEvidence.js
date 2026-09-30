const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OpensourceEvidence = sequelize.define('OpensourceEvidence', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  studentId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  semester: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  repoOrProgrammeName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  achievementType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['MERGED_PR', 'PROGRAMME_SELECTED', 'PROGRAMME_COMPLETED']],
    },
  },
  merged: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
    field: 'merged',
  },
  validPRsCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    field: 'valid_prs_count',
  },
  mergedPRsCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    field: 'merged_prs_count',
  },
  platform: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'platform',
  },
  stageMarks: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  proofUrl: {
    type: DataTypes.STRING(512),
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'PENDING',
    validate: {
      isIn: [['PENDING', 'VERIFIED', 'REJECTED']],
    },
  },
  mentorId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  verifiedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'opensource_evidence',
  underscored: true,
  indexes: [
    { fields: ['student_id'] },
    {
      unique: true,
      fields: ['student_id', 'repo_or_programme_name', 'achievement_type'],
    },
  ],
});

module.exports = OpensourceEvidence;
