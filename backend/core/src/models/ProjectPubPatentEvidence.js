const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProjectPubPatentEvidence = sequelize.define('ProjectPubPatentEvidence', {
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
  achievementType: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      isIn: [['PROJECT', 'PUBLICATION', 'PATENT']],
    },
  },
  outputName: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  achievementStage: {
    type: DataTypes.STRING(50),
    allowNull: false,
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
  submittedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
  distinctKey: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  distinctKeyNormalized: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'project_evidence',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['student_id'] },
    {
      unique: true,
      fields: ['student_id', 'output_name', 'achievement_stage'],
    },
  ],
});

module.exports = ProjectPubPatentEvidence;
